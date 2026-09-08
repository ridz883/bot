const axios = require('axios');

module.exports = {
  name: "payplay",
  async run({ sock, msg, sender, args }) {
    const query = (typeof args === 'string' ? args : '').trim();
    if (!query) {
      return await sock.sendMessage(sender, { text: "❌ Masukkan judul lagu/video YouTube yang ingin dicari!" }, { quoted: msg });
    }

    try {
      const apiUrl = `https://api.nexadev.my.id/tools/ytsearch?q=${encodeURIComponent(query)}`;
      const response = await axios.get(apiUrl);
      const data = response.data;

      if (!data || !data.result || data.result.length === 0) {
        return await sock.sendMessage(sender, { text: "❌ Tidak ditemukan hasil pencarian." }, { quoted: msg });
      }

      let teks = `🔍 *Hasil Pencarian YouTube: ${query}*\n\n`;
      const results = Array.isArray(data.result) ? data.result.slice(0, 10) : [data.result];

      results.forEach((item, index) => {
        teks += `*${index + 1}. ${item.title || 'Tanpa Judul'}*\n`;
        teks += `🔗 Link: ${item.url || item.link || '-'}\n`;
        teks += `⏱️ Durasi: ${item.duration || item.timestamp || '-'}\n`;
        teks += `👁️ Views: ${item.views || '-'}\n`;
        teks += `📅 Upload: ${item.uploaded || item.ago || '-'}\n\n`;
      });

      await sock.sendMessage(sender, { text: teks.trim() }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};