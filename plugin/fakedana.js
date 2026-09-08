const axios = require('axios');

module.exports = {
  name: "fakedana",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const amount = (typeof args === 'string' ? args : '').trim();
    if (!amount) {
      return sock.sendMessage(sender, { text: "❌ Masukkan jumlah nominal Dana yang ingin dibuat!" }, { quoted: msg });
    }

    if (isNaN(amount)) {
      return sock.sendMessage(sender, { text: "❌ Nominal harus berupa angka!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("📥 *[2/3] Membuat bukti transfer Dana...*");
      
      const apiUrl = `https://api.ikyyxd.my.id/canvas/fakedana?amount=${encodeURIComponent(amount)}`;
      const response = await axios.get(apiUrl, { 
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/*'
        }
      });
      
      await setStatus("✅ *[3/3] Selesai! Mengirimkan hasil...*");
      
      await sock.sendMessage(sender, { 
        image: Buffer.from(response.data), 
        caption: `💳 Bukti Transfer Dana\nNominal: ${amount}`
      }, { quoted: msg });
      
    } catch (e) {
      await setStatus("❌ Gagal membuat bukti transfer: " + e.message);
    }
  }
};