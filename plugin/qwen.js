module.exports = {
  name: "qwen",
  async run({ sock, msg, sender, args, axios }) {
    if (!args) return sock.sendMessage(sender, { text: "⚠️ Masukkan pertanyaan/prompt!" }, { quoted: msg });
    try {
      const res = await axios.post("https://api.xkiro.com/v1/chat/completions", {
        model: "qwen/qwen3.5-flash",
        messages: [{ role: "user", content: args }]
      }, {
        headers: {
          "Authorization": "Bearer sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b",
          "Content-Type": "application/json"
        }
      });
      const reply = res.data.choices[0]?.message?.content || "Tidak ada respons.";
      await sock.sendMessage(sender, { text: reply }, { quoted: msg });
    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Error: " + (e.response?.data?.error?.message || e.message) }, { quoted: msg });
    }
  }
};