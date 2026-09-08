const axios = require('axios');

module.exports = {
  name: "net",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const rawInput = (typeof args === 'string' ? args : args.join(' ')).trim().toLowerCase();
    const inputParts = rawInput.split(/\s+/).filter(Boolean);

    let plan = 'premium';
    let count = 1;

    for (const arg of inputParts) {
      if (['premium', 'standard', 'basic'].includes(arg)) {
        plan = arg;
      } else if (!isNaN(parseInt(arg))) {
        count = Math.min(Math.max(parseInt(arg), 1), 3);
      }
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan token..." }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    const COUNTRY_NAMES = {
      US: 'UNITED STATES', GB: 'UNITED KINGDOM', DE: 'GERMANY', FR: 'FRANCE', JP: 'JAPAN',
      KR: 'SOUTH KOREA', IN: 'INDIA', BR: 'BRAZIL', CA: 'CANADA', AU: 'AUSTRALIA',
      IT: 'ITALY', ES: 'SPAIN', MX: 'MEXICO', PH: 'PHILIPPINES', ID: 'INDONESIA',
      MY: 'MALAYSIA', TH: 'THAILAND', SG: 'SINGAPORE', TR: 'TURKEY', PL: 'POLAND',
      NL: 'NETHERLANDS', SE: 'SWEDEN', NO: 'NORWAY', DK: 'DENMARK', FI: 'FINLAND',
      PT: 'PORTUGAL', AR: 'ARGENTINA', CL: 'CHILE', CO: 'COLOMBIA', PK: 'PAKISTAN',
      BD: 'BANGLADESH', NG: 'NIGERIA', EG: 'EGYPT', ZA: 'SOUTH AFRICA', VN: 'VIETNAM',
      RU: 'RUSSIA', UA: 'UKRAINE'
    };

    const formatCountry = (code) => {
      if (!code || code === 'Unknown' || code === 'NA') return code || 'Unknown';
      return `${code} (${COUNTRY_NAMES[code] || code})`;
    };

    try {
      await setStatus(`⏳ *[2/3] Memproses ${count} token (${plan.toUpperCase()})...*`);

      const results = [];
      
      for (let i = 0; i < count; i++) {
        if (count > 1) {
          await setStatus(`⏳ *[2/3] Memproses token ke-${i + 1} dari ${count}...*`);
        }

        // Direct API approach since puppeteer is not available
        try {
          // Get session first
          const sessionRes = await axios.post('https://nftools.aroshi.my.id/api/session', {}, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!sessionRes.data.success) {
            continue;
          }
          
          const sessionToken = sessionRes.data.token;
          
          // Get token with plan
          const tokenRes = await axios.post('https://nftools.aroshi.my.id/api/random', 
            { plan: plan }, 
            {
              headers: { 
                'Content-Type': 'application/json',
                'X-NFToken-Session': sessionToken
              }
            }
          );
          
          const data = tokenRes.data;
          
          if (data.success && data.url) {
            results.push({
              success: true,
              plan: data.plan || plan,
              quality: data.quality || '—',
              country: data.country || 'Unknown',
              url: data.url,
              expires: data.expires || null,
              pool: data.pool || null
            });
          } else if (data.powChallenge) {
            // PoW challenge detected, skip for now as we can't handle complex crypto in this environment
            continue;
          }
        } catch (err) {
          console.error('[NFTOKEN ERROR]:', err.message);
          continue;
        }
      }

      if (results.length === 0) {
        return await setStatus(`❌ *Gagal membuat token Netflix!*\n_Situs target sedang membatasi request dari server/VPS ini._`);
      }

      let output = `🎉 *NETFLIX TOKEN GENERATED (${results.length}/${count})*\n`;
      output += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      results.forEach((item, idx) => {
        output += `📌 *LINK #${idx + 1}* — ${formatCountry(item.country)}\n`;
        output += `• *Plan:* ${item.plan.toUpperCase()}\n`;
        output += `• *Quality:* ${item.quality}\n`;
        output += `• *Expires:* ${item.expires || '—'}\n`;
        if (item.pool) output += `• *Pool Limit:* ${item.pool.available} tersisa\n`;
        output += `\n🔗 *URL Token:* \n${item.url}\n\n`;
      });

      output += `💡 *Cara Pakai:* Buka link di browser untuk langsung login ke akun Netflix.`;

      await setStatus(output);
    } catch (e) {
      await setStatus("❌ Terjadi kesalahan: " + e.message);
    }
  }
};