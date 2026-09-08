const axios = require('axios');

const API_ENDPOINT = "https://zelapi.eu.cc/api/v1/premium/bulk";
const AUTH_TOKEN = "zelapi-uuxqzix";

// Helper generator email acak jika user hanya input angka (misal: .ambulk 5)
function generateRandomEmails(count) {
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me'];
  const emails = [];
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < count; i++) {
    let username = 'user_';
    for (let j = 0; j < 6; j++) {
      username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randDomain = domains[Math.floor(Math.random() * domains.length)];
    emails.push(`${username}${Date.now().toString().slice(-4)}@${randDomain}`);
  }
  return emails;
}

module.exports = {
  name: "ambulk",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      const helpText = `⚡ *ALIGHT MOTION PRO (BULK GENERATOR)*

*Format Penggunaan:*
• *Generate berdasarkan Jumlah (Auto Email):*
  \`.ambulk <jumlah>\`
  _Contoh: \`.ambulk 5\`_

• *Generate dengan Daftar Email Manual:*
  \`.ambulk email1@gmail.com, email2@gmail.com, email3@gmail.com\`

*Batas Maksimal:* 20 Akun per request.`;

      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang memproses permintaan bulk..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    let targetEmails = [];

    // Opsi 1: Jika input hanya angka (contoh: .ambulk 5)
    if (/^\d+$/.test(rawInput)) {
      let count = parseInt(rawInput, 10);
      if (count < 1) count = 1;
      if (count > 20) {
        return updateStatus("⚠️ Batas maksimal adalah *20 akun* per satu kali proses.");
      }
      targetEmails = generateRandomEmails(count);
    } 
    // Opsi 2: Jika input daftar email manual (dipisah koma, spasi, atau baris baru)
    else {
      const extracted = rawInput
        .split(/[,\s\n]+/)
        .map(e => e.trim())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      if (extracted.length === 0) {
        return updateStatus("⚠️ Format email tidak valid. Masukkan jumlah angka atau daftar email yang benar.");
      }

      if (extracted.length > 20) {
        return updateStatus("⚠️ Maksimal 20 email sekaligus per proses.");
      }

      targetEmails = extracted;
    }

    await updateStatus(`🚀 *Sedang memproses ${targetEmails.length} akun Alight Motion Pro ke server...*`);

    try {
      const response = await axios.post(API_ENDPOINT, {
        emails: targetEmails
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 60000
      });

      const resData = response.data;
      const results = resData?.data || resData?.result || resData?.accounts || resData;

      let successMsg = `🎉 *ALIGHT MOTION PRO BULK SUCCESS*\n`;
      successMsg += `📦 *Total Diproses:* ${targetEmails.length} Akun\n`;
      successMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Parsing respons jika berupa array akun
      if (Array.isArray(results)) {
        results.forEach((item, idx) => {
          successMsg += `*${idx + 1}.* 📧 *Email:* \`${item.email || targetEmails[idx]}\`\n`;
          if (item.password || item.pass) successMsg += `   🔑 *Password:* \`${item.password || item.pass}\`\n`;
          if (item.status) successMsg += `   📊 *Status:* ${item.status}\n`;
          if (item.expired || item.expiry) successMsg += `   ⏳ *Expired:* ${item.expired || item.expiry}\n`;
          if (item.link || item.url) successMsg += `   🔗 *Link Login:* ${item.link || item.url}\n`;
          successMsg += `\n`;
        });
      } 
      // Parsing jika respons berupa object tunggal / payload terstruktur
      else if (typeof results === 'object') {
        if (results.success_list || results.created) {
          const list = results.success_list || results.created;
          if (Array.isArray(list)) {
            list.forEach((item, idx) => {
              successMsg += `*${idx + 1}.* \`${typeof item === 'string' ? item : (item.email || JSON.stringify(item))}\`\n`;
            });
          }
        } else {
          targetEmails.forEach((email, idx) => {
            successMsg += `*${idx + 1}.* 📧 *Email:* \`${email}\`\n`;
          });
          successMsg += `\n📊 *Detail Respon:*\n\`\`\`${JSON.stringify(results, null, 2)}\`\`\`\n`;
        }
      } else {
        successMsg += `📄 *Hasil:* ${results}\n`;
      }

      successMsg += `━━━━━━━━━━━━━━━━━━━━\n💡 _Gunakan akun di atas untuk login ke aplikasi Alight Motion._`;

      await updateStatus(successMsg);

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      await updateStatus(`❌ *Gagal membuat akun bulk:*\n${errMsg}`);
    }
  }
};