const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

module.exports = {
  name: "cekweb",
  async run({ sock, msg, sender, args }) {
    let url = (typeof args === 'string' ? args : '').trim();

    if (!url) {
      return sock.sendMessage(sender, { 
        text: `⚠️ *Format Penggunaan:*\n\n.cekweb <url_website>\n\nContoh:\n.cekweb https://instagram.com` 
      }, { quoted: msg });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const statusMsg = await sock.sendMessage(sender, { 
      text: "🔍 *[1/3] Menghubungkan & mengambil metadata website...*" 
    }, { quoted: msg });

    const editStatus = async (newText) => {
      try {
        await sock.sendMessage(sender, { text: newText, edit: statusMsg.key });
      } catch (e) {}
    };

    try {
      // Ambil Header & Konten HTML Web
      let siteData = {};
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 15000,
          maxRedirects: 5
        });

        siteData = {
          status: response.status,
          server: response.headers['server'] || 'Hidden',
          contentType: response.headers['content-type'] || 'Unknown',
          htmlSnippet: typeof response.data === 'string' ? response.data.slice(0, 4000) : 'Non-HTML Content'
        };
      } catch (fetchErr) {
        siteData = {
          status: fetchErr.response?.status || 'Unreachable',
          error: fetchErr.message,
          htmlSnippet: 'Gagal mengambil response body secara langsung.'
        };
      }

      await editStatus("🧠 *[2/3] Menganalisis keamanan, ancaman phishing, & script...*");

      // AI 1: DeepSeek v4 Pro (Pemeriksaan Keamanan Mendalam)
      const secPrompt = `You are a Senior Cyber Security Analyst and Threat Intelligence Specialist.
Analyze this target URL and website data for security threats (Phishing, Malware, Scam, Fake Login, Suspicious Scripts, Typo-squatting, or SSL/Security anomalies).

URL Target: ${url}
HTTP Status: ${siteData.status}
Server Header: ${siteData.server}
Content Snippet:
${siteData.htmlSnippet}

TASK:
Provide a strict, concise security assessment in Bahasa Indonesia:
1. Status Keamanan: (AMAN / Waspada / BAHAYA PHISHING / SCAM)
2. Tingkat Risiko: (Rendah / Sedang / Tinggi / Kritis)
3. Analisis Ancaman: (Jelaskan dalam 2-3 poin ringkas apakah ada indikasi pencurian data, script mencurigakan, atau domain palsu).`;

      const secRes = await openai.chat.completions.create({
        model: "deepseek/deepseek-v4-pro",
        messages: [{ role: "system", content: secPrompt }]
      });

      const securityReport = secRes.choices[0]?.message?.content || "Analisis keamanan selesai.";

      await editStatus("⚡ *[3/3] Merangkum detail informasi website...*");

      // AI 2: Qwen 3.8 Max (Metadata & Ringkasan Konten)
      const infoPrompt = `Kamu adalah Web Intelligence Agent.
Berdasarkan URL "${url}" dan data web berikut:
${siteData.htmlSnippet}

Tuliskan ringkasan informasi web dalam Bahasa Indonesia:
- Judul Website:
- Deskripsi / Fungsi Utama:
- Tipe Konten:`;

      const infoRes = await openai.chat.completions.create({
        model: "qwen/qwen3.8-max",
        messages: [{ role: "system", content: infoPrompt }]
      });

      const webInfoReport = infoRes.choices[0]?.message?.content || "";

      const finalReport = `🌐 *HASIL ANALISIS KEAMANAN & INFO WEBSITE*
🔗 *Target URL:* ${url}
📡 *Status HTTP:* ${siteData.status} | *Server:* ${siteData.server}

━━━━━━━━━━━━━━━━━━━━
🛡️ *HASIL AUDIT KEAMANAN (DeepSeek Pro)*
${securityReport}

━━━━━━━━━━━━━━━━━━━━
📋 *INFORMASI & IDENTITAS SITUS (Qwen Max)*
${webInfoReport}
━━━━━━━━━━━━━━━━━━━━`;

      await editStatus(finalReport);

    } catch (err) {
      await editStatus(`❌ Gagal menganalisis website: ${err.message}`);
    } finally {
      await sock.sendPresenceUpdate('unavailable');
    }
  }
};