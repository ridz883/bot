const axios = require('axios');

module.exports = {
  name: "amsend",
  async run({ sock, msg, sender, args }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan email tujuan yang valid!" }, { quoted: msg });
    }

    try {
      const apiUrl = `https://api.nexadev.my.id/am/send/?key=RIDZZ&email=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl);
      
      const result = response.data;
      const replyText = typeof result === 'object' 
        ? JSON.stringify(result, null, 2) 
        : String(result);

      await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};