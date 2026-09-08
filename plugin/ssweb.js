const axios = require('axios');

module.exports = {
  name: "ssweb",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan URL.\nContoh: .ssweb https://github.com" }, { quoted: msg });
    }

    let url = text;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    await sock.sendMessage(sender, { text: "⏳ Sedang mengambil screenshot website..." }, { quoted: msg });

    try {
      const apiKey = global.kyzzKey || global.APIKeys?.['https://api.kyzzz.eu.cc'] || "kyuujir";
      
      let apiUrl;
      if (typeof global.API === 'function') {
        apiUrl = global.API('kyzz', '/api/tools/ssweb', { url }, 'apikey');
      } else {
        apiUrl = `https://api.kyzzz.eu.cc/api/tools/ssweb?url=${encodeURIComponent(url)}&apikey=${apiKey}`;
      }

      let res = await axios.get(apiUrl, { responseType: 'arraybuffer' }).catch(() => null);

      if (res && res.data && Buffer.isBuffer(res.data)) {
        return await sock.sendMessage(sender, {
          image: Buffer.from(res.data),
          caption: `🌐 *Screenshot Web (Kyzz API)*\n\n🔗 URL: ${url}`
        }, { quoted: msg });
      }

      // Fallback ke thum.io jika API utama gagal
      const fallback = await axios.get(`https://image.thum.io/get/fullpage/${url}`, { responseType: 'arraybuffer' });
      
      if (fallback && fallback.data && Buffer.isBuffer(fallback.data)) {
        return await sock.sendMessage(sender, {
          image: Buffer.from(fallback.data),
          caption: `🌐 *Screenshot Web*\n\n🔗 URL: ${url}`
        }, { quoted: msg });
      }

      throw new Error("Tidak ada data gambar yang valid dari kedua sumber.");

    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Gagal screenshot website: " + e.message }, { quoted: msg });
    }
  }
};