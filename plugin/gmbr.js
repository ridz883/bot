const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "gmbr",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan prompt gambar yang ingin dibuat!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("🎨 *[2/3] Menghasilkan gambar dari prompt...*");
      
      const apiKey = 'cmnty-3d6b6601a8d9035f8ddfb87ec85d5e5a';
      const apiUrl = `https://api.cmnty.eu.cc/ai/ideogram?prompt=${encodeURIComponent(text)}&apikey=${apiKey}`;
      
      const response = await axios.get(apiUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      if (!response.data) {
        throw new Error('Gagal mendapatkan gambar dari API');
      }
      
      await setStatus("✅ *[3/3] Gambar berhasil dibuat! Mengirimkan...*");
      
      await sock.sendMessage(sender, { 
        image: Buffer.from(response.data), 
        caption: `🖼️ Gambar dari prompt: "${text}"`,
        mimetype: 'image/jpeg'
      }, { quoted: msg });
      
    } catch (e) {
      await setStatus(`❌ Gagal membuat gambar: ${e.message}`);
    }
  }
};