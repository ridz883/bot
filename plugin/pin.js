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

function isVideoUrl(url) {
    return typeof url === 'string' && (url.includes('.mp4') || url.includes('.m3u8') || url.includes('/v1/pad/'));
}

module.exports = {
    name: "pin",
    async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
        const text = (typeof args === 'string' ? args : '').trim();
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
        
        const pinUrl = text || quotedText;

        if (!pinUrl) {
            return sock.sendMessage(sender, { 
                text: toSmallCaps('⚠️ Masukkan link Pinterest!\n\n*Contoh:* .pin https://pin.it/xxxx') 
            }, { quoted: msg });
        }

        if (!pinUrl.includes('pinterest.com') && !pinUrl.includes('pin.it')) {
            return sock.sendMessage(sender, { 
                text: toSmallCaps('⚠️ URL tidak valid! Harap masukkan link Pinterest yang benar.') 
            }, { quoted: msg });
        }

        try {
            const apiUrl = `https://api.nexadev.my.id/api/pin?url=${encodeURIComponent(pinUrl)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const json = res.data;

            if (!json || json.status === false) {
                throw new Error(json?.message || json?.error || 'Gagal mengambil data dari API');
            }

            let mediaList = [];
            const rawData = json.data || json.result || json.media || json;

            if (Array.isArray(rawData)) {
                mediaList = rawData;
            } else if (typeof rawData === 'string') {
                mediaList = [rawData];
            } else if (typeof rawData === 'object' && rawData !== null) {
                if (Array.isArray(rawData.url)) mediaList = rawData.url;
                else if (Array.isArray(rawData.urls)) mediaList = rawData.urls;
                else if (Array.isArray(rawData.media)) mediaList = rawData.media;
                else if (rawData.url) mediaList = [rawData.url];
                else if (rawData.video || rawData.image) {
                    if (rawData.video) mediaList.push(rawData.video);
                    if (rawData.image) mediaList.push(rawData.image);
                }
            }

            mediaList = mediaList.map(item => typeof item === 'object' ? (item.url || item.link || item) : item).filter(Boolean);

            if (mediaList.length === 0) {
                throw new Error('Media tidak ditemukan pada link tersebut');
            }

            const totalMedia = mediaList.length;
            let caption = `📌 *${toSmallCaps('ᴘɪɴᴛᴇʀᴇsᴛ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ')}*\n\n`;
            caption += `📦 ${toSmallCaps('ᴛᴏᴛᴀʟ ᴍᴇᴅɪᴀ')}: *${totalMedia}*\n`;
            caption += `⚡ ${toSmallCaps('ᴘᴏᴡᴇʀᴇᴅ ʙʏ')}: *NexaDev API*`;

            for (let i = 0; i < totalMedia; i++) {
                const url = mediaList[i];
                const isVid = isVideoUrl(url);
                const itemCaption = totalMedia > 1 ? `${caption}\n\n📄 *${toSmallCaps('ᴍᴇᴅɪᴀ')} ${i + 1}/${totalMedia}*` : caption;

                if (isVid) {
                    await sock.sendMessage(sender, { video: { url }, caption: itemCaption }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, { image: { url }, caption: itemCaption }, { quoted: msg });
                }
            }

        } catch (e) {
            sock.sendMessage(sender, { text: toSmallCaps(`❌ Gagal mendownload media Pinterest: ${e.message}`) }, { quoted: msg });
        }
    }
};