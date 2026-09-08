const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

module.exports = {
  name: "sop",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan link Spotify atau judul lagu yang ingin diunduh!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/4] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("🔍 *[2/4] Mencari lagu di Spotidown...*");

      const resHome = await axios.get('https://spotidown.app/en6', {
        headers: {
          'User-Agent': USER_AGENT
        }
      });

      const cookies = resHome.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

      const $1 = cheerio.load(resHome.data);
      const hiddenInputs = {};
      $1('form[name="spotifyurl"] input[type="hidden"]').each((_, el) => {
        const name = $1(el).attr('name');
        const val = $1(el).attr('value') || '';
        if (name) hiddenInputs[name] = val;
      });

      const paramsAction = new URLSearchParams();
      paramsAction.append('url', text);
      for (const [k, v] of Object.entries(hiddenInputs)) {
        paramsAction.append(k, v);
      }

      await setStatus("🔄 *[3/4] Memproses data lagu...*");

      const resAction = await axios.post('https://spotidown.app/action', paramsAction.toString(), {
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': cookieHeader,
          'Referer': 'https://spotidown.app/en6',
          'Origin': 'https://spotidown.app',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const responseData = typeof resAction.data === 'string' ? JSON.parse(resAction.data) : resAction.data;

      if (responseData.error) {
        throw new Error(responseData.message || 'Gagal mencari lagu');
      }

      const $2 = cheerio.load(responseData.data);
      const firstForm = $2('form[name="submitspurl"]').first();

      if (!firstForm.length) {
        throw new Error('Lagu tidak ditemukan');
      }

      const rawData = firstForm.find('input[name="data"]').val();
      const baseVal = firstForm.find('input[name="base"]').val();
      const tokenVal = firstForm.find('input[name="token"]').val();

      let trackMeta = {};
      if (rawData) {
        try {
          const decoded = Buffer.from(rawData, 'base64').toString('utf-8');
          trackMeta = JSON.parse(decoded);
        } catch (e) {
          // ignore
        }
      }

      const paramsTrack = new URLSearchParams();
      paramsTrack.append('data', rawData);
      paramsTrack.append('base', baseVal);
      paramsTrack.append('token', tokenVal);

      const resTrack = await axios.post('https://spotidown.app/action/track', paramsTrack.toString(), {
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': cookieHeader,
          'Referer': 'https://spotidown.app/en6',
          'Origin': 'https://spotidown.app',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const trackRespData = typeof resTrack.data === 'string' ? JSON.parse(resTrack.data) : resTrack.data;
      let downloadUrl = null;
      if (!trackRespData.error && trackRespData.data) {
        const $dl = cheerio.load(trackRespData.data);
        downloadUrl = $dl('a.abutton[href]').attr('href') || null;
      }

      if (!downloadUrl) {
        throw new Error('Tidak dapat menemukan tautan unduhan');
      }

      await setStatus("🎵 *[4/4] Mengirim hasil...*");

      const result = {
        title: trackMeta.name || null,
        artist: trackMeta.artist || null,
        album: trackMeta.album || null,
        duration: trackMeta.duration || null,
        image: trackMeta.cover || null,
        download_url: downloadUrl
      };

      if (result.image) {
        await sock.sendMessage(sender, { 
          image: { url: result.image }, 
          caption: `🎶 *Judul:* ${result.title || 'Tidak diketahui'}\n🎤 *Artis:* ${result.artist || 'Tidak diketahui'}\n💿 *Album:* ${result.album || 'Tidak diketahui'}\n⏱️ *Durasi:* ${result.duration || 'Tidak diketahui'}\n\n tunggu sebentar, sedang mengirim audio...` 
        }, { quoted: msg });
      } else {
        await sock.sendMessage(sender, { 
          text: `🎶 *Judul:* ${result.title || 'Tidak diketahui'}\n🎤 *Artis:* ${result.artist || 'Tidak diketahui'}\n💿 *Album:* ${result.album || 'Tidak diketahui'}\n⏱️ *Durasi:* ${result.duration || 'Tidak diketahui'}\n\n tunggu sebentar, sedang mengirim audio...` 
        }, { quoted: msg });
      }

      await sock.sendMessage(sender, { 
        audio: { url: result.download_url }, 
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted: msg });

      await setStatus("✅ *Proses selesai!*");

    } catch (e) {
      await setStatus("❌ Gagal: " + e.message);
    }
  }
};