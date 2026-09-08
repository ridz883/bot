const axios = require('axios');
const crypto = require('crypto');

module.exports = {
  name: "cutai",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    if (!text) {
      return sock.sendMessage(sender, { 
        text: "❌ Gunakan format: *cutai <pertanyaan>*\nContoh: cutai buatkan script python hello world" 
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

      const PAGE = "https://deepai.org/chat/ai-code";
      const API = "https://api.deepai.org/hacking_is_a_serious_crime";
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

      const myhash = (s) => crypto.createHash("md5").update(s).digest("hex");

      function generateIslandKey() {
        const r = Math.round(Math.random() * 100000000000) + "";
        const inner = UA + myhash(UA + myhash(UA + r + "hackers_become_a_little_stinkier_every_time_they_hack"));
        return "tryit-" + r + "-" + myhash(inner);
      }

      function uuidv4() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
      }

      // Ambil model default yang tersedia
      let modelId = "gpt-4o-mini"; 
      try {
        const pageRes = await axios.get(PAGE, { headers: { "user-agent": UA } });
        const html = pageRes.data;
        const m = html.match(/const\s+baseChatModes=\[([^\]]*)\]/);
        if (m) {
          const arr = JSON.parse("[" + m[1] + "]");
          const unlocked = arr.find(x => !x.locked);
          if (unlocked && unlocked.value) modelId = unlocked.value;
        }
      } catch (_) {}

      const formData = new URLSearchParams();
      formData.append("model", modelId);
      formData.append("chatHistory", JSON.stringify([{ role: "user", content: text }]));
      formData.append("chat_style", "ai-code");
      formData.append("enabled_tools", JSON.stringify(["image_generator", "image_editor"]));
      formData.append("hacker_is_stinky", "very_stinky");
      formData.append("memory_enabled", "false");
      formData.append("sensitivity_request_id", uuidv4());
      formData.append("session_uuid", uuidv4());
      formData.append("thinking_support", "1");
      formData.append("attachment_uuids", "[]");

      const res = await axios.post(API, formData.toString(), {
        headers: {
          "api-key": generateIslandKey(),
          "user-agent": UA,
          "origin": "https://deepai.org",
          "referer": "https://deepai.org/chat/ai-code",
          "content-type": "application/x-www-form-urlencoded",
          "accept": "*/*"
        },
        responseType: 'text',
        timeout: 60000
      });

      let raw = typeof res.data === 'string' ? res.data : '';
      
      // Bersihkan response dari token internal DeepAI
      let out = raw.includes("\u001C") ? raw.split("\u001C")[0] : raw;
      const s = out.indexOf("\x1dTHINKING_START");
      const e = out.indexOf("\x1dTHINKING_END");
      if (s !== -1 && e !== -1) {
        out = out.slice(0, s) + out.slice(e + "\x1dTHINKING_END".length);
      }
      
      const answer = out.trim();
      
      if (!answer) throw new Error("Response kosong dari server AI.");

      await sock.sendMessage(sender, { text: `🤖 *DeepAI Code Assistant*\n\n${answer}` }, { quoted: msg });
      await sock.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (e) {
      await sock.sendMessage(sender, { react: { text: "❌", key: msg.key } });
      sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + (e.response?.data || e.message) }, { quoted: msg });
    }
  }
};