const axios = require('axios');
const FormData = require('form-data');

const UPLOAD_KEY = 'AIzaBj7z2z3xBjsk';
const UPLOAD_DOMAIN = 'https://c.termai.cc';

function detectMime(buffer) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return { mime: 'image/png', ext: 'png' };
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return { mime: 'image/gif', ext: 'gif' };
    if (buffer[0] === 0x52 && buffer[4] === 0x57) return { mime: 'image/webp', ext: 'webp' };
    return { mime: 'image/jpeg', ext: 'jpg' };
}

async function uploadImage(buffer) {
    const { mime, ext } = detectMime(buffer);
    const form = new FormData();
    form.append('file', buffer, {
        filename: `image.${ext}`,
        contentType: mime,
        knownLength: buffer.length,
    });

    const res = await axios.post(
        `${UPLOAD_DOMAIN}/api/upload?key=${UPLOAD_KEY}`,
        form,
        {
            headers: { ...form.getHeaders() },
            timeout: 60000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        }
    );

    const url = res.data?.path;
    if (!url) throw new Error('Upload gagal: tidak ada path di response');
    return url.startsWith('http') ? url : UPLOAD_DOMAIN + url;
}

async function enhanceHD(imageUrl) {
    const res = await axios.get(
        `https://api-faa.my.id/faa/hdv4?image=${encodeURIComponent(imageUrl)}`,
        { timeout: 120000 }
    );
    const resultUrl = res.data?.result?.image_upscaled;
    if (!resultUrl) throw new Error('API tidak mengembalikan hasil');
    return resultUrl;
}

module.exports = {
    name: "hd",
    async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
        const text = (typeof args === 'string' ? args : '').trim();
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuotedImage = quotedMsg?.imageMessage || quotedMsg?.stickerMessage;
        const isDirectImage = msg.message?.imageMessage;

        if (!isQuotedImage && !isDirectImage) {
            return sock.sendMessage(sender, {
                text: "✨ *ʀᴇᴍɪɴɪ ᴇɴʜᴀɴᴄᴇ*\n\n> Kirim/reply gambar untuk di-enhance menjadi HD\n\n`.hd`"
            }, { quoted: msg });
        }

        try {
            const downloadTarget = isDirectImage ? msg : { message: quotedMsg };
            const buffer = await downloadMediaMessage(downloadTarget, 'buffer', {});

            if (!buffer || !buffer.length) {
                return sock.sendMessage(sender, { text: "❌ Gagal mendownload gambar." }, { quoted: msg });
            }

            let imageUrl;
            try {
                imageUrl = await uploadImage(buffer);
            } catch (e) {
                return sock.sendMessage(sender, { text: `❌ Gagal upload gambar\n\n> ${e.message}` }, { quoted: msg });
            }

            let resultUrl;
            try {
                resultUrl = await enhanceHD(imageUrl);
            } catch (e) {
                return sock.sendMessage(sender, { text: `❌ Gagal enhance gambar\n\n> ${e.message}` }, { quoted: msg });
            }

            await sock.sendMessage(sender, {
                image: { url: resultUrl },
                caption: "✨ *ʀᴇᴍɪɴɪ ᴇɴʜᴀɴᴄᴇ*\n\n> Gambar berhasil di-enhance ke HD!"
            }, { quoted: msg });

        } catch (e) {
            sock.sendMessage(sender, { text: "❌ Error: " + e.message }, { quoted: msg });
        }
    }
};