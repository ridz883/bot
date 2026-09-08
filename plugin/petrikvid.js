const axios = require('axios');

module.exports = {
  name: "rrq",
  async run({ sock, msg, sender, args }) {
    const text = (typeof args === 'string' ? args : Array.isArray(args) ? args.join(' ') : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan teks untuk membuat video Brat Patrick!" }, { quoted: msg });
    }

    try {
      const apiUrl = `https://apii.nexadev.my.id/bratpatrick/video?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 30000 });
      
      if (!response.data || response.data.length === 0) {
        return sock.sendMessage(sender, { text: "❌ Gagal mendapatkan video dari API." }, { quoted: msg });
      }

      await sock.sendMessage(sender, { 
        video: Buffer.from(response.data), 
        caption: `✅ Video Brat Patrick berhasil dibuat!\nTeks: ${text}`,
        mimetype: 'video/mp4'
      }, { quoted: msg });

    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};