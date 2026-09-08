const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: "tempmail",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      const baseUrl = "https://generator.email";
      
      await setStatus("📧 *[2/3] Membuat email sementara...*");
      
      const headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
      };

      const res = await axios.get(`${baseUrl}/email-generator`, { 
        headers,
        validateStatus: () => true
      });

      const $ = cheerio.load(res.data);

      const user = $("#userName").val();
      const domain = $("#domainName2").val();

      if (!user || !domain) {
        throw new Error("Gagal membuat email - User atau domain tidak ditemukan");
      }

      const email = `${user}@${domain}`.toLowerCase();
      const path = `${domain.toLowerCase()}/${user.replace(/[^a-zA-Z_0-9.-]/g, "").toLowerCase()}`;

      let domains = [];
      $("#newselect .tt-suggestion p").each((i, el) => {
        const domain = $(el).attr("id");
        if (domain) domains.push(domain);
      });

      // Kirim informasi email ke pengguna
      await setStatus("✅ *[3/3] Email berhasil dibuat! Mengirimkan hasil...*");
      
      const emailInfo = `
📧 *Email Sementara Berhasil Dibuat*

📬 *Alamat Email:* ${email}
👤 *Username:* ${user}
🌐 *Domain:* ${domain}
🔗 *Inbox URL:* ${baseUrl}/${path}

📝 *Daftar Domain Tersedia:*
${domains.slice(0, 10).map(d => `- ${d}`).join('\n')}

💬 Balas pesan ini dengan perintah "tempmail cek" untuk melihat pesan masuk.`;

      await sock.sendMessage(sender, { text: emailInfo }, { quoted: msg });
      
      // Simpan email ke sesi pengguna (opsional)
      global.tempmail = global.tempmail || {};
      global.tempmail[sender] = { email, path, lastCheck: Date.now() };

    } catch (e) {
      await setStatus("❌ Gagal membuat email sementara: " + e.message);
    }
  }
};