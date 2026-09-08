const axios = require('axios');

module.exports = {
  name: "allin",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "Masukkan URL TikTok.\n\nContoh:\n.download https://vt.tiktok.com/ZS4cWtHop" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("📥 *[2/3] Mengunduh video...*");
      
      const api = `https://savevideoid.vercel.app/api/download?url=${encodeURIComponent(text)}`;

      const { data } = await axios.get(api, {
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!data?.success || !data?.results?.length) {
        throw new Error('Video tidak ditemukan.');
      }

      const result = data.results[0];
      const videoUrl = result.hd_url || result.download_url;

      if (!videoUrl) {
        throw new Error('URL video tidak tersedia.');
      }

      await setStatus("✅ *[3/3] Selesai! Mengirimkan hasil...*");

      await sock.sendMessage(sender, {
        video: {
          url: videoUrl
        },
        mimetype: 'video/mp4',
        caption: result.title || ''
      }, { quoted: msg });

    } catch (e) {
      await setStatus(`❌ Gagal download video.\n\n${e.message}`);
    }
  }
};