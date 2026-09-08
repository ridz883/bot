const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

// Membersihkan query tracking (?si=..., dsb) agar API tidak gagal baca
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

    // 1 Pesan Live Edit Progress Tracker
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

      // 1. Ekstraksi transkrip via endpoint publik
      try {
        const trRes = await axios.get(`https://api.siputzx.my.id/api/tools/youtube-transcript?url=${encodeURIComponent(cleanUrl)}`, { timeout: 20000 });
        if (trRes.data?.data) {
          transcriptText = typeof trRes.data.data === 'string' ? trRes.data.data : JSON.stringify(trRes.data.data);
          videoTitle = trRes.data.title || videoTitle;
        }
      } catch (e1) {
        try {
          const ytRes = await axios.get(`https://widipe.com/download/ytdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 20000 });
          if (ytRes.data?.result?.title) videoTitle = ytRes.data.result.title;
        } catch (e2) {}
      }

      // 2. Ekstraksi metadata HTML jika transkrip tidak langsung tersedia
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
          transcriptText = `Judul Video: ${videoTitle}\nURL Target: ${cleanUrl}\n(Catatan: Transkrip CC otomatis tidak tersedia, analisislah topik, entitas, dan konsep utama video berdasarkan judul dan konteks materi ini).`;
        } catch (e3) {
          transcriptText = `Judul: ${videoTitle}\nURL: ${cleanUrl}`;
        }
      }

      await editStatus("🧠 *[2/3] Membedah konten video secara mendalam dengan Google Gemini 3.7 Flash...*");

      // =========================================================================
      // MODEL AI: GOOGLE GEMINI 3.7 FLASH (SUPER LONG-CONTEXT & DEEP REASONING)
      // =========================================================================
      const summaryPrompt = `You are a Senior Video Intelligence Analyst and Professional Content Synthesizer.
Tugasmu adalah menganalisis transkrip/informasi video YouTube ini dan menyusun ringkasan yang SANGAT DETAIL, MENDALAM, KOMPREHENSIF, dan TERSTRUKTUR RAPI dalam Bahasa Indonesia.

INFORMASI VIDEO:
- Judul Video: ${videoTitle}
- URL Video: ${cleanUrl}
- Data Transkrip/Konten:
${transcriptText.slice(0, 70000)}

ATURAN STRUKTUR OUTPUT (Gunakan penomoran dan bullet tebal, JANGAN gunakan Markdown heading seperti #, ##, ###):

📌 *RINGKASAN EKSEKUTIF:*
(Jelaskan secara komprehensif latar belakang, tujuan utama, dan garis besar bahasan video dalam 1-2 paragraf padat).

🔑 *POIN-POIN KUNCI & PEMBAHASAN MENDALAM:*
• *[Topik 1]*: (Uraian penjelasan detail beserta data/argumen penting yang disampaikan pembicara).
• *[Topik 2]*: (Uraian penjelasan detail beserta contoh atau studi kasus jika ada).
• *[Topik 3]*: (Uraian penjelasan detail mengenai langkah, metode, atau fakta utama).
• *[Topik 4]*: (Uraian penjelasan mendalam lainnya dari alur video).
• *[Topik 5]*: (Uraian pembahasan lanjutan atau detail tambahan yang krusial).

💡 *INSIGHT & KESIMPULAN UTAMA:*
(Rangkum 2-3 kesimpulan utama atau pelajaran praktis (takeaway) yang dapat langsung diambil dan diterapkan oleh penonton).`;

      const completion = await openai.chat.completions.create({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: summaryPrompt }]
      });

      const finalSummary = completion.choices[0]?.message?.content || "Gagal menghasilkan ringkasan video.";

      await editStatus("✨ *[3/3] Selesai! Mengirimkan ringkasan mendalam...*");

      const responseText = `🎬 *RINGKASAN VIDEO YOUTUBE*
📌 *Judul:* ${videoTitle}
🔗 *Link:* ${cleanUrl}
🤖 *Engine:* Google Gemini 3.7 Flash

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