const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ─── Load thumbnail once at startup ───────────────────────────────────────────
const THUMB_PATH = path.join(process.cwd(), 'assets', 'images', 'nexa.png');
let thumbBuffer = null;
try {
    if (fs.existsSync(THUMB_PATH)) thumbBuffer = fs.readFileSync(THUMB_PATH);
} catch (_) {}

// ─── Sticker EXIF helpers ─────────────────────────────────────────────────────
function buildStickerExif(metadata) {
    const json = Buffer.from(JSON.stringify(metadata), 'utf-8');
    const exif = Buffer.concat([
        Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]),
        Buffer.alloc(4),
        Buffer.from([0x16, 0x00, 0x00, 0x00]),
        json,
    ]);
    exif.writeUInt32LE(json.length, 14);
    return exif;
}

function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(data.length, 0);
    const padding = data.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    return Buffer.concat([typeBuffer, sizeBuffer, data, padding]);
}

function setWebpExif(webpBuffer, metadata, fallbackWidth = 512, fallbackHeight = 512) {
    if (webpBuffer.slice(0, 4).toString() !== 'RIFF' || webpBuffer.slice(8, 12).toString() !== 'WEBP') {
        throw new Error('File bukan WEBP valid.');
    }

    const chunks = [];
    let offset = 12;
    let vp8xFlags = 0;
    let width = fallbackWidth;
    let height = fallbackHeight;
    let hasAlpha = false;
    let hasAnim = false;

    while (offset + 8 <= webpBuffer.length) {
        const type = webpBuffer.slice(offset, offset + 4).toString();
        const size = webpBuffer.readUInt32LE(offset + 4);
        const chunkStart = offset;
        const chunkEnd = offset + 8 + size + (size % 2);
        if (chunkEnd > webpBuffer.length) break;

        if (type === 'VP8X') {
            const payload = webpBuffer.slice(chunkStart + 8, chunkStart + 8 + size);
            vp8xFlags = payload[0];
            width = 1 + (payload[4] | (payload[5] << 8) | (payload[6] << 16));
            height = 1 + (payload[7] | (payload[8] << 8) | (payload[9] << 16));
        } else if (type === 'EXIF') {
            // dibuang, nanti diganti yang baru
        } else {
            if (type === 'ALPH') hasAlpha = true;
            if (type === 'ANIM' || type === 'ANMF') hasAnim = true;
            chunks.push(webpBuffer.slice(chunkStart, chunkEnd));
        }
        offset = chunkEnd;
    }

    let flags = vp8xFlags | 0x08;
    if (hasAlpha) flags |= 0x10;
    if (hasAnim) flags |= 0x02;

    const vp8xPayload = Buffer.alloc(10);
    vp8xPayload[0] = flags;
    vp8xPayload.writeUIntLE(width - 1, 4, 3);
    vp8xPayload.writeUIntLE(height - 1, 7, 3);
    const vp8xChunk = makeChunk('VP8X', vp8xPayload);

    const exifPayload = buildStickerExif(metadata);
    const exifChunk = makeChunk('EXIF', exifPayload);

    const body = Buffer.concat([vp8xChunk, ...chunks, exifChunk]);
    const header = Buffer.alloc(12);
    header.write('RIFF', 0);
    header.writeUInt32LE(body.length + 4, 4);
    header.write('WEBP', 8);
    return Buffer.concat([header, body]);
}

module.exports = {
    name: "brat",
    async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
        const text = (typeof args === 'string' ? args : '').trim();
        
        if (!text) {
            return sock.sendMessage(sender, { 
                text: `⎋ *ʙʀᴀᴛ sᴛɪᴄᴋᴇʀ*\n\n> Masukkan teks\n\n\`Contoh: .brat Hai semua\`\n> Bisa juga set packname/author:\n\`.brat Hai semua | Nexa Bot | nexadev\`` 
            }, { quoted: msg });
        }

        // Format: <text> | <packname> | <author>
        const parts = text.split('|').map(s => s.trim());
        const inputText = parts[0];
        const packname = parts[1] || 'Nexa Bot';
        const author = parts[2] || msg.pushName || 'User';

        await sock.sendMessage(sender, { text: '⎋ ʙʀᴀᴛ sᴛɪᴄᴋᴇʀ\n\n> ʙᴇɴᴛᴀʀ ʏᴀ ʟᴀɢɪ ᴀᴋᴜ ʙᴜᴀᴛɪɴ ɴɪᴄʜ' }, { quoted: msg });

        try {
            const url = `https://api.nexadev.my.id/api/canvas/brat?text=${encodeURIComponent(inputText)}`;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);

            // Convert to WebP 512×512 sticker format
            const stickerBuffer = await sharp(imageBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 80 })
                .toBuffer();

            // Tambahkan metadata EXIF
            const metadata = {
                'sticker-pack-id': 'NexaBot',
                'sticker-pack-name': packname,
                'sticker-pack-publisher': author,
                'emojis': ['⭐'],
                'is-avatar-sticker': 0,
                'is-ai-sticker': 1,
            };
            
            const finalBuffer = setWebpExif(stickerBuffer, metadata, 512, 512);
            await sock.sendMessage(sender, { sticker: finalBuffer }, { quoted: msg });

        } catch (e) {
            sock.sendMessage(sender, { text: "❌ Error: " + e.message }, { quoted: msg });
        }
    }
};