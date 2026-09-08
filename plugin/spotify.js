const axios = require('axios');

module.exports = {
  name: "spotify",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
    
    // Validasi input
    const trackUrl = text || quotedText;
    if (!trackUrl) {
      return sock.sendMessage(sender, { text: "⚠️ Masukkan link lagu Spotify!\n\n*Contoh:* .spotify https://open.spotify.com/track/5WOSNVChcadlsCRiqXE45K" }, { quoted: msg });
    }

    if (!trackUrl.includes('spotify.com')) {
      return sock.sendMessage(sender, { text: "⚠️ URL tidak valid! Harap masukkan link track Spotify yang benar." }, { quoted: msg });
    }

    // Map manual untuk font Small Caps
    const SMALL_CAPS_MAP = {
      'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 
      'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 
      's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
      'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 
      'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 
      'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
    };

    const toSmallCaps = (str) => str.split('').map(char => SMALL_CAPS_MAP[char] || char).join('');

    try {
      // 1. Tembak API Nexray
      const apiUrl = `https://api.nexray.eu.cc/downloader/spotify?url=${encodeURIComponent(trackUrl)}`;
      const res = await axios.get(apiUrl, { timeout: 60000 });
      const json = res.data;

      if (!json || json.status === false || !json.result) {
        throw new Error(json?.message || 'Gagal mengambil data lagu dari API Nexray');
      }

      // 2. Ekstraksi data dari JSON response Nexray
      const title = json.result.title || 'Unknown Title';
      const artist = json.result.artist || 'Unknown Artist';
      const downloadUrl = json.result.url;

      if (!downloadUrl) {
        throw new Error('Link download MP3 tidak ditemukan dari respons API');
      }

      // 3. Unduh MP3 direct link menjadi Buffer menggunakan axios
      const audioRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      // 4. Buat Caption Informasi Lagu
      let caption = `🎵 *${toSmallCaps('sᴘᴏᴛɪꜰʏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ')}*\n\n`;
      caption += `📌 *${toSmallCaps('ᴛɪᴛʟᴇ')}*: ${title}\n`;
      caption += `👤 *${toSmallCaps('ᴀʀᴛɪsᴛ')}*: ${artist}\n\n`;
      caption += `⚡ *${toSmallCaps('ᴘᴏᴡᴇʀᴇᴅ ʙʏ')}*: Nexray API`;

      // 5. Kirim Audio ke Chat
      await sock.sendMessage(sender, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: false,
        fileName: `${title} - ${artist}.mp3`,
        caption: caption
      }, { quoted: msg });

    } catch (e) {
      sock.sendMessage(sender, { text: toSmallCaps(`❌ Gagal mendownload lagu Spotify: ${e.message}`) }, { quoted: msg });
    }
  }
};