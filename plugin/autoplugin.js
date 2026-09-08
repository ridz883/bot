const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  baseURL: 'https://api.xkiro.com/v1',
  apiKey: 'sk-xt-f8c8a9432ddccf472ad7210961813d6d62f1a28e98f4440b'
});

const pluginDir = path.join(__dirname);

module.exports = {
  name: "autoplugin",
  async run({ sock, msg, sender, args }) {
    const rawInput = (typeof args === 'string' ? args : '').trim();
    const firstSpace = rawInput.indexOf('\n') !== -1 ? rawInput.indexOf('\n') : rawInput.indexOf(' ');

    if (firstSpace === -1 || !rawInput) {
      return sock.sendMessage(sender, { 
        text: `⚠️ *Format Penggunaan:*

.autoplugin <nama_plugin>
<kode scraper mentah / ESM / Express / cURL / endpoint API & instruksi khusus Anda>` 
      }, { quoted: msg });
    }

    const cmdName = rawInput.slice(0, firstSpace).trim().toLowerCase().replace('.js', '');
    const rawContent = rawInput.slice(firstSpace).trim();

    await sock.sendPresenceUpdate('composing', sender);

    // 1 PESAN LIVE EDIT TRACKER
    const statusMsg = await sock.sendMessage(sender, { 
      text: "🔍 *[1/3] Memulai audit logika scraper & membedah endpoint...*" 
    }, { quoted: msg });

    const editStatus = async (newText) => {
      try {
        await sock.sendMessage(sender, { text: newText, edit: statusMsg.key });
      } catch (e) {}
    };

    try {
      // =========================================================================
      // TAHAP 1: DEEP AUDIT, REVERSE ENGINEERING & DIAGNOSIS (DEEPSEEK V4 PRO)
      // =========================================================================
      const auditPrompt = `You are a World-Class Reverse Engineer, Security Auditor, and Senior Backend Architect.
Your task is to thoroughly analyze the user's raw input for creating a WhatsApp Bot Baileys plugin named "${cmdName}".

USER INPUT:
${rawContent}

STRICT AUDIT MANDATES:
1. IDENTIFY DEFECTS & INCOMPATIBILITIES:
   - Check for uninstalled/forbidden native modules: require('canvas'), require('brat-canvas'), require('@napi-rs/canvas'), require('playwright'), require('puppeteer'), require('express'), require('child_process'), execSync('edge-tts'), ffmpeg.
   - Check for ESM syntax (import/export), non-Baileys bot handlers ('m.reply', 'conn.sendMessage', 'sock.reply', 'client.sendMessage'), and undefined global variables (e.g. global.kyzoapi, global.api, global.wm).
   - Check for broken scraper logic: missing browser headers/User-Agent, expired session tokens, Instagram GraphQL / YouTube cipher signature blocks, or fake throw error statements.
   - Check for invalid multipart logic like formData.getHeaders().
   - Check for watermarks, developer credits, channel links, or promotional text to be completely purged.
2. FORMULATE RESOLUTION BLUEPRINT:
   - Convert all undefined global API endpoints into direct, valid string URLs.
   - If the scraper cannot run purely on Axios due to complex anti-bot signatures, define working public REST API fallbacks (e.g. siputzx, ryzendesu, widipe, catbox, google-tts).
   - Define exact Axios request headers, buffer payloads, and Baileys downloadMediaMessage wrappers.

OUTPUT STRUCTURE:
---DIAGNOSIS---
(Tuliskan poin-poin diagnosa kesalahan kode mentah secara tajam, jujur, dan jelas dalam Bahasa Indonesia. Beritahu pengguna apa yang salah pada kode aslinya)
---BLUEPRINT---
(Technical implementation blueprint & pure logic ready for compiler)`;

      const auditRes = await openai.chat.completions.create({
        model: "deepseek/deepseek-v4-pro",
        messages: [{ role: "system", content: auditPrompt }]
      });

      const auditOutput = auditRes.choices[0]?.message?.content || "";
      let diagnosisText = "";
      let blueprintText = rawContent;

      if (auditOutput.includes("---DIAGNOSIS---") && auditOutput.includes("---BLUEPRINT---")) {
        const parts = auditOutput.split("---BLUEPRINT---");
        diagnosisText = parts[0].replace("---DIAGNOSIS---", "").trim();
        blueprintText = parts[1].trim();
      }

      await editStatus("⚡ *[2/3] Menyusun arsitektur Baileys CommonJS & konfigurasi live edit progress...*");

      // =========================================================================
      // TAHAP 2: STRICT BAILEYS CODE COMPILER (QWEN CODER PLUS)
      // =========================================================================
      const compilerPrompt = `Kamu adalah AI Senior Node.js & Baileys Bot Plugin Architect with zero tolerance for syntax errors, watermarks, or invalid modules.
Tugasmu adalah mengubah kode mentah/blueprint (termasuk ESM 'import', handler bot lain 'm.reply', 'conn.sendMessage', variabel 'global.xxx') menjadi modul CommonJS Baileys murni yang 100% siap pakai dan siap simpan untuk command "${cmdName}".

MANDATORY RULES & CONSTRAINTS (ZERO TOLERANCE):
1. LIVE STATUS PROGRESS EDITING (SANGAT PENTING):
   - JANGAN mengirim pesan status berulang-ulang yang menyampah.
   - Gunakan 1 pesan status yang terus diedit dengan pola ini:
     const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Memproses data...*" }, { quoted: msg });
     const setStatus = async (txt) => { try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {} };
     
     // Update status bertahap:
     await setStatus("📥 *[2/3] Mengunduh media...*");
     // Ketika selesai terkirim:
     await setStatus("✅ *Proses selesai!*");

2. HASILKAN CLEAN CODE ONLY (HANYA KODE MURNI):
   - DILARANG KERAS MENAMBAHKAN: Nama developer, nama channel, link saluran WhatsApp, link Telegram, link website promosi, watermark bot, teks iklan, komentar branding, atau footer promosi apa pun.
   - Hapus semua variabel branding lama (seperti wm, author, packname bawaan scraper).
   - Keluarkan HANYA teks kode murni tanpa komentar penjelas basa-basi dan TANPA markdown backticks (\`\`\`javascript ... \`\`\`).

3. STRUKTUR & HANDLER BAILEYS:
   - Baris pertama (Line 1) HARUS langsung kode require (contoh: const axios = require('axios');).
   - DILARANG menyisipkan teks command chat seperti '.addplugin ${cmdName}' di dalam file kode.
   - Konversi 'import' menjadi 'require'. Konversi 'export default' / 'handler =' menjadi:
     module.exports = { name: "${cmdName}", async run({ sock, msg, sender, args, axios, downloadMediaMessage }) { ... } }
   - JANGAN gunakan 'm.reply' atau 'conn.sendMessage', WAJIB gunakan:
     await sock.sendMessage(sender, { text: "..." }, { quoted: msg })
   - Jangan biarkan variabel global tidak terdefinisi (seperti global.kyzoapi). Ubah menjadi string URL langsung yang valid.

4. RUNTIME DEPENDENCY RESTRICTIONS (HOST CANNOT INSTALL NATIVE C++ MODULES):
   - HANYA modul bawaan ini yang diizinkan: 'axios', 'fs', 'path', 'os', 'util'.
   - FORBIDDEN: Dilarang keras require('canvas'), require('brat-canvas'), require('@napi-rs/canvas'), require('playwright'), require('puppeteer'), require('express'), require('child_process').
   - Dilarang memanggil CLI sistem seperti execSync('edge-tts'), ffmpeg via terminal.
   - NEVER call 'formData.getHeaders()'. Gunakan URLSearchParams untuk form biasa, atau buffer boundary native.

5. MEDIA HANDLING & DOWNLOADER:
   - Jika plugin membutuhkan download media (gambar/video/stiker/audio/dokumen) dari WhatsApp, WAJIB gunakan struktur wrapper Baileys yang valid ini:
     const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
     const quotedMsg = contextInfo?.quotedMessage;
     let targetMsg = null;
     if (quotedMsg) {
       targetMsg = {
         key: { remoteJid: sender, id: contextInfo.stanzaId, participant: contextInfo.participant },
         message: quotedMsg
       };
     } else if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.stickerMessage || msg.message?.documentMessage) {
       targetMsg = msg;
     }
     if (!targetMsg) return sock.sendMessage(sender, { text: "❌ Balas (reply) media yang ingin diproses!" }, { quoted: msg });
     const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage });

6. USER INTENT & FALLBACK SCRAPING:
   - Prioritaskan setiap instruksi teks pengguna di dalam input (contoh: "ini reply foto ya", "hasilnya kirim audio/vn", "output berupa dokumen", "ambil video").
   - Jika scraper mentah membutuhkan token/keamanan rumit, JANGAN lempar throw error penolakan, melainkan hubungkan ke endpoint API publik (siputzx, ryzendesu, widipe, catbox, google-tts).

FORMAT STANDAR:
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "${cmdName}",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    if (!text) {
      return sock.sendMessage(sender, { text: "❌ Masukkan judul/link yang ingin dicari!" }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(sender, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
    const setStatus = async (txt) => {
      try { await sock.sendMessage(sender, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
      await setStatus("📥 *[2/3] Memproses data/media...*");
      // Logika request/scrape
      await setStatus("✅ *[3/3] Selesai! Mengirimkan hasil...*");
    } catch (e) {
      await setStatus("❌ Terjadi kesalahan: " + e.message);
    }
  }
};`;

      const compileRes = await openai.chat.completions.create({
        model: "qwen/qwen3-coder-plus:free",
        messages: [
          { role: "system", content: compilerPrompt },
          { role: "user", content: `Compile this blueprint into a clean, bug-free Baileys CommonJS plugin with message-editing progress:\n\n${blueprintText}` }
        ]
      });

      let finalCode = compileRes.choices[0]?.message?.content || "Gagal mengompilasi kode.";
      finalCode = finalCode.replace(/^```javascript\n/, '').replace(/^```\n/, '').replace(/\n```$/, '').trim();

      if (finalCode.startsWith('.addplugin')) {
        finalCode = finalCode.split('\n').slice(1).join('\n').trim();
      }

      // =========================================================================
      // TAHAP 3: AUTO-SAVE & AUTO-ACTIVATE LANGSUNG KE FILE SYSTEM
      // =========================================================================
      const targetFilePath = path.join(pluginDir, `${cmdName}.js`);

      try {
        fs.writeFileSync(targetFilePath, finalCode);
        delete require.cache[require.resolve(targetFilePath)];

        const testPlugin = require(targetFilePath);
        if (typeof testPlugin.run !== 'function' && (!testPlugin.default || typeof testPlugin.default.run !== 'function')) {
          throw new Error("Plugin yang dihasilkan tidak memiliki fungsi handler run().");
        }

        await editStatus(`✅ *[3/3] Plugin '${cmdName}.js' berhasil dibuat, disimpan, dan LANGSUNG AKTIF!*\n\nCoba ketik perintah:\n*.${cmdName}*`);

        if (diagnosisText) {
          await sock.sendMessage(sender, {
            text: `📋 *HASIL AUDIT & DIAGNOSA KODE:*\n\n${diagnosisText}`
          }, { quoted: msg });
        }

        await sock.sendMessage(sender, { 
          text: `📄 *Source Code (${cmdName}.js):*\n\n${finalCode}` 
        }, { quoted: msg });

      } catch (saveErr) {
        if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
        await editStatus(`❌ *Gagal mengaktifkan plugin secara otomatis (Syntax Error):*\n\n${saveErr.message}`);
      }

    } catch (err) {
      await editStatus(`❌ Pipeline Error: ${err.message}`);
    } finally {
      await sock.sendPresenceUpdate('unavailable');
    }
  }
};