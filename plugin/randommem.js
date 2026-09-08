const axios = require('axios');

module.exports = {
  name: "randommem",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const memes = [
      "https://c.termai.cc/i178/vwnT.jpg",
      "https://c.termai.cc/i152/0ZhiHk.jpg",
      "https://c.termai.cc/i100/0IdS.jpg",
      "https://c.termai.cc/i143/NZc4.jpg",
      "https://c.termai.cc/i172/UwUm1IF.jpg",
      "https://c.termai.cc/i152/tkmP0TH.jpg",
      "https://c.termai.cc/i153/odGTJXW.jpg",
      "https://c.termai.cc/i114/gP4.jpg",
      "https://c.termai.cc/i180/Lst.jpg",
      "https://c.termai.cc/i150/5HU.jpg",
      "https://c.termai.cc/i151/hZwZ.jpg",
      "https://c.termai.cc/i153/lLQ.jpg",
      "https://c.termai.cc/i143/8Bfi.jpg",
      "https://c.termai.cc/i106/bIt.jpg",
      "https://c.termai.cc/i184/TdnO6.jpg",
      "https://c.termai.cc/i163/DVgITee.jpg",
      "https://c.termai.cc/i106/89QLG.jpg",
      "https://c.termai.cc/i149/N4Amgs.jpg",
      "https://c.termai.cc/i173/3rSSN9.jpg",
      "https://c.termai.cc/i150/Tyoez.jpg",
      "https://c.termai.cc/i184/mSr.jpg",
      "https://c.termai.cc/i100/CAJAI.jpg",
      "https://c.termai.cc/i119/VWrH.jpg",
      "https://c.termai.cc/i170/fxisx.jpg",
      "https://c.termai.cc/i192/3Nt.jpg",
      "https://c.termai.cc/i183/dEG.jpg",
      "https://c.termai.cc/i142/6I2P.jpg",
      "https://c.termai.cc/i184/92l.jpg",
      "https://c.termai.cc/i185/B4dNhuO.jpg",
      "https://c.termai.cc/i182/oXKep.jpg",
      "https://c.termai.cc/i185/Y29zg.jpg",
      "https://c.termai.cc/i166/NtQ.jpg",
      "https://c.termai.cc/i173/ycX.jpg",
      "https://c.termai.cc/i113/epR.jpg",
      "https://c.termai.cc/i104/JNyAGV.jpg",
      "https://c.termai.cc/i192/fDR5d.jpg",
      "https://c.termai.cc/i114/yADFo0.jpg"
    ];

    try {
      const url = memes[Math.floor(Math.random() * memes.length)];
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);

      await sock.sendMessage(sender, {
        image: imageBuffer,
        caption: "Random Meme 🎲"
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(sender, { text: "❌ Gagal mengambil meme: " + e.message }, { quoted: msg });
    }
  }
};