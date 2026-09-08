const axios = require('axios');

const API_BASE = "https://zelapi.eu.cc/api/v1/netflix";
const AUTH_TOKEN = "zelapi-uuxqzix";

// Daftar negara yang didukung
const COUNTRY_MAP = {
  'id': { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  'indonesia': { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  'us': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'usa': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'sg': { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  'singapore': { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  'uk': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  'gb': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  'de': { code: 'DE', name: 'Germany (Eropa)', flag: '🇩🇪' },
  'jepang': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  'jp': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  'kr': { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  'korea': { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  'fr': { code: 'FR', name: 'France (Eropa)', flag: '🇫🇷' },
  'my': { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  'ph': { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  'th': { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  'br': { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  'in': { code: 'IN', name: 'India', flag: '🇮🇳' },
  'tr': { code: 'TR', name: 'Turkey', flag: '🇹🇷' }
};

// Helper untuk mengekstrak string cookies/link dari berbagai bentuk payload
function parseApiResponse(resData) {
  if (!resData) return { raw: '' };
  
  let target = resData.data || resData.result || resData;
  if (typeof target === 'string') {
    return { raw: target };
  }

  const email = target.email || target.user || target.username || null;
  const password = target.password || target.pass || null;
  const plan = target.plan || target.tier || target.package || null;
  const expired = target.expired || target.expiry || target.exp || null;
  
  // Link login direct (Phone / TV / Browser)
  const link = target.link || target.url || target.login_url || target.direct_link || target.web_link || null;
  const tvLink = target.tv_url || target.tv_link || target.smart_tv || null;
  const phoneLink = target.mobile_url || target.mobile_link || target.phone || null;

  // Cookie string / object
  let cookies = target.cookies || target.cookie || target.raw_cookie || target.netflix_id || null;
  if (cookies && typeof cookies === 'object') {
    cookies = JSON.stringify(cookies);
  }

  return { email, password, plan, expired, link, tvLink, phoneLink, cookies, rawObj: target };
}

module.exports = {
  name: "netflix",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();
    const subCommand = rawInput.split(/\s+/)[0]?.toLowerCase();
    const queryParam = rawInput.substring(subCommand.length).trim();

    if (!rawInput) {
      const helpText = `🎬 *NETFLIX GENERATOR & COOKIES TOOLS*

*Daftar Perintah:*
• *Generate Akun / Link / Cookie:*
  \`.netflix gen <negara/kode>\`
  _Contoh: \`.netflix gen ID\`, \`.netflix gen US\`, \`.netflix gen SG\`_

• *Convert Raw Cookies ke Link/Format Terbaca:*
  \`.netflix convert <string_cookie>\`

• *Lihat Daftar Negara:*
  \`.netflix list\``;

      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang menghubungi server..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    // =========================================================================
    // 1. LIHAT DAFTAR NEGARA (.netflix list)
    // =========================================================================
    if (subCommand === 'list') {
      let listMsg = `🌐 *DAFTAR NEGARA YANG DIDUKUNG*\n\n`;
      const seen = new Set();

      for (const key in COUNTRY_MAP) {
        const item = COUNTRY_MAP[key];
        if (!seen.has(item.code)) {
          seen.add(item.code);
          listMsg += `• ${item.flag} *${item.name}* (Kode: \`${item.code}\`)\n`;
        }
      }

      listMsg += `\n💡 *Cara Pakai:* \`.netflix gen <kode_negara>\`\n_Contoh: \`.netflix gen ID\`_`;
      return updateStatus(listMsg);
    }

    // =========================================================================
    // 2. CONVERT COOKIES (.netflix convert <cookies>)
    // =========================================================================
    if (subCommand === 'convert') {
      if (!queryParam) {
        return updateStatus("⚠️ Masukkan cookies yang ingin di-convert!\n*Contoh:*\n`.netflix convert NetflixId=ct%253D...`");
      }

      await updateStatus("🔄 *Mengonversi Cookies Netflix...*");

      try {
        const response = await axios.get(`${API_BASE}/convert`, {
          params: { cookies: queryParam },
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 20000
        });

        const parsed = parseApiResponse(response.data);
        let resultText = `✅ *KONVERSI COOKIES BERHASIL*\n\n`;

        if (parsed.link) resultText += `🔗 *Link Login:* ${parsed.link}\n`;
        if (parsed.plan) resultText += `💎 *Plan:* ${parsed.plan}\n`;
        if (parsed.cookies) {
          resultText += `\n🍪 *Converted Cookies:*\n\`\`\`${parsed.cookies}\`\`\`\n`;
        } else if (parsed.raw) {
          resultText += `\n📄 *Output:*\n\`\`\`${parsed.raw}\`\`\`\n`;
        }

        resultText += `\n━━━━━━━━━━━━━━━━━━━━\n💡 _Gunakan link di atas untuk login langsung atau salin cookies ke browser via Cookie-Editor._`;
        await updateStatus(resultText);

      } catch (err) {
        const errMsg = err.response?.data?.message || err.message;
        await updateStatus(`❌ *Gagal mengonversi cookies:*\n${errMsg}`);
      }
      return;
    }

    // =========================================================================
    // 3. GENERATE AKUN & LOGIN LINK (.netflix gen <negara>)
    // =========================================================================
    if (subCommand === 'gen' || subCommand === 'generate') {
      let targetCountryInput = (queryParam || 'US').toLowerCase();
      let targetCountryCode = 'US';
      let countryInfo = { code: 'US', name: 'United States', flag: '🇺🇸' };

      if (COUNTRY_MAP[targetCountryInput]) {
        countryInfo = COUNTRY_MAP[targetCountryInput];
        targetCountryCode = countryInfo.code;
      } else if (targetCountryInput.length === 2) {
        targetCountryCode = targetCountryInput.toUpperCase();
        countryInfo = { code: targetCountryCode, name: targetCountryCode, flag: '🌍' };
      }

      await updateStatus(`🍿 *Sedang generate akses Netflix untuk ${countryInfo.flag} ${countryInfo.name}...*`);

      try {
        const response = await axios.get(`${API_BASE}/generate`, {
          params: { country: targetCountryCode },
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 25000
        });

        const parsed = parseApiResponse(response.data);
        let outputText = `🎉 *NETFLIX ACCESS GENERATED!*\n\n`;
        outputText += `🌍 *Region:* ${countryInfo.flag} ${countryInfo.name} (\`${targetCountryCode}\`)\n`;

        if (parsed.plan) outputText += `💎 *Paket/Plan:* ${parsed.plan}\n`;
        if (parsed.expired) outputText += `⏳ *Expired:* ${parsed.expired}\n`;
        if (parsed.email) outputText += `📧 *Email:* \`${parsed.email}\`\n`;
        if (parsed.password) outputText += `🔑 *Password:* \`${parsed.password}\`\n`;

        // Tampilkan Direct Links jika tersedia
        if (parsed.link || parsed.phoneLink || parsed.tvLink) {
          outputText += `\n🔗 *DIRECT LOGIN LINKS:*\n`;
          if (parsed.link) outputText += `• 🌐 *Browser/PC:* ${parsed.link}\n`;
          if (parsed.phoneLink) outputText += `• 📱 *Smartphone:* ${parsed.phoneLink}\n`;
          if (parsed.tvLink) outputText += `• 📺 *Smart TV:* ${parsed.tvLink}\n`;
        }

        // Tampilkan Raw Cookies / Data
        if (parsed.cookies) {
          outputText += `\n🍪 *Cookies:*\n\`\`\`${parsed.cookies}\`\`\`\n`;
        } else if (parsed.raw && !parsed.link) {
          outputText += `\n📄 *Data/Token:*\n\`\`\`${parsed.raw}\`\`\`\n`;
        } else if (!parsed.cookies && !parsed.link && parsed.rawObj) {
          outputText += `\n📄 *Data:*\n\`\`\`${JSON.stringify(parsed.rawObj, null, 2)}\`\`\`\n`;
        }

        outputText += `\n━━━━━━━━━━━━━━━━━━━━\n📌 *Cara Pakai:*\n1. Buka *Link Browser* di atas untuk login instan, atau\n2. Gunakan ekstensi *Cookie-Editor* di browser dan *Import* cookies di atas.`;

        await updateStatus(outputText);

      } catch (err) {
        const errMsg = err.response?.data?.message || err.message;
        await updateStatus(`❌ *Gagal generate Netflix:*\n${errMsg}\n\n_Coba gunakan negara lain seperti ID, US, atau SG._`);
      }
      return;
    }

    await updateStatus(`⚠️ Format tidak dikenal. Gunakan:\n• \`.netflix gen <negara>\`\n• \`.netflix convert <cookies>\`\n• \`.netflix list\``);
  }
};