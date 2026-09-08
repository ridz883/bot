const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  downloadMediaMessage,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { OpenAI } = require('openai');
const pino = require('pino');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

setInterval(() => {}, 1000 * 60 * 60);

// --- KONFIGURASI UTAMA ---
const OWNER_NUM = '6287883472500';
const TIMEOUT_SESSION = 2 * 60 * 1000;
const PREFIXES = ['.', '!', '/'];

let isBotStopped = false;

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

const sessions = new Map();
const plugins = new Map();
const pluginDir = path.join(__dirname, 'plugins');
const DB_PATH = path.join(__dirname, 'database');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanPhoneNumber(numStr) {
  if (!numStr) return '';
  let cleaned = String(numStr).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return cleaned;
}

function getAllSenderIdentities(msg) {
  const identities = new Set();

  if (msg.key.fromMe) {
    identities.add(cleanPhoneNumber(OWNER_NUM));
    return Array.from(identities);
  }

  const rawJids = [
    msg.key.remoteJid,
    msg.key.participant,
    msg.participant,
    msg.key.remoteJidPn,
    msg.key.participantPn
  ].filter(Boolean);

  for (const jid of rawJids) {
    if (typeof jid === 'string') {
      const pure = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (pure) {
        identities.add(pure);
        identities.add(cleanPhoneNumber(pure));
      }
    }
  }

  return Array.from(identities);
}

// --- DATABASE INISIALISASI ---
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
  
  const usersFile = path.join(DB_PATH, 'users.json');
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({ authorized: [] }, null, 2));
  }

  const pluginsFile = path.join(DB_PATH, 'plugins.json');
  if (!fs.existsSync(pluginsFile)) {
    fs.writeFileSync(pluginsFile, JSON.stringify({ lockedPlugins: [] }, null, 2));
  }
}

initDatabase();

function getFreshDB() {
  try {
    const usersRaw = fs.readFileSync(path.join(DB_PATH, 'users.json'), 'utf-8');
    const pluginsRaw = fs.readFileSync(path.join(DB_PATH, 'plugins.json'), 'utf-8');
    const users = JSON.parse(usersRaw);
    const pluginsDb = JSON.parse(pluginsRaw);
    return {
      users: users && Array.isArray(users.authorized) ? users : { authorized: [] },
      plugins: pluginsDb && Array.isArray(pluginsDb.lockedPlugins) ? pluginsDb : { lockedPlugins: [] }
    };
  } catch (e) {
    return { users: { authorized: [] }, plugins: { lockedPlugins: [] } };
  }
}

function saveUsers(data) {
  fs.writeFileSync(path.join(DB_PATH, 'users.json'), JSON.stringify(data, null, 2));
}

function savePlugins(data) {
  fs.writeFileSync(path.join(DB_PATH, 'plugins.json'), JSON.stringify(data, null, 2));
}

