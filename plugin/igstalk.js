const axios = require('axios');

module.exports = {
  name: "igstalk",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    if (!text) {
      return sock.sendMessage(sender, { 
        text: "⸙ *IG STALKER*\n\n⚠️ Masukkan username Instagram!\n\nContoh: .igstalk cristiano" 
      }, { quoted: msg });
    }

    const username = text.replace("@", "").trim();
    
    const statusMsg = await sock.sendMessage(sender, { 
      text: `⸙ *IG STALKER*\n\n⏳ Sedang memuat profil *@${username}*...` 
    }, { quoted: msg });

    const setStatus = async (txt) => {
      try { 
        await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); 
      } catch (e) {}
    };

    try {
      const apiKey = "kyuujir";
      const apiUrl = `https://api.kyzzz.xyz/api/stalker/ig?username=${encodeURIComponent(username)}&apikey=${apiKey}`;
      
      const { data } = await axios.get(apiUrl, { timeout: 20000 });

      if (!data || !data.status || !data.result) {
        throw new Error(`Akun Instagram @${username} tidak ditemukan atau API gagal merespons.`);
      }

      const meta = data.result.metadata || data.result;
      const avatarUrl = meta.avatar || meta.profile_pic;

      const caption = `⸙ *INSTAGRAM STALKER*\n\n` +
        `👤 *Nama:* ${meta.fullName || meta.fullname || meta.name || "-"}\n` +
        `🆔 *Username:* @${meta.username || username}\n` +
        `📝 *Bio:* ${meta.biography || meta.bio || "-"}\n` +
        `👥 *Followers:* ${meta.followers || "-"}\n` +
        `👤 *Following:* ${meta.following || "-"}\n` +
        `🖼️ *Total Post:* ${meta.posts || "-"}\n` +
        `🔗 *Link:* https://instagram.com/${meta.username || username}`;

      if (avatarUrl) {
        await setStatus("📸 *[2/3] Mengirim foto profil...*");
        
        await sock.sendMessage(sender, {
          image: { url: avatarUrl },
          caption: caption
        }, { quoted: msg });
      } else {
        await setStatus("📝 *[2/3] Mengirim informasi teks...*");
        await sock.sendMessage(sender, { text: caption }, { quoted: msg });
      }

      await setStatus("✅ *Proses selesai!*");

    } catch (err) {
      console.error("[IGSTALK ERROR]", err.message);
      await setStatus(`❌ *ERROR:* ${err.message}`);
    }
  }
};