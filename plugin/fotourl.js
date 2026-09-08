const axios = require('axios');

module.exports = {
  name: "fotourl",
  async run({ sock, msg, sender, args, downloadMediaMessage }) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    let targetMedia = null;

    if (quotedMsg) {
      if (quotedMsg.imageMessage || quotedMsg.stickerMessage || quotedMsg.videoMessage || quotedMsg.documentMessage) {
        targetMedia = {
          key: {
            remoteJid: sender,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          },
          message: quotedMsg
        };
      }
    } else if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage) {
      targetMedia = msg;
    }

    if (!targetMedia) {
      return sock.sendMessage(sender, {
        text: "❌ Balas (reply) gambar/stiker yang ingin diupload, atau kirim gambar dengan caption *.fotourl*!"
      }, { quoted: msg });
    }

    await sock.sendPresenceUpdate('composing', sender);
    await sock.sendMessage(sender, { text: "⏳ Sedang mengunggah media ke ImgBB..." }, { quoted: msg });

    try {
      const buffer = await downloadMediaMessage(
        targetMedia,
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(sender, { text: "❌ Gagal mengunduh file media dari WhatsApp." }, { quoted: msg });
      }

      const base64Image = buffer.toString('base64');
      const apiKey = '7d7e45e6445e23751aa97e924dd752e7';

      const formData = new URLSearchParams();
      formData.append('image', base64Image);

      const res = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      if (!res.data || !res.data.data?.url) {
        return sock.sendMessage(sender, { text: "❌ Gagal mendapatkan URL dari ImgBB." }, { quoted: msg });
      }

      const fileData = res.data.data;
      const resultText = `🌐 *BERHASIL UPLOAD KE IMGBB*\n\n🔗 *Direct URL:* ${fileData.url}\n📄 *Viewer URL:* ${fileData.url_viewer}\n📦 *Ukuran:* ${(fileData.size / 1024).toFixed(2)} KB\n⏱ *Kadaluarsa:* Permanen`;

      await sock.sendMessage(sender, { text: resultText }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(sender, {
        text: `❌ Terjadi kesalahan saat upload: ${err.response?.data?.error?.message || err.message}`
      }, { quoted: msg });
    } finally {
      await sock.sendPresenceUpdate('paused', sender);
    }
  }
};