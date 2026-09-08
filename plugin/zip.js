const axios = require('axios');

module.exports = {
  name: "zip",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    if (!text) {
      return sock.sendMessage(sender, { 
        text: `📦 *Web to ZIP Downloader*\n\nDownload any webpage as a ZIP file.\n\n📝 *Usage:*\n.zip <url>\n\n📌 *Examples:*\n.zip https://www.bilibili.tv/en/video/2005655709\n.zip https://example.com\n\n⚡ *Powered by Omegatech*` 
      }, { quoted: msg });
    }

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    if (!urlMatch) {
      return sock.sendMessage(sender, { text: '❌ Invalid URL. Please provide a valid URL.' }, { quoted: msg });
    }

    const url = urlMatch[0];

    await sock.sendMessage(sender, { text: `⏳ Processing webpage: ${url}...` }, { quoted: msg });

    try {
      const apiUrl = `https://api.omegatech.app/api/tools/webtozip?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiUrl, { timeout: 60000 });

      if (!data.success) {
        return sock.sendMessage(sender, { text: `❌ Failed to process webpage. ${data.result?.error?.text || 'Unknown error'}` }, { quoted: msg });
      }

      const result = data.result;
      const downloadUrl = result.downloadUrl;
      const filesAmount = result.copiedFilesAmount || 0;

      await sock.sendMessage(sender, { text: `📦 Downloading ZIP file... (${filesAmount} files)` }, { quoted: msg });

      const zipResponse = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 120000
      });

      const zipBuffer = Buffer.from(zipResponse.data);
      const fileName = `webpage_${Date.now()}.zip`;

      await sock.sendMessage(sender, {
        document: zipBuffer,
        mimetype: 'application/zip',
        fileName: fileName,
        caption: `📦 *Webpage Downloaded Successfully!*\n━━━━━━━━━━━━━━━━━━━━━\n🔗 *URL:* ${url}\n📄 *Files Copied:* ${filesAmount}\n📁 *File:* ${fileName}\n\n🔹 *Powered by Omegatech*`
      }, { quoted: msg });

    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Error: " + (e.message || 'Unknown error') }, { quoted: msg });
    }
  }
};