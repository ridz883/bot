const axios = require('axios');

module.exports = {
  name: "petrik",
  async run({ sock, msg, sender, args }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan teks untuk membuat stiker Petrik!" }, { quoted: msg });
    }

    try {
      const apiUrl = `https://apii.nexadev.my.id/bratpatrick?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

      await sock.sendMessage(sender, {
        image: Buffer.from(response.data),
        caption: `✅ Stiker Petrik berhasil dibuat!`
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};