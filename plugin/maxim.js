module.exports = {
  name: "maxim",
  async run({ sock, msg, sender, args, axios }) {
    if (!args) return sock.sendMessage(sender, { text: "⚠️ Masukkan pertanyaan!" }, { quoted: msg });

    try {
      const res = await axios.post("https://api.xkiro.com/v1/chat/completions", {
        model: "minimax/minimax-m2.7-highspeed",
        messages: [
          { role: "system", content: "Kamu adalah asisten AI yang cerdas dan solutif." },
          { role: "user", content: args }
        ]
      }, {
        headers: {
          "Authorization": "Bearer sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b",
          "Content-Type": "application/json"
        }
      });

      const reply = res.data.choices[0]?.message?.content || "Tidak ada respon dari model.";
      await sock.sendMessage(sender, { text: reply }, { quoted: msg });
    } catch (e) {
      const errMsg = e.response?.data?.error?.message || e.message;
      await sock.sendMessage(sender, { text: "❌ Error: " + errMsg }, { quoted: msg });
    }
  }
};