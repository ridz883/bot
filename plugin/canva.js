const axios = require('axios');

const API_ENDPOINT = "https://zelapi.eu.cc/api/v1/canva";
const API_KEY = "zelapi-uuxqzix";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Helper untuk mengekstrak pesan error dari objek bersarang
function extractErrorMessage(err) {
  if (err.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.msg === 'string') return data.msg;
    if (typeof data.error === 'object') {
      return data.error.message || JSON.stringify(data.error);
    }
    return JSON.stringify(data, null, 2);
  }
  return err.message || 'Terjadi gangguan koneksi ke server.';
}

module.exports = {
  name: "canva",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    let rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      const helpText = `🎨 *CANVA PRO / TEAM INVITER*

*Format Penggunaan:*
• \`.canva <email_tujuan>\`

*Contoh:*
• \`.canva userbaru@gmail.com\``;

      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    let emailTarget = rawInput.split(/\s+/)[0].trim().toLowerCase();

    // Auto-fix typo titik sebelum domain umum
    if (!emailTarget.includes('@') && emailTarget.includes('.gmail.com')) {
      emailTarget = emailTarget.replace('.gmail.com', '@gmail.com');
    }

    if (!EMAIL_REGEX.test(emailTarget)) {
      return sock.sendMessage(sender, {
        text: `⚠️ *Format email tidak valid!*\nPastikan menyertakan tanda *@*\nContoh: \`.canva akun@gmail.com\``
      }, { quoted: msg });
    }

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang mengirim invite Canva Pro..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    await updateStatus(`🎨 *Mengirim invite Canva Pro ke:* \`${emailTarget}\`...`);

    try {
      const response = await axios.post(API_ENDPOINT, {
        apikey: API_KEY,
        email_cust: emailTarget,
        email: emailTarget
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 45000
      });

      const resData = response.data;
      const result = resData?.data || resData?.result || resData;

      let successMsg = `🎉 *CANVA PRO INVITE BERHASIL!*\n\n`;
      successMsg += `📧 *Email Tujuan:* \`${emailTarget}\`\n`;

      if (typeof result === 'object' && result !== null) {
        if (result.team_name || result.team) {
          successMsg += `👥 *Nama Tim:* ${result.team_name || result.team}\n`;
        }
        if (result.status) {
          successMsg += `📊 *Status:* ${result.status}\n`;
        }
        if (result.expired || result.expiry) {
          successMsg += `⏳ *Expired:* ${result.expired || result.expiry}\n`;
        }
        if (result.invite_link || result.link || result.url) {
          successMsg += `🔗 *Link Undangan Tim:*\n${result.invite_link || result.link || result.url}\n`;
        }
      }

      successMsg += `\n━━━━━━━━━━━━━━━━━━━━\n📌 *Langkah Aktivasi:*\n1. Buka kotak masuk email \`${emailTarget}\` (periksa juga folder Spam/Promosi).\n2. Klik link undangan *Join Team / Gabung Tim* dari Canva.`;

      await updateStatus(successMsg);

    } catch (err) {
      const detailError = extractErrorMessage(err);
      await updateStatus(`❌ *Gagal mengirim undangan Canva Pro:*\n${detailError}`);
    }
  }
};