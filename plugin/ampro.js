const axios = require('axios');

const API_ENDPOINT = "https://zelapi.eu.cc/api/v1/premium/bulk";
const AUTH_TOKEN = "zelapi-uuxqzix";

// Helper generator random email jika user hanya menginput jumlah angka (misal: .ampro 5)
function generateRandomItems(count) {
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me'];
  const items = [];
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < count; i++) {
    let username = 'amuser_';
    for (let j = 0; j < 6; j++) {
      username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randDomain = domains[Math.floor(Math.random() * domains.length)];
    items.push({
      email: `${username}${Date.now().toString().slice(-4)}@${randDomain}`
    });
  }
  return items;
}

module.exports = {
  name: "ampro",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      const helpText = `⚡ *ALIGHT MOTION PRO GENERATOR*

*Format Penggunaan:*
• *Auto Generate Jumlah:*
  \`.ampro <jumlah>\`
  _Contoh: \`.ampro 3\`_

• *Input Email Manual:*
  \`.ampro user1@gmail.com, user2@gmail.com\`

• *Input Email + Link Auth:*
  \`.ampro user@gmail.com|https://alightcreative.com/auth/...\`

• *Banyak Email + Link (Pisahkan Baris / Koma):*
  \`.ampro user1@gmail.com|link1, user2@gmail.com|link2\``;

      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang memproses..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    let itemsPayload = [];

    // Opsi 1: Jika input berupa angka saja (.ampro 5)
    if (/^\d+$/.test(rawInput)) {
      let count = parseInt(rawInput, 10);
      if (count < 1) count = 1;
      if (count > 20) {
        return updateStatus("⚠️ Batas maksimal adalah *20 akun* per satu kali request.");
      }
      itemsPayload = generateRandomItems(count);
    } 
    // Opsi 2: Parsing input manual
    else {
      const lines = rawInput.split(/[\n,]+/);
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;

        if (cleanLine.includes('|')) {
          const [emailPart, linkPart] = cleanLine.split('|').map(s => s.trim());
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart)) {
            const itemObj = { email: emailPart };
            if (linkPart) itemObj.link = linkPart;
            itemsPayload.push(itemObj);
          }
        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanLine)) {
          itemsPayload.push({ email: cleanLine });
        }
      }

      if (itemsPayload.length === 0) {
        return updateStatus("⚠️ Format tidak valid. Masukkan jumlah angka atau daftar email yang valid.");
      }

      if (itemsPayload.length > 20) {
        return updateStatus("⚠️ Maksimal 20 item per satu kali request.");
      }
    }

    await updateStatus(`🚀 *Mengirim ${itemsPayload.length} data ke server Alight Motion...*`);

    try {
      const response = await axios.post(API_ENDPOINT, {
        items: itemsPayload
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 60000
      });

      const resData = response.data;
      const resultData = resData?.data || resData?.result || resData?.items || resData?.accounts || resData;

      let outputMsg = `🎉 *ALIGHT MOTION PRO BERHASIL DIPROSES*\n`;
      outputMsg += `📦 *Total Item:* ${itemsPayload.length}\n`;
      outputMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (Array.isArray(resultData)) {
        resultData.forEach((acc, idx) => {
          outputMsg += `*${idx + 1}.* 📧 *Email:* \`${acc.email || itemsPayload[idx]?.email || '-'}\`\n`;
          if (acc.password || acc.pass) outputMsg += `   🔑 *Password:* \`${acc.password || acc.pass}\`\n`;
          if (acc.status) outputMsg += `   📊 *Status:* ${acc.status}\n`;
          if (acc.plan || acc.tier) outputMsg += `   💎 *Plan:* ${acc.plan || acc.tier}\n`;
          if (acc.link || acc.auth_url || acc.url) outputMsg += `   🔗 *Link:* ${acc.link || acc.auth_url || acc.url}\n`;
          if (acc.expired || acc.expiry) outputMsg += `   ⏳ *Expired:* ${acc.expired || acc.expiry}\n`;
          outputMsg += `\n`;
        });
      } else if (typeof resultData === 'object') {
        itemsPayload.forEach((it, idx) => {
          outputMsg += `*${idx + 1}.* 📧 \`${it.email}\`\n`;
          if (it.link) outputMsg += `   🔗 _Link Auth terlampir_\n`;
        });
        outputMsg += `\n📊 *Respon Server:*\n\`\`\`${JSON.stringify(resultData, null, 2)}\`\`\`\n`;
      } else {
        outputMsg += `📄 *Output:* ${resultData}\n`;
      }

      outputMsg += `━━━━━━━━━━━━━━━━━━━━\n💡 _Gunakan akun atau link di atas untuk login ke Alight Motion Pro._`;

      await updateStatus(outputMsg);

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      await updateStatus(`❌ *Gagal memproses Alight Motion Pro:*\n${errMsg}`);
    }
  }
};