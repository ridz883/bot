const axios = require('axios');

module.exports = {
  name: "allbooster",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // Validasi input
    if (!text) {
      return sock.sendMessage(sender, { 
        text: "⚠️ *TikTok Booster*\n\nPlease provide a TikTok video URL\n\nExample: .allbooster https://www.tiktok.com/@username/video/123456789" 
      }, { quoted: msg });
    }

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    if (!urlMatch) {
      return sock.sendMessage(sender, { text: "❌ Invalid URL. Please provide a valid TikTok video link." }, { quoted: msg });
    }

    const tiktokUrl = urlMatch[0];

    if (!tiktokUrl.includes('tiktok.com')) {
      return sock.sendMessage(sender, { text: "❌ Please provide a valid TikTok URL." }, { quoted: msg });
    }

    try {
      await sock.sendMessage(sender, { 
        text: `🔄 *Processing your request...*\n\n📱 Boosting TikTok video:\n${tiktokUrl}` 
      }, { quoted: msg });

      const apiUrl = `https://omegatech-api.dixonomega.tech/api/Fun/Tiktok-booster?action=boost&url=${encodeURIComponent(tiktokUrl)}`;

      const response = await axios.get(apiUrl, { timeout: 30000 });

      if (!response.data.success) {
        throw new Error('API request failed');
      }

      const data = response.data.data;
      const timestamp = new Date(response.data.timestamp).toLocaleString();

      let reply = `🎯 *TIKTOK BOOSTER SUCCESS*\n\n`;
      reply += `━━━━━━━━━━━━━━━━━━━━━\n`;
      reply += `📹 *Title:* ${data.title || 'Not available'}\n`;
      reply += `👤 *Author:* ${data.author || 'Unknown'}\n`;
      reply += `🔗 *Username:* @${data.username || 'Unknown'}\n`;
      reply += `📊 *Status:* ${data.status || 'Processing'}\n`;
      reply += `━━━━━━━━━━━━━━━━━━━━━\n`;
      reply += `\n📝 *Note:* The likes and views take time to register due to personal reasons.\n`;
      reply += `\n🕐 *Timestamp:* ${timestamp}\n`;
      reply += `🔹 *Source:* ${response.data.source || 'Omegatech'}\n`;
      reply += `🔹 *Attribution:* ${response.data.attribution || '@Omegatech-01'}`;

      await sock.sendMessage(sender, { text: reply }, { quoted: msg });

    } catch (e) {
      let errorMsg = '❌ *Failed to boost TikTok video*\n\n';
      if (e.response) {
        errorMsg += `📌 Status: ${e.response.status}\n`;
        errorMsg += `📌 Error: ${e.response.data?.message || 'Unknown error'}`;
      } else if (e.request) {
        errorMsg += `📌 No response from server. Please try again later.`;
      } else {
        errorMsg += `📌 Error: ${e.message}`;
      }
      sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
    }
  }
};