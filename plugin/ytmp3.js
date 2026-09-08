const axios = require('axios');

module.exports = {
  name: "ytmp3",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan link YouTube yang ingin diunduh!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/4] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      // Extract video ID
      let match = null;
      if (text.includes("youtube.com/shorts/") || text.includes("youtu.be/")) {
        match = /\/([a-zA-Z0-9\-_]{11})/.exec(text);
      } else if (text.includes("youtube.com")) {
        match = /v=([a-zA-Z0-9\-_]{11})/.exec(text);
      } else {
        match = /[a-zA-Z0-9\-_]{11}/.exec(text);
      }
      
      const videoId = match ? match[1] : null;
      if (!videoId) {
        await setStatus("❌ Link YouTube tidak valid!");
        return;
      }

      await setStatus("📥 *[2/4] Menginisialisasi sesi konversi...*");

      // Initialize session
      const initUrl = `https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`;
      const initHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://id.ytmp3.mobi',
        'Referer': 'https://id.ytmp3.mobi/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      };

      const initRes = await axios.get(initUrl, { headers: initHeaders });
      if (initRes.data.error > 0) {
        await setStatus(`❌ Gagal inisialisasi: ${initRes.data.error}`);
        return;
      }

      await setStatus("🔄 *[3/4] Memproses konversi audio...*");

      // Request conversion
      let convertUrl = initRes.data.convertURL;
      let convertRequestUrl = `${convertUrl}&v=${videoId}&f=mp3&_=${Math.random()}`;
      let convertData;

      while (true) {
        const convertRes = await axios.get(convertRequestUrl, { headers: initHeaders });
        convertData = convertRes.data;
        
        if (convertData.error > 0) {
          await setStatus(`❌ Gagal konversi: ${convertData.error}`);
          return;
        }

        if (convertData.redirect > 0 && convertData.redirectURL) {
          convertRequestUrl = `${convertData.redirectURL}&v=${videoId}&f=mp3&_=${Math.random()}`;
          continue;
        }
        break;
      }

      const progressUrl = convertData.progressURL;
      const downloadUrl = convertData.downloadURL;
      let title = convertData.title || '';

      if (!progressUrl) {
        await setStatus("❌ Proses konversi gagal!");
        return;
      }

      // Poll progress
      let progress = 0;
      let pollCount = 0;
      const maxPolls = 60;

      while (progress < 3 && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        pollCount++;

        const progressRes = await axios.get(progressUrl, { headers: initHeaders });
        const progressData = progressRes.data;
        
        if (progressData.error > 0) {
          await setStatus(`❌ Gagal cek progress: ${progressData.error}`);
          return;
        }

        progress = progressData.progress;
        if (progressData.title) {
          title = progressData.title;
        }
        
        const progressPercentage = Math.min(95, Math.floor((progress / 3) * 100));
        await setStatus(`📥 *[3/4] Proses konversi ${progressPercentage}%...*`);
      }

      if (progress < 3) {
        await setStatus("❌ Proses konversi timeout (melebihi 60 detik)!");
        return;
      }

      await setStatus("🎵 *[4/4] Mengirim audio...*");

      // Download and send audio
      const audioBuffer = await axios.get(downloadUrl, { 
        responseType: 'arraybuffer',
        headers: initHeaders 
      });

      await sock.sendMessage(sender, { 
        audio: audioBuffer.data, 
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      }, { quoted: msg });

      await setStatus("✅ *Proses selesai!*");
    } catch (e) {
      await setStatus(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};