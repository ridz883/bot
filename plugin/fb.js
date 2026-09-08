const axios = require('axios');

const SMALL_CAPS_MAP = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
    'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
    's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
    'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
    'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
};

function toSmallCaps(text) {
    return String(text).split('').map(char => SMALL_CAPS_MAP[char] || char).join('');
}

function detectMediaType(url) {
    if (typeof url !== 'string') return 'video';
    const lower = url.toLowerCase();
    if (lower.includes('.mp3') || lower.includes('.wav') || lower.includes('/audio/')) return 'audio';
    if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp')) return 'image';
    return 'video';
}

module.exports = {
    name: "fb",
    async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
        const text = (typeof args === 'string' ? args : '').trim();
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
        
        let fbUrl = text || quotedText;

        if (!fbUrl) {
            return sock.sendMessage(sender, { 
                text: toSmallCaps('⚠️ Masukkan link Facebook!\n\n*Contoh:* .fb https://www.facebook.com/share/r/176Gd2Y3F5/') 
            }, { quoted: msg });
        }

        if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch') && !fbUrl.includes('fb.gg')) {
            return sock.sendMessage(sender, { 
                text: toSmallCaps('⚠️ URL tidak valid! Harap masukkan link Facebook yang benar.') 
            }, { quoted: msg });
        }

        try {
            const apiUrl = `https://api.nexadev.my.id/api/fb?url=${encodeURIComponent(fbUrl)}`;
            const { data: json } = await axios.get(apiUrl, { timeout: 60000 });

            if (!json || json.status === false) {
                throw new Error(json?.message || json?.error || 'Gagal mengambil data dari API');
            }

            let mediaItems = [];
            const rawData = json.data || json.result || json.media || json;

            if (typeof rawData === 'object' && rawData !== null) {
                if (rawData.hd || rawData.sd) {
                    const videoUrl = rawData.hd || rawData.sd;
                    const quality = rawData.hd ? 'HD' : 'SD';
                    mediaItems.push({ url: videoUrl, type: 'video', quality });
                } else if (Array.isArray(rawData)) {
                    rawData.forEach(item => {
                        if (typeof item === 'string') {
                            mediaItems.push({ url: item, type: detectMediaType(item) });
                        } else if (typeof item === 'object' && item !== null) {
                            const targetUrl = item.url || item.hd || item.sd || item.link;
                            const quality = item.hd ? 'HD' : (item.sd ? 'SD' : '');
                            mediaItems.push({ url: targetUrl, type: item.type || detectMediaType(targetUrl), quality });
                        }
                    });
                } else if (rawData.url) {
                    mediaItems.push({ url: rawData.url, type: detectMediaType(rawData.url) });
                }
            } else if (typeof rawData === 'string') {
                mediaItems.push({ url: rawData, type: detectMediaType(rawData) });
            }

            mediaItems = mediaItems.filter(item => item && item.url);

            if (mediaItems.length === 0) {
                throw new Error('Media tidak ditemukan atau link bersifat privat/tidak didukung');
            }

            const totalMedia = mediaItems.length;
            let baseCaption = `📘 *${toSmallCaps('ꜰᴀᴄᴇʙᴏᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ')}*\n\n`;
            baseCaption += `📦 ${toSmallCaps('ᴛᴏᴛᴀʟ ᴍᴇᴅɪᴀ')}: *${totalMedia}*\n`;
            baseCaption += `⚡ ${toSmallCaps('ᴘᴏᴡᴇʀᴇᴅ ʙʏ')}: *NexaDev API*`;

            for (let i = 0; i < totalMedia; i++) {
                const item = mediaItems[i];
                
                // Download buffer menggunakan axios karena getMediaBuffer asli pakai node-fetch
                const response = await axios.get(item.url, { 
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const mediaBuffer = Buffer.from(response.data);

                let itemCaption = totalMedia > 1 ? `${baseCaption}\n\n📄 *${toSmallCaps('ᴍᴇᴅɪᴀ')} ${i + 1}/${totalMedia}*` : baseCaption;
                if (item.quality) {
                    itemCaption += `\n🎥 ${toSmallCaps('ǫᴜᴀʟɪᴛʏ')}: *${item.quality}*`;
                }

                if (item.type === 'video') {
                    await sock.sendMessage(sender, {
                        video: mediaBuffer,
                        caption: itemCaption,
                        mimetype: 'video/mp4'
                    }, { quoted: msg });
                } else if (item.type === 'audio') {
                    await sock.sendMessage(sender, {
                        audio: mediaBuffer,
                        mimetype: 'audio/mp4',
                        ptt: false
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, {
                        image: mediaBuffer,
                        caption: itemCaption,
                        mimetype: 'image/jpeg'
                    }, { quoted: msg });
                }
            }

        } catch (e) {
            sock.sendMessage(sender, { text: toSmallCaps(`❌ Gagal mendownload media Facebook: ${e.message}`) }, { quoted: msg });
        }
    }
};