const https = require('node:https');
const crypto = require('node:crypto');

module.exports = {
  name: "shortlink",
  async run({ sock, msg, sender, args }) {
    const inputUrl = (typeof args === 'string' ? args : '').trim();
    if (!inputUrl) {
      return sock.sendMessage(sender, { text: "❌ Masukkan URL yang ingin dipendekkan!" }, { quoted: msg });
    }

    try {
      const boundary = "----geckoformboundary" + crypto.randomBytes(16).toString("hex");
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${inputUrl}\r\n--${boundary}--\r\n`;

      const options = {
        hostname: "kua.lat",
        path: "/shorten",
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": Buffer.byteLength(body),
          "x-requested-with": "XMLHttpRequest",
          "accept": "application/json, text/javascript, */*; q=0.01",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0",
          "origin": "https://kua.lat",
          "referer": "https://kua.lat/"
        }
      };

      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let parsed;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = null;
            }
            resolve({
              status: res.statusCode,
              code: res.statusCode,
              input_url: inputUrl,
              result_url: parsed?.data?.shorturl ?? null
            });
          });
        });

        req.on("error", (err) => {
          reject(err);
        });

        req.write(body);
        req.end();
      });

      if (!result.result_url) {
        return sock.sendMessage(sender, { text: "❌ Gagal memendekkan URL. Tidak ada hasil yang dikembalikan." }, { quoted: msg });
      }

      const responseText = `✅ *URL Berhasil Dipendekkan*\n\n🔗 Asli: ${result.input_url}\n✂️ Pendek: ${result.result_url}`;
      await sock.sendMessage(sender, { text: responseText }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Terjadi kesalahan: " + e.message }, { quoted: msg });
    }
  }
};