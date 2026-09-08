const axios = require('axios');

module.exports = {
  name: "amverif",
  async run({ sock, msg, sender, args }) {
    const input = (typeof args === 'string' ? args : '').trim();
    if (!input) {
      return sock.sendMessage(sender, { text: "❌ Format salah!\nGunakan: .amverif <email>|<link>" }, { quoted: msg });
    }

    const [email, link] = input.split('|').map(v => v.trim());
    if (!email || !link) {
      return sock.sendMessage(sender, { text: "❌ Email dan link wajib diisi!\nFormat: .amverif <email>|<link>" }, { quoted: msg });
    }

    try {
      const url = `https://api.nexadev.my.id/am/verif/?key=RIDZZ&email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}`;
      const response = await axios.get(url);
      const result = response.data;

      let replyText = '';
      if (result && typeof result === 'object') {
        if (result.status === true || result.success === true) {
          replyText = `✅ Verifikasi Berhasil\n${result.message || JSON.stringify(result, null, 2)}`;
        } else {
          replyText = `❌ Verifikasi Gagal\n${result.message || JSON.stringify(result, null, 2)}`;
        }
      } else {
        replyText = String(result);
      }

      await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};