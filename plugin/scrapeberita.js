const axios = require('axios');
const cheerio = require('cheerio');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

module.exports = {
  name: "scrapeweb",
  async run({ sock, msg, sender, args }) {
    const text = (typeof args === 'string' ? args : '').trim();

    if (!text || !text.startsWith('http')) {
      return sock.sendMessage(sender, {
        text: `❌ Parameter belum lengkap.\n\nFormat:\n.scrapeweb <url_website>\n\nContoh:\n.scrapeweb https://kompas.com/artikel-berita`
      }, { quoted: msg });
    }

    await sock.sendPresenceUpdate('composing', sender);
    await sock.sendMessage(sender, { text: "🔍 Mengambil data dari web dan menganalisis..." }, { quoted: msg });

    try {
      const response = await axios.get(text, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      $('script, style, noscript, svg, header, footer, nav, iframe').remove();

      const pageTitle = $('title').text().trim() || 'No Title';
      let pageText = $('body').text().replace(/\s+/g, ' ').trim();

      if (pageText.length > 7000) {
        pageText = pageText.substring(0, 7000) + '... (konten dipotong)';
      }

      const completion = await openai.chat.completions.create({
        model: 'qwen/qwen3.8-max',
        messages: [
          {
            role: 'system',
            content: `Kamu adalah Web Scraper & Data Extractor AI.
Tugasmu adalah menganalisis teks hasil ekstraksi halaman web dan menyajikan informasinya secara terstruktur, informatif, dan padat.
Identifikasi poin-poin utama seperti: Judul, Isi Utama/Artikel, Data Penting (harga, tanggal, penulis, poin bahasan), atau Link/Referensi jika ada.`
          },
          {
            role: 'user',
            content: `URL Target: ${text}\nJudul Halaman: ${pageTitle}\n\nIsi Konten Mentah:\n${pageText}\n\nTolong ekstrak dan susun data penting dari halaman ini secara rapi.`
          }
        ]
      });

      const result = completion.choices[0]?.message?.content || 'Gagal mengekstrak data.';

      await sock.sendMessage(sender, {
        text: `🌐 *HASIL SCRAPE AI*\n*URL:* ${text}\n\n${result}`
      }, { quoted: msg });

    } catch (err) {
      console.error('[SCRAPEWEB ERROR]:', err.message);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengambil data dari web tersebut.\n\nPenyebab: ${err.message}\n(Web mungkin diproteksi Cloudflare atau memerlukan akses khusus).`
      }, { quoted: msg });
    } finally {
      await sock.sendPresenceUpdate('paused', sender);
    }
  }
};