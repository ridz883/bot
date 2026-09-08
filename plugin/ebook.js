const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

// Konfigurasi Gateway AI (Gemini Flash Model via xkiro)
const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

const AI_MODEL = 'google/gemini-2.5-flash';

// Sesi penyimpanan pencarian dan ringkasan per user
const userEbookSessions = new Map();

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}
}

function extractCleanUrl(rawUrl) {
  if (!rawUrl) return null;
  let target = rawUrl;
  if (target.startsWith('//')) target = 'https:' + target;
  
  if (target.includes('uddg=')) {
    try {
      const match = target.match(/[?&]uddg=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    } catch (e) {}
  }
  
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target;
  }
  return null;
}

// Resolver file PDF publik yang benar-benar terbuka (Bukan lending locked)
async function resolveArchivePdf(identifier) {
  try {
    const metaRes = await axios.get(`https://archive.org/metadata/${identifier}/files`, { timeout: 10000 });
    const files = metaRes.data?.result || [];
    
    // Cari file PDF terbuka asli, abaikan thumbnail dan file sistem internal
    const pdfFiles = files.filter(f => 
      f.name && 
      f.name.toLowerCase().endsWith('.pdf') && 
      !f.name.toLowerCase().includes('_thumb') &&
      !f.name.toLowerCase().includes('_jp2')
    );

    if (pdfFiles.length > 0) {
      // Prioritaskan file teks PDF utama
      const bestMatch = pdfFiles.find(f => f.format === 'Text PDF') || pdfFiles[0];
      return `https://archive.org/download/${identifier}/${encodeURIComponent(bestMatch.name)}`;
    }
  } catch (e) {}
  return null;
}

// AI Helper: Eksekusi Prompt Gemini
async function askGemini(prompt, systemInstruction = "Kamu adalah pustakawan digital & asisten analisis buku tingkat dunia.") {
  try {
    const res = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });
    return res.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[GEMINI ERROR]:', err.message);
    return null;
  }
}

