const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

function cleanYouTubeUrl(urlStr) {
  if (!urlStr) return '';
  const match = urlStr.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : urlStr.trim();
}

module.exports = {
  name: "ringkas",
  async run({ sock, msg, sender, args }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      return sock.sendMessage(sender, { 
        text: `⚠️ *Format Penggunaan:*\n\n.ringkas <link_youtube>\n\nContoh:\n.ringkas https://youtu.be/8zwz2fVgfVM` 
      }, { quoted: msg });
    }

    const cleanUrl = cleanYouTubeUrl(rawInput);
    const videoIdMatch = cleanUrl.match(/[\w-]{11}/);
    const videoId = videoIdMatch ? videoIdMatch[0] : null;

    if (!videoId) {
      return sock.sendMessage(sender, { 
        text: "❌ Link YouTube tidak valid! Pastikan link video YouTube sudah benar." 
      }, { quoted: msg });
    }

    // 1 Pesan Live Edit Progress
    const statusMsg = await sock.sendMessage(sender, { 
      text: "⏳ *[1/3] Menghubungkan & mengekstrak transkrip YouTube...*" 
    }, { quoted: msg });

    const editStatus = async (newText) => {
      try {
        await sock.sendMessage(sender, { text: newText, edit: statusMsg.key });
      } catch (e) {}
    };

    try {
      let transcriptText = "";
      let videoTitle = "YouTube Video";

      // 1. Coba ambil transkrip dari multi-endpoint
      try {
        const trRes = await axios.get(`https://api.siputzx.my.id/api/tools/youtube-transcript?url=${encodeURIComponent(cleanUrl)}`, { timeout: 20000 });
        if (trRes.data?.data) {
          transcriptText = typeof trRes.data.data === 'string' ? trRes.data.data : JSON.stringify(trRes.data.data);
          videoTitle = trRes.data.title || videoTitle;
        }
      } catch (e1) {
        // Fallback transkrip
        try {
          const ytRes = await axios.get(`https://widipe.com/download/ytdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 20000 });
          if (ytRes.data?.result?.title) videoTitle = ytRes.data.result.title;
        } catch (e2) {}
      }

      // 2. Fallback HTML Scraping untuk Title & Metadata
      if (!transcriptText || transcriptText.length < 50) {
        try {
          const pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000
          });
          const titleMatch = pageRes.data.match(/<title>(.*?)<\/title>/);
          if (titleMatch) {
            videoTitle = titleMatch[1].replace('- YouTube', '').trim();
          }
          transcriptText = `Judul: ${videoTitle}\nURL:${cleanUrl}\n(Transkrip tertutup/otomatis tidak tersedia, buat ringkasan mendalam berdasarkan konteks dan topik video ini).`;
        } catch (e3) {
          transcriptText = `Judul: ${videoTitle}\nURL:${cleanUrl}`;
        }
      }

      await editStatus("🧠 *[2/3] Menyusun intisari & analisis video (Qwen AI)...*");

      const summaryPrompt = `Kamu adalah Asisten Analis Video YouTube Profesional.
Buatlah ringkasan yang sangat jelas, rinci, padat, dan mudah dipahami dalam Bahasa Indonesia berdasarkan data video berikut:

JUDUL VIDEO: ${videoTitle}
URL: ${cleanUrl}
KONTEN TRANSKRIP:
${transcriptText.slice(0, 35000)}

ATURAN FORMAT OUTPUT (Gunakan penomoran dan bullet tebal, DILARANG pakai heading tanda pagar #):
📌 *RINGKASAN UTAMA:*
(Paragraf ringkas berisi inti bahasan video)

🔑 *POIN-POIN KUNCI & PEMBAHASAN DETAIL:*
• (Poin 1: Penjelasan rinci)
• (Poin 2: Penjelasan rinci)
• (Poin 3: Penjelasan rinci)
• (Poin 4: Penjelasan rinci)

💡 *KESIMPULAN:*
(Intisari penutup yang bisa dipelajari)`;

      const completion = await openai.chat.completions.create({
        model: "qwen/qwen3.8-max",
        messages: [{ role: "system", content: summaryPrompt }]
      });

      const finalSummary = completion.choices[0]?.message?.content || "Gagal menghasilkan ringkasan video.";

      await editStatus("✨ *[3/3] Selesai! Mengirimkan ringkasan...*");

      const responseText = `🎬 *RINGKASAN VIDEO YOUTUBE*
📌 *Judul:* ${videoTitle}
🔗 *Link:* ${cleanUrl}

━━━━━━━━━━━━━━━━━━━━
${finalSummary}
━━━━━━━━━━━━━━━━━━━━`;

      await editStatus(responseText);

    } catch (err) {
      await editStatus(`❌ Gagal merangkum video: ${err.message}`);
    } finally {
      await sock.sendPresenceUpdate('unavailable');
    }
  }
};