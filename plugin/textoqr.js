const axios = require('axios');

module.exports = {
  name: "textoqr",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan teks yang ingin dijadikan QR code!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("📥 *[2/3] Menghasilkan QR code...*");
      
      const response = await axios.get(`https://api.ikyyxd.my.id/tools/qrcode?text=${encodeURIComponent(text)}`, {
        responseType: 'arraybuffer'
      });
      
      const qrBuffer = Buffer.from(response.data);
      
      await setStatus("✅ *[3/3] Selesai! Mengirimkan hasil...*");
      
      await sock.sendMessage(sender, {
        image: qrBuffer,
        caption: `✅ QR Code berhasil dibuat!\n\nTeks: ${text}`
      }, { quoted: msg });
      
    } catch (e) {
      await setStatus("❌ Gagal membuat QR code: " + e.message);
    }
  }
};