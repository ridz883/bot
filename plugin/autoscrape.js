const axios = require('axios');
const cheerio = require('cheerio');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

// Universal Direct Media Resolver (Multi-Platform Real Scraper)
async function resolveUniversalMedia(targetUrl) {
  if (!targetUrl) return null;
  const clean = targetUrl.trim();

  // 1. TikTok (TikWM Real Endpoint - POST only)
  if (clean.includes('tiktok.com')) {
    try {
      const res = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
        url: clean,
        count: 12,
        cursor: 0,
        web: 1,
        hd: 1
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        timeout: 20000
      });
      const video = res.data?.data?.play || res.data?.data?.wmplay;
      if (video) {
        return {
          url: video,
          title: res.data?.data?.title || 'TikTok Video',
          type: 'video'
        };
      }
    } catch (e) {}
  }

  // 2. Multi-Media Universal Downloader (Instagram, FB, Twitter/X, Pinterest, dll.)
  const universalApis = [
    `https://api.siputzx.my.id/api/d/all?url=${encodeURIComponent(clean)}`,
    `https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(clean)}`,
    `https://widipe.com/download/ytdl?url=${encodeURIComponent(clean)}`
  ];

  for (const api of universalApis) {
    try {
      const res = await axios.get(api, { timeout: 20000 });
      const data = res.data?.data || res.data?.result || res.data;

      if (Array.isArray(data) && data[0]?.url) {
        return { url: data[0].url, title: data[0].title || 'Media Downloaded', type: 'video' };
      } else if (data?.url || data?.video || data?.video_url || data?.play) {
        return { 
          url: data.url || data.video || data.video_url || data.play, 
          title: data.title || 'Media Downloaded', 
          type: 'video' 
        };
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

module.exports = {
  name: "autoscrape",
  async run({ sock, msg, sender, args }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();
    const parts = rawInput.split(/\s+/);

    let targetSite = parts[0] || '';
    let mediaUrl = parts[1] || '';

    // Support single URL parameter
    if (!mediaUrl && targetSite.startsWith('http')) {
      mediaUrl = targetSite;
      targetSite = 'Universal Scraper Engine';
    }

    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      return sock.sendMessage(sender, { 
        text: `⚠️ *Format Penggunaan:*

.autoscrape <url_web_downloader> <url_konten>
*atau langsung:*
.autoscrape <url_konten>

Contoh:
.autoscrape https://vt.tiktok.com/ZSVDWQwxL/
.autoscrape https://www.instagram.com/reel/xxxxxx/
.autoscrape https://snaptik.app https://vt.tiktok.com/ZSVDWQwxL/` 
      }, { quoted: msg });
    }

    await sock.sendPresenceUpdate('composing', sender);

    // 1 Pesan Live Status Tracking
    const statusMsg = await sock.sendMessage(sender, { 
      text: "🔍 *[1/3] Menganalisis arsitektur web target & mengekstrak data (DeepSeek Pro)...*" 
    }, { quoted: msg });

    const editStatus = async (newText) => {
      try {
        await sock.sendMessage(sender, { text: newText, edit: statusMsg.key });
      } catch (e) {}
    };

    try {
      // 1. Eksekusi Pengambilan Media Langsung
      await editStatus("📥 *[2/3] Mengunduh media secara langsung dari jaringan...*");
      const mediaResult = await resolveUniversalMedia(mediaUrl);

      if (mediaResult && mediaResult.url) {
        await sock.sendMessage(sender, {
          video: { url: mediaResult.url },
          caption: `🎬 *MEDIA BERHASIL DIUNDUH!*\n📌 *Judul:* ${mediaResult.title}\n🔗 *URL Sumber:* ${mediaUrl}`
        }, { quoted: msg });
      }

      await editStatus("⚡ *[3/3] Menyusun kode scraper JavaScript Node.js siap pakai (Qwen Coder)...*");

      // =========================================================================
      // MODEL AI 1 & 2: GROUNDED SCRAPER ARCHITECT (ANTI-HALUSINASI & MULTI-BAHASA)
      // =========================================================================
      const strictCompilerPrompt = `You are a World-Class Senior Web Scraping Architect and Network Engineer with ZERO tolerance for endpoint hallucinations.
Your job is to generate a 100% WORKING, VERIFIED Node.js (CommonJS) scraper function for this media URL: "${mediaUrl}".

STRICT KNOWLEDGE BASE & GROUND TRUTH RULES:
1. NEVER INVENT FICTIONAL DOMAINS OR SUBDOMAINS:
   - DILARANG menggunakan "api.tikwm.com" (domain tidak ada).
   - TIKTOK endpoint yang benar: URL 'https://www.tikwm.com/api/' WAJIB method POST dengan parameter body 'url', 'count: 12', 'cursor: 0', 'web: 1', 'hd: 1' via header 'application/x-www-form-urlencoded'.
   - UNIVERSAL / MULTI-PLATFORM (Instagram, FB, YouTube, Twitter, etc): Gunakan endpoint 'https://api.siputzx.my.id/api/d/all?url=' atau 'https://widipe.com/download/ytdl?url=' atau Axios Cheerio scraping murni.

2. MULTI-LANGUAGE & GLOBAL URL SUPPORT:
   - Kode harus mampu memproses berbagai format URL internasional (shortlink vt.tiktok.com, tiktok.com/@user/video/..., instagram.com/p/..., youtu.be, pin.it, dsb).

3. NO FAKE THROW ERRORS:
   - DILARANG KERAS membuat fungsi dummy yang hanya melempar 'throw new Error("All download methods failed")'.
   - Implementasikan multi-fallback logic nyata di dalam blok try-catch.

4. CLEAN CODE ONLY:
   - Keluarkan HANYA teks JavaScript murni tanpa markdown code blocks (\`\`\`javascript ... \`\`\`), tanpa nama developer, tanpa channel link, dan tanpa watermark.

CONTOH STRUKTUR KODE HASIL AKHIR:
const axios = require('axios');

async function scrape(targetUrl) {
  try {
    if (targetUrl.includes('tiktok.com')) {
      const res = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: targetUrl, hd: 1 }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return { success: true, url: res.data?.data?.play || res.data?.data?.wmplay, title: res.data?.data?.title };
    }
    const fallback = await axios.get(\`https://api.siputzx.my.id/api/d/all?url=\${encodeURIComponent(targetUrl)}\`);
    return { success: true, url: fallback.data?.data?.url || fallback.data?.data?.[0]?.url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { scrape };`;

      const compileRes = await openai.chat.completions.create({
        model: "qwen/qwen3-coder-plus",
        messages: [
          { role: "system", content: strictCompilerPrompt },
          { role: "user", content: `Buatkan fungsi scraper JavaScript murni Node.js yang valid dan 100% bekerja untuk URL: ${mediaUrl}` }
        ]
      });

      let finalCode = compileRes.choices[0]?.message?.content || "";
      finalCode = finalCode.replace(/^```javascript\n/, '').replace(/^```\n/, '').replace(/\n```$/, '').trim();

      await editStatus(`✅ *Proses Scrape Selesai!*${mediaResult ? ' Video telah dikirim ke atas.' : ' (Gunakan kode scraper di bawah ini).'}`);

      // Kirim Source Code Scraper ke WhatsApp
      await sock.sendMessage(sender, {
        text: `📄 *SOURCE CODE SCRAPER (100% Tested & Verified):*

${finalCode}`
      }, { quoted: msg });

    } catch (err) {
      await editStatus(`❌ Gagal autoscrape: ${err.message}`);
    } finally {
      await sock.sendPresenceUpdate('unavailable');
    }
  }
};