// --- GLOBAL ERROR HANDLER ---
async function sendGlobalError(sock, sender, msg, type, detail = '', example = '', isOwner = false) {
  let text = '';
  if (type === 'NOT_FOUND') {
    text = `❌ Command tidak ditemukan.\n\nCommand:\n.${detail}`;
  } else if (type === 'MISSING_ARGS') {
    text = `❌ Parameter belum lengkap.\n\nFormat:\n${detail}${example ? `\n\nContoh:\n${example}` : ''}`;
  } else if (type === 'INVALID_ARGS') {
    text = `❌ Parameter tidak valid.\n\n${detail}\n\nFormat:\n${example}`;
  } else if (type === 'INTERNAL') {
    const errId = `ERR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    text = isOwner 
      ? `❌ Terjadi kesalahan saat memproses command.\n\nError ID:\n${errId}\n\nDetail Error (Owner):\n${detail}`
      : `❌ Terjadi kesalahan saat memproses command.\n\nError ID:\n${errId}\n\nSilakan coba lagi.`;
  }
  
  await sock.sendPresenceUpdate('composing', sender);
  await sleep(1500);
  await sock.sendMessage(sender, { text }, { quoted: msg });
  await sock.sendPresenceUpdate('unavailable');
}

// --- SISTEM LOAD PLUGIN REAL-TIME ---
function loadPlugins() {
  if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });

  for (const key of plugins.keys()) {
    try {
      const pPath = path.join(pluginDir, `${key}.js`);
      delete require.cache[require.resolve(pPath)];
    } catch (e) {}
  }
  plugins.clear();

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(pluginDir, file);
    const cmdName = path.basename(file, '.js').toLowerCase();
    
    try {
      delete require.cache[require.resolve(filePath)];
      const plugin = require(filePath);
      if (typeof plugin.run === 'function' || (plugin.default && typeof plugin.default.run === 'function')) {
        const handler = plugin.run ? plugin : plugin.default;
        handler.name = cmdName;
        plugins.set(cmdName, handler);
      }
    } catch (err) {
      console.error(`[SYNTAX ERROR PLUGIN] File ${file} gagal dimuat:`, err.message);
    }
  }
}

let watchTimeout = null;
if (fs.existsSync(pluginDir)) {
  fs.watch(pluginDir, (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      clearTimeout(watchTimeout);
      watchTimeout = setTimeout(() => {
        loadPlugins();
      }, 200);
    }
  });
}

function getPluginsContextSummary() {
  loadPlugins();
  if (!fs.existsSync(pluginDir)) return "Belum ada plugin di folder plugins/.";
  
  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
  if (files.length === 0) return "Belum ada plugin.";

  let summary = "Daftar dan Ringkasan Source Code Seluruh Plugin Aktif Saat Ini:\n";
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(pluginDir, file), 'utf8');
      const lines = content.split('\n').slice(0, 30).join('\n');
      summary += `\n--- [PLUGIN: ${file}] ---\n${lines}\n`;
    } catch (e) {}
  }
  return summary;
}

function parseReminderTime(str) {
  const relMatch = str.match(/(\d+)\s*(menit|jam|detik|m|h|s)/i);
  if (relMatch) {
    const val = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    if (unit.startsWith('m')) return val * 60 * 1000;
    if (unit.startsWith('j') || unit.startsWith('h')) return val * 60 * 60 * 1000;
    if (unit.startsWith('s') || unit.startsWith('d')) return val * 1000;
  }

  const timeMatch = str.match(/jam\s*(\d{1,2})[:.](\d{2})/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime() - Date.now();
  }
  return null;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? `${d}h ` : ''}${h}j ${m}m${s}d`;
}

async function startBot() {
  loadPlugins();

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[SYSTEM] Inisialisasi WhatsApp Web v${version.join('.')} (Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false
  });

  // Request Pairing Code satu kali saat belum register
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const cleanNumber = cleanPhoneNumber(OWNER_NUM);
        const code = await sock.requestPairingCode(cleanNumber);
        console.log(`\n========================================`);
        console.log(`PAIRING CODE BARU: ${code?.match(/.{1,4}/g)?.join("-") || code}`);
        console.log(`========================================\n`);
      } catch (err) {
        console.error('Gagal generate pairing code:', err.message);
      }
    }, 4000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('Sesi keluar. Hapus folder auth_info lalu restart.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot WhatsApp Siap Digunakan.');
      try {
        await sock.sendPresenceUpdate('unavailable');
      } catch (e) {}
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    const msg = m.messages[0];
    if (!msg || !msg.message) return;

    const sender = msg.key.remoteJid;
    if (sender === 'status@broadcast') return;

    const text = msg.message.conversation ||
                 msg.message.extendedTextMessage?.text ||
                 msg.message.imageMessage?.caption ||
                 msg.message.videoMessage?.caption ||
                 msg.message.documentMessage?.caption ||
                 '';

    const quotedContext = msg.message.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedContext?.quotedMessage;
    const quotedMsgId = quotedContext?.stanzaId;

    const usedPrefix = PREFIXES.find(p => text.startsWith(p));
    const activeSession = sessions.get(sender);
    const isReplyToAI = Boolean(activeSession && quotedMsgId && activeSession.botMessageIds.has(quotedMsgId));

    if (!usedPrefix && !isReplyToAI) return;

    const senderIdentities = getAllSenderIdentities(msg);
    const isOwner = Boolean(msg.key.fromMe) || senderIdentities.some(id => id === cleanPhoneNumber(OWNER_NUM));
    
    const db = getFreshDB();
    const authorizedDbClean = db.users.authorized.map(n => String(n).replace(/[^0-9]/g, ''));
    const isAuthorized = isOwner || senderIdentities.some(id => authorizedDbClean.includes(id));

    const now = Date.now();

    const sendNatural = async (content) => {
      await sock.sendPresenceUpdate('composing', sender);
      await sleep(1500);
      const res = await sock.sendMessage(sender, content, { quoted: msg });
      await sock.sendPresenceUpdate('unavailable');
      return res;
    };

    // --- KONTROL STATUS BOT (.stop & .start) ---
    if (text.trim().toLowerCase() === `${usedPrefix}stop`) {
      if (!isOwner) return;
      if (isBotStopped) {
        return sendNatural({ text: '⚠️ Bot sudah dalam status nonaktif sebelumnya.' });
      }
      isBotStopped = true;
      return sendNatural({ text: '🛑 *Bot telah dinonaktifkan di WhatsApp!*\n\nBot tidak akan merespon perintah apa pun sampai Anda mengaktifkannya kembali dengan perintah *.start*.' });
    }

    if (text.trim().toLowerCase() === `${usedPrefix}start`) {
      if (!isOwner) return;
      if (!isBotStopped) {
        return sendNatural({ text: '⚠️ Bot sudah aktif dan sedang berjalan.' });
      }
      isBotStopped = false;
      return sendNatural({ text: '🟢 *Bot berhasil diaktifkan kembali!*\n\nSekarang bot siap merespon seluruh perintah seperti biasa.' });
    }

    if (isBotStopped) return;

    // Helper: Create Live Edit Status Tracker
    const createStatusTracker = async (initialText = "⏳ Sedang memproses permintaan...") => {
      const sentMsg = await sock.sendMessage(sender, { text: initialText }, { quoted: msg });
      return {
        key: sentMsg.key,
        edit: async (newText) => {
          try {
            await sock.sendMessage(sender, { text: newText, edit: sentMsg.key });
          } catch (e) {
            console.error('Failed to edit message:', e.message);
          }
        },
        delete: async () => {
          try {
            await sock.sendMessage(sender, { delete: sentMsg.key });
          } catch (e) {}
        }
      };
    };

    // --- 1. DASHBOARD / MENU ---
    if (text.trim().toLowerCase() === `${usedPrefix}menu`) {
      loadPlugins();
      const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
      const botUptime = formatUptime(process.uptime());
      const sysUptime = formatUptime(os.uptime());
      
      const activePlugins = Array.from(plugins.keys()).map(p => {
        const isLocked = db.plugins.lockedPlugins.includes(p);
        return `• ${usedPrefix}${p}${isLocked ? ' 🔒 *(Private)*' : ''}`;
      }).join('\n') || '• (Belum ada)';

      const menuText = `╭───「 *DASHBOARD & MENU BOT* 」
│
├ 👤 *Owner:* Ridho (@ridzz1730)
├ 🤖 *Model AI Utama:* Qwen (qwen3.8-max)
│
├───「 *SERVER MONITOR* 」
│ ⏱️ *Bot Uptime:* ${botUptime}
│ ⏳ *Host Uptime:* ${sysUptime}
│ 🧠 *RAM Bot:* ${memoryUsed} MB
│ 💾 *RAM Server:* ${freeMem} GB Free / ${totalMem} GB
│ ⚙️ *Platform:* ${os.type()} (${os.arch()})
│ 🟢 *Node.js:* ${process.version}
│ 📦 *Total Plugins:* ${plugins.size}
│
├───「 *COMMAND UTAMA* 」
│ 💬 *${usedPrefix}ai [pertanyaan]* : Chat AI (Paham Semua Plugin)
│ 🔍 *${usedPrefix}cekweb [link_url]* : Analisis Keamanan & Info Web
│ 📄 *${usedPrefix}ai [reply PDF]* : Rangkum file PDF
│ ⏰ *${usedPrefix}ingatkan [waktu] [pesan]* : Pasang pengingat
│ 🧠 *${usedPrefix}reset* : Reset memori obrolan
│ 🛑 *${usedPrefix}stop* : Hentikan respon bot (Owner)
│ 🟢 *${usedPrefix}start* : Aktifkan kembali bot (Owner)
│
├───「 *PERMISSION & SECURITY* 」
│ 🔒 *${usedPrefix}kunci <plugin>* : Kunci plugin (Private)
│ 🔓 *${usedPrefix}buka <plugin>* : Buka kunci plugin (Public)
│ ➕ *${usedPrefix}add <nomor/LID>* : Beri izin akses
│ ➖ *${usedPrefix}deladd <nomor/LID>* : Cabut izin akses
│
├───「 *PLUGIN MANAGER (REAL-TIME)* 」
│ 🛠️ *${usedPrefix}autoplugin [nama] [kode]* : Dual-AI Auto-converter & Auto-Save
│ ✏️ *${usedPrefix}renameplugin [lama] [baru]* : Ubah nama plugin
│ ➕ *${usedPrefix}addai [nama] [model_xkiro]* : Tambah AI baru
│ 🔗 *${usedPrefix}addget [nama] [url_api]* : Tambah API GET
│ 📝 *${usedPrefix}addplugin [nama] [kode_js]* : Simpan raw plugin
│ 🗑️ *${usedPrefix}deleteplugins [nama]* : Hapus plugin
│ 📋 *${usedPrefix}listplugin* : Daftar plugin
│
├───「 *DAFTAR PLUGINS AKTIF* 」
${activePlugins}
╰──────────────────────────`;

      await sendNatural({ text: menuText });
      return;
    }

    // --- 2. FITUR PERMISSION (OWNER ONLY) ---
    if (text.startsWith(`${usedPrefix}add `)) {
      if (!isOwner) return;
      const target = text.slice(usedPrefix.length + 4).trim().replace(/[^0-9]/g, '');
      if (!target) return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}add <nomor>`, `${usedPrefix}add 62895396028282`);

      const currentDb = getFreshDB();
      const cleanList = currentDb.users.authorized.map(n => String(n).replace(/[^0-9]/g, ''));
      
      if (!cleanList.includes(target)) {
        currentDb.users.authorized.push(target);
        saveUsers(currentDb.users);
      }
      await sendNatural({ text: `✅ Nomor berhasil ditambahkan.\n\nNomor:\n${target}\n\nStatus:\nAuthorized` });
      return;
    }

    if (text.startsWith(`${usedPrefix}deladd `)) {
      if (!isOwner) return;
      const target = text.slice(usedPrefix.length + 7).trim().replace(/[^0-9]/g, '');
      if (!target) return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}deladd <nomor>`, `${usedPrefix}deladd 62895396028282`);

      const currentDb = getFreshDB();
      currentDb.users.authorized = currentDb.users.authorized.filter(n => String(n).replace(/[^0-9]/g, '') !== target);
      saveUsers(currentDb.users);

      await sendNatural({ text: `✅ Nomor berhasil dihapus dari daftar authorized.\n\nNomor:\n${target}\n\nStatus:\nUnauthorized` });
      return;
    }

    if (text.startsWith(`${usedPrefix}kunci `)) {
      if (!isOwner) return;
      const target = text.slice(usedPrefix.length + 6).trim().toLowerCase().replace('.js', '');
      if (!target) return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}kunci <nama-plugin>`, `${usedPrefix}kunci brat`);

      loadPlugins();
      if (!plugins.has(target)) {
        await sendNatural({ text: `❌ Plugin tidak ditemukan.\n\nPlugin:\n${target}\n\nTidak ada perubahan yang dilakukan.` });
        return;
      }

      const currentDb = getFreshDB();
      if (!currentDb.plugins.lockedPlugins.includes(target)) {
        currentDb.plugins.lockedPlugins.push(target);
        savePlugins(currentDb.plugins);
      }
      await sendNatural({ text: `🔒 Plugin berhasil dikunci.\n\nPlugin:\n${target}\n\nStatus:\nPRIVATE` });
      return;
    }

    if (text.startsWith(`${usedPrefix}buka `)) {
      if (!isOwner) return;
      const target = text.slice(usedPrefix.length + 5).trim().toLowerCase().replace('.js', '');
      if (!target) return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}buka <nama-plugin>`, `${usedPrefix}buka brat`);

      const currentDb = getFreshDB();
      currentDb.plugins.lockedPlugins = currentDb.plugins.lockedPlugins.filter(p => p !== target);
      savePlugins(currentDb.plugins);

      await sendNatural({ text: `🔓 Plugin berhasil dibuka.\n\nPlugin:\n${target}\n\nStatus:\nPUBLIC` });
      return;
    }

    // --- 3. FITUR AUTO-PLUGIN ---
    if (text.startsWith(`${usedPrefix}autoplugin `)) {
      if (!isOwner) return;
      const autoPluginHandler = plugins.get('autoplugin');
      if (autoPluginHandler) {
        const rawArgs = text.slice(usedPrefix.length + 11).trim();
        await autoPluginHandler.run({ sock, msg, sender, args: rawArgs, axios, downloadMediaMessage, createStatusTracker });
      }
      return;
    }

    // --- 4. GANTI NAMA PLUGIN (.renameplugin) ---
    if (text.startsWith(`${usedPrefix}renameplugin `) || text.startsWith(`${usedPrefix}renplugin `)) {
      if (!isOwner) return;
      const cmdTag = text.startsWith(`${usedPrefix}renameplugin `) ? `${usedPrefix}renameplugin ` : `${usedPrefix}renplugin `;
      const argsList = text.slice(cmdTag.length).trim().split(/\s+/);
      const oldName = argsList[0]?.toLowerCase().replace('.js', '');
      const newName = argsList[1]?.toLowerCase().replace('.js', '');

      if (!oldName || !newName) {
        return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}renameplugin <nama_lama> <nama_baru>`, `${usedPrefix}renameplugin tt tiktok`);
      }

      const oldPath = path.join(pluginDir, `${oldName}.js`);
      const newPath = path.join(pluginDir, `${newName}.js`);

      if (!fs.existsSync(oldPath)) {
        await sendNatural({ text: `❌ Plugin tidak ditemukan.\n\nPlugin:\n${oldName}\n\nTidak ada perubahan yang dilakukan.` });
        return;
      }

      if (fs.existsSync(newPath)) {
        return sendGlobalError(sock, sender, msg, 'INVALID_ARGS', `Nama plugin '${newName}' sudah digunakan di server.`, `${usedPrefix}renameplugin <nama_lama> <nama_baru>`);
      }

      try {
        try { delete require.cache[require.resolve(oldPath)]; } catch (e) {}
        plugins.delete(oldName);
        fs.renameSync(oldPath, newPath);

        const currentDb = getFreshDB();
        if (currentDb.plugins.lockedPlugins.includes(oldName)) {
          currentDb.plugins.lockedPlugins = currentDb.plugins.lockedPlugins.map(p => p === oldName ? newName : p);
          savePlugins(currentDb.plugins);
        }

        loadPlugins();
        await sendNatural({ text: `✅ *Sukses Ganti Nama!*\n\n• Nama Lama: \`${usedPrefix}${oldName}\`\n• Nama Baru: \`${usedPrefix}${newName}\`\n\nPlugin langsung aktif sebagai: \`${usedPrefix}${newName}\`` });
      } catch (err) {
        await sendNatural({ text: `❌ Gagal rename plugin: ${err.message}` });
      }
      return;
    }

    // --- 5. FITUR TAMBAH RAW PLUGIN (.addplugin) ---
    if (text.startsWith(`${usedPrefix}addplugin `) || text.startsWith(`${usedPrefix}saveplugin `)) {
      if (!isOwner) return;
      const cmdTag = text.startsWith(`${usedPrefix}addplugin `) ? `${usedPrefix}addplugin ` : `${usedPrefix}saveplugin `;
      const parts = text.slice(cmdTag.length).trim();
      const firstSpace = parts.indexOf('\n') !== -1 ? parts.indexOf('\n') : parts.indexOf(' ');
      
      if (firstSpace === -1) {
        return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}addplugin <nama>\n<kode JavaScript>`);
      }

      const pluginName = parts.slice(0, firstSpace).trim().toLowerCase().replace('.js', '');
      const pluginCode = parts.slice(firstSpace).trim();
      const filePath = path.join(pluginDir, `${pluginName}.js`);

      if (pluginCode.includes('import ') && !pluginCode.includes('require(')) {
        await sendNatural({ 
          text: `⚠️ *Syntax Tidak Didukung!*\n\nKode yang Anda tempel menggunakan \`import ... from ...\` (ESM). Gunakan perintah \`${usedPrefix}autoplugin ${pluginName}\` agar AI mengubahnya menjadi CommonJS murni secara otomatis.` 
        });
        return;
      }

      try {
        fs.writeFileSync(filePath, pluginCode);
        delete require.cache[require.resolve(filePath)];
        
        const testPlugin = require(filePath);
        if (typeof testPlugin.run !== 'function' && (!testPlugin.default || typeof testPlugin.default.run !== 'function')) {
          throw new Error("Plugin tidak memiliki handler 'run({ sock, msg, sender, args, axios, downloadMediaMessage })'.");
        }

        loadPlugins();
        await sendNatural({ text: `✅ Plugin *${pluginName}.js* berhasil disimpan dan aktif!` });
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await sendNatural({ text: `❌ Gagal menyimpan plugin (Syntax Error):\n\n${err.message}` });
      }
      return;
    }

    // --- 6. HAPUS PLUGIN (.deleteplugins) ---
    if (text.startsWith(`${usedPrefix}delateplugins `) || text.startsWith(`${usedPrefix}deleteplugins `) || text.startsWith(`${usedPrefix}delplugin `)) {
      if (!isOwner) return;
      const cmdParam = text.trim().split(/\s+/)[1]?.toLowerCase().replace('.js', '');

      if (!cmdParam) {
        return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}deleteplugins <nama-plugin>`, `${usedPrefix}deleteplugins tiktok`);
      }

      const filePath = path.join(pluginDir, `${cmdParam}.js`);

      if (!fs.existsSync(filePath)) {
        await sendNatural({ text: `❌ Plugin tidak ditemukan.\n\nPlugin:\n${cmdParam}\n\nTidak ada perubahan yang dilakukan.` });
        return;
      }

      try {
        try { delete require.cache[require.resolve(filePath)]; } catch (e) {}
        plugins.delete(cmdParam);
        fs.unlinkSync(filePath);

        const currentDb = getFreshDB();
        if (currentDb.plugins.lockedPlugins.includes(cmdParam)) {
          currentDb.plugins.lockedPlugins = currentDb.plugins.lockedPlugins.filter(p => p !== cmdParam);
          savePlugins(currentDb.plugins);
        }

        loadPlugins();
        await sendNatural({ text: `✅ Plugin berhasil dihapus.\n\nPlugin:\n${cmdParam}\n\nFile plugin telah dihapus dan registry telah diperbarui.` });
      } catch (err) {
        await sendNatural({ text: `❌ Gagal menghapus plugin.\n\nFile ditemukan, tetapi proses penghapusan gagal.` });
      }
      return;
    }

    // --- 7. LIST PLUGIN ---
    if (text.trim().toLowerCase() === `${usedPrefix}listplugin`) {
      loadPlugins();
      const currentDb = getFreshDB();
      const list = Array.from(plugins.keys()).map(name => {
        const isLocked = currentDb.plugins.lockedPlugins.includes(name);
        return `• ${usedPrefix}${name} ${isLocked ? '🔒 *(Private)*' : ''}`;
      }).join('\n') || 'Belum ada plugin.';
      await sendNatural({ text: `📦 *Daftar Plugin Aktif:*\n\n${list}` });
      return;
    }

    // --- 8. RESET MEMORY ---
    if (text.trim().toLowerCase() === `${usedPrefix}reset`) {
      sessions.delete(sender);
      await sendNatural({ text: '🧠 *Memori percakapan berhasil direset menjadi 0!*' });
      return;
    }

    // --- 9. SMART REMINDER ---
    if (text.startsWith(`${usedPrefix}ingatkan `)) {
      const reminderQuery = text.slice(usedPrefix.length + 9).trim();
      const delayMs = parseReminderTime(reminderQuery);

      if (!delayMs || delayMs <= 0) {
        return sendGlobalError(sock, sender, msg, 'MISSING_ARGS', `${usedPrefix}ingatkan <waktu> <pesan>`, `${usedPrefix}ingatkan 10 menit lagi jemur pakaian`);
      }

      await sendNatural({ text: `⏰ *Pengingat Disetel!* Terkait: "${reminderQuery}"` });

      setTimeout(async () => {
        await sock.sendPresenceUpdate('composing', sender);
        await sleep(2000);
        await sock.sendMessage(sender, { text: `🔔 *PENGINGAT WAKTU TIBA!*\n\nPesan: ${reminderQuery}` });
        await sock.sendPresenceUpdate('unavailable');
      }, delayMs);
      return;
    }

    // --- 10. EKSEKUSI PLUGIN REAL-TIME ---
    if (usedPrefix) {
      const command = text.slice(usedPrefix.length).trim().split(/\s+/)[0].toLowerCase();
      const args = text.slice(usedPrefix.length + command.length).trim();

      const reservedCmds = ['ai', 'menu', 'autoplugin', 'add', 'deladd', 'kunci', 'buka', 'addai', 'addget', 'addplugin', 'saveplugin', 'delateplugins', 'deleteplugins', 'delplugin', 'renameplugin', 'renplugin', 'listplugin', 'reset', 'ingatkan', 'stop', 'start'];
      
      if (!reservedCmds.includes(command)) {
        const targetFile = path.join(pluginDir, `${command}.js`);
        if (fs.existsSync(targetFile) && !plugins.has(command)) {
          loadPlugins();
        }

        if (plugins.has(command)) {
          const currentDb = getFreshDB();
          const isLocked = currentDb.plugins.lockedPlugins.includes(command);

          if (isLocked && !isAuthorized) {
            return await sendNatural({ 
              text: `🔒 Akses Ditolak\n\nPlugin:\n${command.toUpperCase()}\n\nPlugin ini merupakan plugin private dan hanya dapat digunakan oleh user yang telah mendapatkan akses.\n\nSilakan hubungi owner bot untuk mendapatkan akses.` 
            });
          }

          try {
            await sock.sendPresenceUpdate('composing', sender);
            const plugin = plugins.get(command);
            await plugin.run({ 
              sock, 
              msg, 
              sender, 
              args, 
              axios, 
              downloadMediaMessage,
              createStatusTracker
            });
          } catch (err) {
            console.error(`[EXEC ERROR] Plugin ${command}:`, err);
            await sendGlobalError(sock, sender, msg, 'INTERNAL', err.message, '', isOwner);
          } finally {
            try {
              await sock.sendPresenceUpdate('unavailable');
            } catch (e) {}
          }
          return;
        } else {
          return sendGlobalError(sock, sender, msg, 'NOT_FOUND', command);
        }
      }
    }

    // --- 11. AI UTAMA (QWEN - MEMBACA SELURUH ISI & STRUKTUR PLUGIN) ---
    let prompt = '';
    let isReplySession = false;

    if (text.startsWith(`${usedPrefix}ai `)) {
      prompt = text.slice(usedPrefix.length + 3).trim();
    } else if (isReplyToAI) {
      if (now - activeSession.lastActive <= TIMEOUT_SESSION) {
        isReplySession = true;
        prompt = text.trim();
      } else {
        sessions.delete(sender);
      }
    }

    const isDirectDoc = Boolean(msg.message.documentMessage);
    const isQuotedDoc = Boolean(quotedMsg?.documentMessage);
    const hasDocument = isDirectDoc || isQuotedDoc;

    if (!prompt && !hasDocument) return;

    const currentPluginsInfo = getPluginsContextSummary();
    const dynamicSystemPrompt = `
Kamu adalah asisten AI serbaguna berbasis WhatsApp yang sangat cerdas, adaptif, dan responsif.
Pembuat dan pemilikmu adalah Ridho (Ridz / @ridzz1730).
Jika ada pengguna yang menanyakan tentang pembuat atau pemilik nomor ini, jelaskan bahwa Ridho adalah seorang developer handal yang menciptakanmu.

PENGETAHUAN LENGKAP TENTANG SISTEM PLUGIN BOT SAAT INI:
${currentPluginsInfo}

TUGAS UTAMA TERKAIT PLUGIN:
1. Kamu tahu persis semua plugin yang ada di server bot saat ini, nama file-nya, fungsinya, endpoint-nya, dan cara penggunaannya.
2. Jika user bertanya "kamu punya fitur apa aja?", "plugin x buat apa?", atau minta bantuan membuat/memperbaiki plugin bot, bantu jelaskan dan perbaiki kodenya secara rinci.
3. Jawablah setiap instruksi dengan tepat, ringkas, dan jelas.
`;

    if (!sessions.has(sender) || !isReplySession) {
      sessions.set(sender, {
        lastActive: now,
        messages: [{ role: 'system', content: dynamicSystemPrompt }],
        botMessageIds: new Set()
      });
    }

    const currentSession = sessions.get(sender);
    currentSession.lastActive = now;
    currentSession.messages[0] = { role: 'system', content: dynamicSystemPrompt };

    const aiStatus = await createStatusTracker("🧠 _Sedang memikirkan jawaban..._");

    let userContent = prompt || 'Analisa dan jelaskan secara rinci.';

    try {
      if (hasDocument) {
        await aiStatus.edit("📄 _Sedang membaca & mengekstrak dokumen PDF..._");
        const docMsg = isDirectDoc ? msg.message.documentMessage : quotedMsg.documentMessage;
        if (docMsg.mimetype === 'application/pdf' || docMsg.fileName?.toLowerCase().endsWith('.pdf')) {
          const downloadTarget = isDirectDoc ? msg : {
            key: { id: quotedMsgId, remoteJid: sender },
            message: { documentMessage: quotedMsg.documentMessage }
          };

          const buffer = await downloadMediaMessage(downloadTarget, 'buffer', {});
          const parsed = await pdfParse(buffer);
          userContent = `[DOKUMEN PDF DISERTAKAN]\nIsi Teks:\n${parsed.text}\n\nInstruksi Pengguna: ${prompt || 'Rangkum isi dokumen ini.'}`;
        }
      }

      await aiStatus.edit("⚡ _tunggu ya..._");

      currentSession.messages.push({ role: 'user', content: userContent });

      if (currentSession.messages.length > 11) {
        currentSession.messages = [
          currentSession.messages[0],
          ...currentSession.messages.slice(-10)
        ];
      }

      const completion = await openai.chat.completions.create({
        model: 'qwen/qwen3.8-max:free',
        messages: currentSession.messages
      });

      const reply = completion.choices[0]?.message?.content || 'Model tidak memberikan respons.';

      await aiStatus.edit(reply);
      currentSession.botMessageIds.add(aiStatus.key.id);
      currentSession.messages.push({ role: 'assistant', content: reply });
    } catch (err) {
      console.error('[ERROR AI]:', err.message);
      await aiStatus.edit(`❌ Terjadi kesalahan: ${err.message}`);
    } finally {
      try {
        await sock.sendPresenceUpdate('unavailable');
      } catch (e) {}
    }
  });
}

startBot();