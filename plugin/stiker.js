const sharp = require('sharp');

module.exports = {
  name: "stiker",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedImage = quotedMsg?.imageMessage;
    const isImage = msg.message?.imageMessage;

    if (!isImage && !isQuotedImage) {
      return sock.sendMessage(sender, { text: "❌ Parameter belum lengkap.\n\nFormat:\n.stiker <reply gambar>" }, { quoted: msg });
    }

    try {
      const targetMedia = isQuotedImage ? { message: { imageMessage: isQuotedImage } } : msg;
      const mediaBuffer = await downloadMediaMessage(targetMedia, 'buffer', {});

      const stickerBuffer = await sharp(mediaBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();

      await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });
    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Terjadi kesalahan saat memproses command.\n\nError ID:\nERR-" + Math.random().toString(36).substring(2, 7).toUpperCase() }, { quoted: msg });
    }
  }
};