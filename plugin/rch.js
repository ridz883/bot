const axios = require('axios');
const crypto = require('crypto');

const FRONTEND_URL = 'https://kaze-reaction-wa.netlify.app';
const SUPABASE_RPC = 'https://efxbkdfimlyfbuugyykf.supabase.co/rest/v1/rpc/register_username';
const HANDSHAKE_API = 'https://anzzmodsofficial.edgeone.dev/api/v1/handshake';
const REACT_API = 'https://anzzmodsofficial.edgeone.dev/api/v1/react';

const SUPABASE_KEY = 'sb_publishable_reLxUleQtK6WXE-v7ZrEhw_F0TptyNC';
const ANZZ_KEY = 'anzz_live_3d094ee553d8512535de129347755fb351cabc04f753db35';

function generateUsername() { return `usr_${crypto.randomBytes(6).toString('hex')}`; }
function generateClientId() { return `zr_${crypto.randomBytes(10).toString('hex')}`; }

module.exports = {
  name: "rch",
  async run({ sock, msg, sender, args, createStatusTracker }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();

    if (!rawInput) {
      const helpText = `🔥 *WHATSAPP CHANNEL VIP REACTION*

*Format Penggunaan:*
• \`.rch <link_wa_channel> <emoji_1> <emoji_2> ...\`

*Contoh:*
• \`.rch https://whatsapp.com/channel/0029Va... 😂 🥺 🤭\`
• \`.rch https://whatsapp.com/channel/0029Va... 🔥\``;

      return sock.sendMessage(sender, { text: helpText }, { quoted: msg });
    }

    const inputParts = rawInput.split(/\s+/);
    const targetUrl = inputParts[0];

    if (!targetUrl.includes('whatsapp.com/channel/')) {
      return sock.sendMessage(sender, {
        text: "⚠️ *Link tidak valid!* Pastikan memasukkan link WhatsApp Channel resmi."
      }, { quoted: msg });
    }

    let reactions = inputParts.slice(1).filter(e => e.trim().length > 0);
    if (reactions.length === 0) reactions = ['😂'];

    const tracker = createStatusTracker ? await createStatusTracker("⏳ _Sedang memproses VIP reaction..._") : null;
    const updateStatus = async (txt) => {
      if (tracker) await tracker.edit(txt);
      else await sock.sendMessage(sender, { text: txt }, { quoted: msg });
    };

    const username = generateUsername();
    const clientId = generateClientId();

    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'Origin': FRONTEND_URL,
      'Referer': `${FRONTEND_URL}/`,
      'Accept': '*/*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    try {
      await updateStatus(`🚀 *Mengirim Reaction...*\n🎯 *Target:* ${targetUrl}\n🎭 *Emoji:* ${reactions.join(' ')}`);

      // Step 1: Register Username via Supabase
      const step1 = await axios.post(SUPABASE_RPC, {
        p_client_id: clientId,
        p_username: username
      }, {
        headers: {
          ...commonHeaders,
          'Apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'X-Client-Info': 'supabase-js/2.112.4; runtime=web'
        },
        timeout: 20000
      });

      if (!step1.data?.success) {
        throw new Error(`Registrasi Supabase gagal: ${JSON.stringify(step1.data)}`);
      }

      // Step 2: Handshake Token EdgeOne
      const step2 = await axios.post(HANDSHAKE_API, {
        client_id: clientId
      }, {
        headers: {
          ...commonHeaders,
          'X-Api-Key': ANZZ_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      if (!step2.data?.ok || !step2.data?.token) {
        throw new Error(`Handshake EdgeOne gagal: ${JSON.stringify(step2.data)}`);
      }

      const handshakeToken = step2.data.token;

      // Step 3: Kirim VIP Reaction
      const step3 = await axios.post(REACT_API, {
        url: targetUrl,
        reactions: reactions
      }, {
        headers: {
          ...commonHeaders,
          'X-Api-Key': ANZZ_KEY,
          'X-Handshake-Token': handshakeToken,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      if (!step3.data?.ok || !step3.data?.data?.success) {
        throw new Error(`Gagal mengirim reaction: ${JSON.stringify(step3.data)}`);
      }

      const resData = step3.data.data;

      let successMsg = `✅ *VIP REACTION BERHASIL DIKIRIM!*\n\n`;
      successMsg += `🎯 *Target URL:* ${targetUrl}\n`;
      successMsg += `🎭 *Reactions:* ${reactions.join(' ')}\n`;
      successMsg += `👤 *Session User:* \`${username}\`\n`;
      if (resData.task) successMsg += `📌 *Task ID:* \`${resData.task.id || resData.task}\`\n`;

      await updateStatus(successMsg);

    } catch (err) {
      let errMsg = err.message;
      if (err.response?.data) {
        errMsg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      }
      await updateStatus(`❌ *Gagal memproses VIP Reaction:*\n\`\`\`${errMsg}\`\`\``);
    }
  }
};