module.exports = {
  name: "ebook",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      const helpText = `📚 *PERPUSTAKAAN DIGITAL AI (GEMINI POWERED)*

*Perintah yang Tersedia:*
• *Cari / Plot / Konsep:* \`.ebook <judul / deskripsi cerita>\`
• *Unduh PDF:* \`.ebook <nomor>\`
• *Chapter Breakdown (Summary):* \`.ebook summary <nomor>\`
• *Bedah Buku & Digest (Bahasa Indo):* \`.ebook bedah <nomor>\`
• *Kurator & Rekomendasi Pintar:* \`.ebook rekomendasi <kebutuhan kamu>\`

*Contoh Penggunaan:*
1. \`.ebook psychology of money\`
2. \`.ebook novel tentang orang yang terjebak di pulau sendirian\`
3. \`.ebook rekomendasi saya ingin mulai belajar investasi dari nol\`
4. \`.ebook 1\` (Unduh file)
5. \`.ebook summary 1\` (Ringkasan per bab)
6. \`.ebook bedah 1\` (Digest bahasa Indonesia)`;
      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang memproses..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    // =========================================================================
    // FITUR 1: REKOMENDASI & KURATOR PERSONAL (.ebook rekomendasi <masalah>)
    // =========================================================================
    if (rawInput.toLowerCase().startsWith('rekomendasi ') || rawInput.toLowerCase().startsWith('rekomen ')) {
      const query = rawInput.replace(/^(rekomendasi|rekomen)\s+/i, '').trim();
      await updateStatus(`🤖 *[Gemini Curator] Menganalisis kebutuhan membaca Anda untuk:* _"${query}"_...`);

      const promptRec = `Pengguna membutuhkan rekomendasi buku dengan kebutuhan/masalah: "${query}".
Berikan rekomendasi 3 BUKU TERBAIK DI DUNIA yang paling relevan.
Format output persis seperti ini:
1. *[Judul Buku Asli & Penulis]*
   🎯 *Alasan Relevan:* (1 kalimat singkat)
   💡 *Intisari:* (1 kalimat singkat)
   🔍 *Keywords Pencarian:* (Judul buku yang tepat untuk dicari PDF-nya)

Setelah itu, tambahkan panduan: "Ketik \`.ebook <judul di atas>\` untuk langsung menemukan dan mengunduh berkasnya."`;

      const aiResponse = await askGemini(promptRec);
      if (aiResponse) {
        await updateStatus(`✨ *REKOMENDASI BUKU UNTUK ANDA*\n\n${aiResponse}`);
      } else {
        await updateStatus(`❌ Gagal menghasilkan rekomendasi dari AI. Coba sesaat lagi.`);
      }
      return;
    }

    // =========================================================================
    // FITUR 2: CHAPTER BREAKDOWN & EXECUTIVE SUMMARY (.ebook summary <nomor>)
    // =========================================================================
    if (rawInput.toLowerCase().startsWith('summary ') || rawInput.toLowerCase().startsWith('ringkas ')) {
      const parts = rawInput.split(/\s+/);
      const targetIndex = parseInt(parts[1], 10) - 1;
      const session = userEbookSessions.get(sender);

      if (!session || !session.results || !session.results[targetIndex]) {
        return updateStatus("⚠️ *Pilihan tidak valid atau sesi pencarian kedaluwarsa.* Silakan cari buku kembali: `.ebook <judul>`");
      }

      const book = session.results[targetIndex];
      await updateStatus(`🧠 *[Gemini Summary] Menyusun ringkasan eksekutif & bab untuk:* _"${book.title}"_...`);

      const promptSummary = `Buatkan ringkasan eksekutif dan breakdown poin penting per bab/pokok bahasan untuk buku: "${book.title}".
Gunakan bahasa Indonesia yang terstruktur, elegan, dan mudah dipahami:
- 📌 *Ide Pokok & Core Message*
- 📑 *Poin Inti / Key Takeaways per Bab Utama*
- 🎯 *Actionable Insight (Penerapan di Dunia Nyata)*`;

      const summaryResult = await askGemini(promptSummary);
      if (summaryResult) {
        await updateStatus(`📖 *EXECUTIVE SUMMARY:* _${book.title}_\n\n${summaryResult}\n\n━━━━━━━━━━━━━━━━━━━━\n📥 *Ketik \`.ebook ${parts[1]}\` jika ingin mengunduh PDF lengkap.*`);
      } else {
        await updateStatus(`❌ Gagal membuat ringkasan untuk buku ini.`);
      }
      return;
    }

    // =========================================================================
    // FITUR 3: BILINGUAL TRANSLATION DIGEST / BEDAH BUKU (.ebook bedah <nomor>)
    // =========================================================================
    if (rawInput.toLowerCase().startsWith('bedah ') || rawInput.toLowerCase().startsWith('digest ')) {
      const parts = rawInput.split(/\s+/);
      const targetIndex = parseInt(parts[1], 10) - 1;
      const session = userEbookSessions.get(sender);

      if (!session || !session.results || !session.results[targetIndex]) {
        return updateStatus("⚠️ *Pilihan tidak valid atau sesi telah kedaluwarsa.* Silakan cari buku kembali: `.ebook <judul>`");
      }

      const book = session.results[targetIndex];
      await updateStatus(`🌐 *[Gemini Bedah Buku] Menerjemahkan & membedah konsep:* _"${book.title}"_...`);

      const promptBedah = `Buku ini berjudul: "${book.title}".
Jika buku ini berbahasa asing (Inggris), buatkan "Bilingual Translation Digest" ke dalam Bahasa Indonesia:
1. 💡 *Ringkasan Filosofi Utama Buku*
2. 🔑 *5 Konsep Kunci yang Wajib Dipahami* (Sertakan istilah aslinya dan penjelasannya dalam bahasa Indonesia)
3. 🚀 *Kesimpulan Praktis & Cara Menerapkannya Hari Ini*`;

      const digestResult = await askGemini(promptBedah);
      if (digestResult) {
        await updateStatus(`📚 *BEDAH BUKU & DIGEST BAHASA INDONESIA*\n📖 *Buku:* _${book.title}_\n\n${digestResult}\n\n━━━━━━━━━━━━━━━━━━━━\n📥 *Ketik \`.ebook ${parts[1]}\` untuk mengunduh PDF aslinya.*`);
      } else {
        await updateStatus(`❌ Gagal membedah buku.`);
      }
      return;
    }

    // =========================================================================
    // FITUR 4: UNDUH FILE PDF (.ebook 1, .ebook 2, dst.)
    // =========================================================================
    if (/^\d+$/.test(rawInput)) {
      const selectedIndex = parseInt(rawInput, 10) - 1;
      const session = userEbookSessions.get(sender);

      if (!session || !session.results || !session.results[selectedIndex]) {
        return updateStatus("⚠️ *Sesi pencarian tidak ditemukan atau sudah kedaluwarsa.*\nSilakan lakukan pencarian ulang dengan: `.ebook <judul buku>`");
      }

      const book = session.results[selectedIndex];
      await updateStatus(`📥 *[1/2] Mengunduh E-Book:* _${book.title}_\n_Mengambil berkas langsung dari server..._`);

      let directDownloadUrl = book.url;
      if (book.archiveId) {
        const resolved = await resolveArchivePdf(book.archiveId);
        if (resolved) directDownloadUrl = resolved;
      }

      const tempDir = os.tmpdir();
      const sanitizedTitle = book.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 35);
      const tempFilePath = path.join(tempDir, `ebook_${Date.now()}_${sanitizedTitle}.pdf`);

      try {
        const response = await axios({
          method: 'get',
          url: directDownloadUrl,
          responseType: 'stream',
          timeout: 60000,
          maxContentLength: 85 * 1024 * 1024,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*'
          }
        });

        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const stats = fs.statSync(tempFilePath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        if (stats.size > 70 * 1024 * 1024) {
          throw new Error(`Ukuran berkas (${fileSizeMB} MB) melebihi batas pengiriman dokumen WhatsApp (70 MB).`);
        }

        if (stats.size < 5 * 1024) {
          throw new Error("Berkas terkunci (memerlukan akun peminjaman perpustakaan/401/403). Silakan pilih nomor e-book lainnya.");
        }

        await updateStatus(`📤 *[2/2] Mengirim PDF (${fileSizeMB} MB) ke WhatsApp...*`);

        // AI "Read Next" Engine
        let readNextText = '';
        try {
          const promptNext = `Buku "${book.title}" baru saja diunduh. Rekomendasikan 1 judul buku lanjutan berikutnya yang setingkat lebih dalam. Berikan dalam 1 baris singkat: "Rekomendasi baca selanjutnya: [Judul]"`;
          const nextRes = await askGemini(promptNext);
          if (nextRes) readNextText = `\n\n🔮 _${nextRes}_`;
        } catch (e) {}

        const fileBuffer = fs.readFileSync(tempFilePath);

        await sock.sendMessage(sender, {
          document: fileBuffer,
          mimetype: 'application/pdf',
          fileName: `${book.title.replace(/[\/\\:*?"<>|]/g, '')}.pdf`,
          caption: `📖 *${book.title}*\n📦 *Ukuran:* ${fileSizeMB} MB\n🔗 *Sumber:* ${book.source || 'Open Library'}${readNextText}\n\n_File sementara telah dibersihkan otomatis dari server._`
        }, { quoted: msg });

        if (tracker) await tracker.delete();

      } catch (err) {
        await updateStatus(`❌ *Gagal mengunduh berkas:*\n${err.message}\n\n_Silakan coba pilih nomor lainnya dari daftar atau gunakan fitur \`.ebook summary ${rawInput}\`._`);
      } finally {
        safeDelete(tempFilePath);
      }
      return;
    }

    // =========================================================================
    // FITUR 5: SEMANTIC & PLOT SEARCH (GEMINI AI NORMALIZER + SEARCH ENGINE)
    // =========================================================================
    await updateStatus(`🤖 *[Gemini AI] Menganalisis plot, konsep, & kata kunci:* _"${rawInput}"_...`);

    let optimizedQuery = rawInput;
    let bookSnapshot = "";

    try {
      const promptAnalyze = `Pengguna mencari buku dengan input: "${rawInput}".
Tugasmu:
1. Jika input berupa deskripsi alur cerita, plot, atau konsep (misal: 'orang terjebak di pulau'), tebak judul buku resminya.
2. Jika ada typo (misal: 'psicology of money'), betulkan menjadi judul baku resminya.
3. Berikan intisari/snapshot 1 kalimat tentang buku tersebut.

Jawab HANYA dalam format JSON berikut tanpa markdown lain:
{"title": "Judul Baku Buku", "snapshot": "Intisari 1 kalimat tentang buku ini"}`;

      const aiRaw = await askGemini(promptAnalyze, "Kembalikan hanya objek JSON valid.");
      if (aiRaw) {
        const parsed = JSON.parse(aiRaw.replace(/```json|```/gi, '').trim());
        if (parsed.title) optimizedQuery = parsed.title;
        if (parsed.snapshot) bookSnapshot = parsed.snapshot;
      }
    } catch (e) {}

    await updateStatus(`🔍 *Menjelajahi internet untuk:* _"${optimizedQuery}"_...`);

    try {
      const results = [];
      const seenTitles = new Set();

      // Sumber 1: Archive.org API Open Texts
      try {
        const iaUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(optimizedQuery)}+AND+mediatype%3Atexts&fl[]=identifier,title,creator&rows=8&page=1&output=json`;
        const iaRes = await axios.get(iaUrl, { timeout: 10000 });
        const docs = iaRes.data?.response?.docs || [];

        for (const d of docs) {
          if (results.length >= 6) break;
          const directPdf = await resolveArchivePdf(d.identifier);
          if (directPdf) {
            const title = d.title || d.identifier;
            if (!seenTitles.has(title.toLowerCase())) {
              seenTitles.add(title.toLowerCase());
              results.push({
                title: title.slice(0, 70),
                url: directPdf,
                archiveId: d.identifier,
                source: 'Archive.org'
              });
            }
          }
        }
      } catch (e) {}

      // Sumber 2: DuckDuckGo Direct PDF Dorking
      try {
        const dorkQuery = `${optimizedQuery} (filetype:pdf OR ext:pdf)`;
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(dorkQuery)}`;
        const res = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          timeout: 12000
        });

        const $ = cheerio.load(res.data);
        $('.result').each((i, el) => {
          if (results.length >= 8) return;

          const titleEl = $(el).find('.result__title a');
          const rawHref = titleEl.attr('href') || '';
          const title = titleEl.text().replace(/\s+/g, ' ').trim();
          const cleanUrl = extractCleanUrl(rawHref);

          if (cleanUrl && (cleanUrl.toLowerCase().endsWith('.pdf') || cleanUrl.toLowerCase().includes('.pdf'))) {
            const cleanTitle = title.replace(/^\[PDF\]\s*/i, '').replace(/\.pdf$/i, '').trim();
            if (!seenTitles.has(cleanTitle.toLowerCase())) {
              seenTitles.add(cleanTitle.toLowerCase());
              results.push({
                title: cleanTitle.slice(0, 70),
                url: cleanUrl,
                source: new URL(cleanUrl).hostname
              });
            }
          }
        });
      } catch (e) {}

      if (results.length === 0) {
        return updateStatus(`❌ *E-book tidak ditemukan untuk:* "${optimizedQuery}".\n\n💡 *Tips:* Gunakan fitur \`.ebook rekomendasi <topik>\` untuk menemukan buku terbaik beserta panduannya.`);
      }

      userEbookSessions.set(sender, {
        results,
        timestamp: Date.now()
      });

      let listMsg = `📚 *HASIL PENCARIAN E-BOOK & PDF*\n🎯 *Judul/Topik:* _"${optimizedQuery}"_\n`;
      if (bookSnapshot) {
        listMsg += `💡 *Snapshot:* _${bookSnapshot}_\n`;
      }
      listMsg += `\n`;

      results.forEach((r, idx) => {
        listMsg += `*${idx + 1}.* 📖 *${r.title}*\n   🌐 _Sumber:_ ${r.source}\n\n`;
      });

      listMsg += `━━━━━━━━━━━━━━━━━━━━\n📥 *Ketik \`.ebook <nomor>\` untuk mengunduh PDF.*\n🧠 *Ketik \`.ebook summary <nomor>\` untuk ringkasan per bab.*\n🌐 *Ketik \`.ebook bedah <nomor>\` untuk digest bahasa Indonesia.*`;

      await updateStatus(listMsg);

    } catch (err) {
      await updateStatus(`❌ Terjadi error saat mencari e-book: ${err.message}`);
    }
  }
};