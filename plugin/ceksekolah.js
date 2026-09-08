const axios = require('axios');
const cheerio = require('cheerio');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

module.exports = {
  name: "ceksekolah",
  async run({ sock, msg, sender, args }) {
    const query = (typeof args === 'string' ? args : '').trim();

    if (!query) {
      return sock.sendMessage(sender, { 
        text: `⚠️ *Format Penggunaan:*\n\n.ceksekolah <nama_sekolah / NPSN>\n\nContoh:\n.ceksekolah SMAN 1 Depok\n.ceksekolah 20229165` 
      }, { quoted: msg });
    }

    await sock.sendPresenceUpdate('composing', sender);

    // 1 Pesan Live Status Tracking
    const statusMsg = await sock.sendMessage(sender, { 
      text: `🔍 *[1/3] Menghubungkan ke database referensi sekolah untuk "${query}"...*` 
    }, { quoted: msg });

    const editStatus = async (newText) => {
      try {
        await sock.sendMessage(sender, { text: newText, edit: statusMsg.key });
      } catch (e) {}
    };

    try {
      let rawSchoolData = "";

      // 1. Scraping data pencarian profil & referensi sekolah publik
      try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' kemdikbud npsn profil guru kepala sekolah program')}`;
        const searchRes = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 15000
        });

        const $ = cheerio.load(searchRes.data);
        const snippets = [];
        $('.result__snippet').each((i, el) => {
          if (i < 8) snippets.push($(el).text().trim());
        });
        rawSchoolData = snippets.join("\n---\n");
      } catch (e) {
        rawSchoolData = `Pencarian untuk sekolah: ${query}`;
      }

      await editStatus("🧠 *[2/3] Membedah struktur pimpinan, daftar guru, & program (Google Gemini 3.7 Flash)...*");

      // =========================================================================
      // MODEL AI 1: GOOGLE GEMINI 3.7 FLASH (DEEP RESEARCHER & ENTITY EXTRACTOR)
      // =========================================================================
      const geminiPrompt = `You are a Senior Education Intelligence Analyst and Open-Source Investigator (OSINT).
Tugasmu adalah menganalisis data sekolah "${query}" secara SANGAT MENDALAM, DETAIL, dan LENGKAP.

DATA MENTAH:
${rawSchoolData}

TUGAS UTAMA:
1. Identifikasi informasi dasar: Nama Resmi, NPSN, Status (Negeri/Swasta), Akreditasi, Alamat, dan Jenjang.
2. Identifikasi Struktur Kepengurusan & Pimpinan:
   - Kepala Sekolah
   - Wakil Kepala Sekolah (Kurikulum, Kesiswaan, Sarpras, Humas)
   - Komite Sekolah
3. Identifikasi Pendidik / Guru & Staf (Jika ada nama guru mapel/wali kelas yang terdata, sertakan selengkap mungkin).
4. Identifikasi Program Unggulan, Jurusan/Peminatan, dan Ekstrakurikuler.
5. Identifikasi Rekam Jejak Siswa (Pengurus OSIS/MPK atau Siswa Berprestasi yang pernah tercatat publik).

Susun analisis data mentah yang kaya fakta untuk diteruskan ke tim perangkum laporan.`;

      const geminiRes = await openai.chat.completions.create({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: geminiPrompt }]
      });

      const extractedIntel = geminiRes.choices[0]?.message?.content || "";

      await editStatus("✨ *[3/3] Menyusun laporan intelijen profil sekolah (Qwen Max)...*");

      // =========================================================================
      // MODEL AI 2: QWEN 3.8 MAX (INTELLIGENCE SYNTHESIZER & CLEAN FORMATTER)
      // =========================================================================
      const qwenPrompt = `Kamu adalah AI Penyusun Laporan Intelijen Pendidikan Profesional.
Tugasmu adalah merapikan data intelijen sekolah menjadi format laporan WhatsApp yang SANGAT DETAIL, RAPI, ESTETIK, dan MUDAH DIBACA.

DATA INTELIJEN:
${extractedIntel}

MANDATORY RULES:
- DILARANG menggunakan Markdown heading seperti '#', '##', '###'. Gunakan teks tebal kapital (bold).
- DILARANG menyisipkan watermark, nama developer, link grup, atau channel promosi.
- Buat pembagian kategori yang jelas menggunakan garis pembatas.

FORMAT OUTPUT WAJIB:
🏫 *PROFIL & DATA POKOK SEKOLAH*
• *Nama Sekolah:* (Nama lengkap)
• *NPSN / Status:* (NPSN jika ada | Negeri/Swasta)
• *Akreditasi:* (A / B / C / Terakreditasi)
• *Alamat / Lokasi:* (Alamat lengkap sekolah)

👥 *STRUKTUR PIMPINAN & JABATAN*
• *Kepala Sekolah:* (Nama Kepala Sekolah jika ditemukan)
• *Wakil Kepala Sekolah:* (Nama & bidangnya)
• *Staf / Komite:* (Nama pimpinan lainnya)

👨‍🏫 *DEWAN GURU & TENAGA PENDIDIK (TERDETEKSI)*
• (Daftar nama guru beserta mata pelajaran / peran yang teridentifikasi)

🎯 *PROGRAM UNGGULAN & KURIKULUM*
• *Kurikulum / Peminatan:* (Kurikulum Merdeka / IPA / IPS / Jurusan Kejuruan)
• *Program Prioritas:* (Program riset, keagamaan, bilingual, dll)

🏆 *ORGANISASI & SISWA BERPRESTASI*
• *Ekstrakurikuler:* (OSIS, Pramuka, Paskibra, Robotik, PMR, Seni, Olahraga)
• *Rekam Jejak Siswa / Prestasi:* (Daftar siswa juara lomba / pengurus yang terdata publik)

🏢 *FASILITAS & LINGKUNGAN*
• (Lab, Perpustakaan, Lapangan, Sarana penunjang)`;

      const qwenRes = await openai.chat.completions.create({
        model: "qwen/qwen3.8-max",
        messages: [
          { role: "system", content: qwenPrompt },
          { role: "user", content: `Susun laporan sekolah mendalam untuk: ${query}` }
        ]
      });

      const finalReport = qwenRes.choices[0]?.message?.content || "Gagal menyusun laporan profil sekolah.";

      const responseText = `🏛️ *LAPORAN INTELIJEN PROFIL SEKOLAH*
🔍 *Target:* ${query}
🤖 *Engine:* Google Gemini 3.7 Flash + Qwen 3.8 Max

━━━━━━━━━━━━━━━━━━━━
${finalReport}
━━━━━━━━━━━━━━━━━━━━`;

      await editStatus(responseText);

    } catch (err) {
      await editStatus(`❌ Gagal mengambil data profil sekolah: ${err.message}`);
    } finally {
      await sock.sendPresenceUpdate('unavailable');
    }
  }
};