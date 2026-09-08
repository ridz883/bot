const axios = require('axios');

module.exports = {
  name: "ig",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    // Validasi input
    if (!text || !text.includes("instagram.com")) {
      return sock.sendMessage(sender, { text: "⚠️ Kirim link Instagram yang valid!" }, { quoted: msg });
    }

    try {
      await sock.sendMessage(sender, { text: "⏳ Sedang memproses video Instagram..." }, { quoted: msg });

      let videoUrl = "";
      let caption = "🎬 *I N S T A G R A M*";
      let serverUsed = "";

      // Coba V1
      try {
        const res = await axios.get(`https://api.deline.web.id/downloader/ig?url=${encodeURIComponent(text)}`);
        videoUrl = res.data?.result?.media?.videos[0];
        if (videoUrl) serverUsed = "V1";
      } catch (e) {}

      // Fallback ke V2 jika V1 gagal
      if (!videoUrl) {
        try {
          const res = await axios.get(`https://api.ikyyxd.my.id/download/igv2?url=${encodeURIComponent(text)}`);
          videoUrl = res.data?.result?.[0]?.url;
          if (videoUrl) serverUsed = "V2";
        } catch (e) {}
      }

      // Fallback ke V3 jika V1 & V2 gagal
      if (!videoUrl) {
        try {
          const res = await axios.get(`https://api.zenzxz.my.id/download/instagram?url=${encodeURIComponent(text)}`);
          const data = res.data.result;
          videoUrl = data.url;
          if (data.username) {
            const cleanCaption = data.caption ? data.caption.replace(/[*_~`]/g, '') : '-';
            caption += `\n\n👤 *User*: ${data.username}\n📝 *Caption*: ${cleanCaption}`;
          }
          if (videoUrl) serverUsed = "V3";
        } catch (e) {}
      }

      if (!videoUrl) throw new Error("Gagal mendapatkan URL video dari semua server API.");

      await sock.sendMessage(sender, { text: `🚀 Berhasil menggunakan server ${serverUsed}. Mengirim video...` }, { quoted: msg });

      const videoBuffer = await axios.get(videoUrl, { 
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        }
      });

      await sock.sendMessage(sender, { 
        video: Buffer.from(videoBuffer.data), 
        caption: caption,
        mimetype: 'video/mp4'
      }, { quoted: msg });

    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
  }
};