const axios = require('axios');
const FormData = require('form-data');

// Session storage for collector mode
const bananaSession = {};

module.exports = {
  name: "banana",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const command = text.split(' ')[0]?.toLowerCase() || '';
    
    // Helper to upload media
    async function uploadMedia(targetMsg) {
      try {
        const mimetype = targetMsg.imageMessage?.mimetype || 
                         targetMsg.videoMessage?.mimetype || 
                         targetMsg.stickerMessage?.mimetype;
        
        if (!mimetype || !/image/.test(mimetype)) return null;
        
        const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
        const form = new FormData();
        form.append('file', buffer, { filename: 'image.jpg' });
        form.append('type', 'permanent');
        
        const res = await axios.post('https://tmp.malvryx.dev/upload', form, {
          headers: form.getHeaders()
        });
        
        return res.data?.cdnUrl || res.data?.directUrl || null;
      } catch (e) {
        console.error('Upload error:', e);
        return null;
      }
    }

    // Determine if this is nanopro or nano command based on text content
    const isNanoPro = text.toLowerCase().startsWith('nanopro') || command === 'nanopro';
    const prompt = isNanoPro 
      ? text.replace(/^nanopro\s*/i, '').trim() 
      : text.replace(/^nano\s*/i, '').trim();

    try {
      // ==================== NANOPRO MODE ====================
      if (isNanoPro) {
        if (!bananaSession[sender]) bananaSession[sender] = { images: [] };

        // Check for done command
        if (prompt.toLowerCase().startsWith('done')) {
          const session = bananaSession[sender];
          const finalPrompt = prompt.replace(/^done\s*/i, '').trim();

          if (session.images.length < 2) {
            return sock.sendMessage(sender, { 
              text: "⚠️ *Nano-Banana Pro*\n\nPlease add at least 2 images before finishing.\n\nSend/reply images with *.banana nanopro* first." 
            }, { quoted: msg });
          }
          
          if (!finalPrompt) {
            return sock.sendMessage(sender, { 
              text: "⚠️ *Prompt Required*\n\nUsage: .banana nanopro done <your prompt>" 
            }, { quoted: msg });
          }

          await sock.sendMessage(sender, { react: { text: '🕒', key: msg.key } });
          
          let apiUrl = `https://omegatech-api.dixonomega.tech/api/ai/nanobana-pro-v3?prompt=${encodeURIComponent(finalPrompt)}`;
          session.images.forEach((url, i) => {
            apiUrl += `&image${i + 1}=${encodeURIComponent(url)}`;
          });

          const { data: initRes } = await axios.get(apiUrl);
          if (!initRes.success) throw new Error('API failed to initiate blend.');

          const taskId = initRes.task_id;
          let resultUrl = null;
          let attempts = 0;

          while (!resultUrl && attempts < 25) {
            await new Promise(r => setTimeout(r, 5000));
            const { data: check } = await axios.get(
              `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2-result?task_id=${taskId}`
            );
            
            if (check.status === 'completed' && check.image_url) {
              resultUrl = check.image_url;
              break;
            }
            if (check.status === 'failed') throw new Error('Server reported generation failure.');
            attempts++;
          }

          if (!resultUrl) throw new Error('Generation timed out after 25 attempts.');

          await sock.sendMessage(sender, {
            image: { url: resultUrl },
            caption: `🍌 *NANO-BANANA PRO SUCCESS*\n\n🖼️ *Images Blended:* ${session.images.length}\n📝 *Prompt:* ${finalPrompt}\n🚀 *Source:* Omegatech API`
          }, { quoted: msg });

          await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
          delete bananaSession[sender];
          return;
        }

        // Collector mode: add image
        let targetForUpload = null;
        if (msg.message?.imageMessage) {
          targetForUpload = msg;
        } else if (quotedMsg?.imageMessage) {
          targetForUpload = { message: quotedMsg };
        }

        if (!targetForUpload) {
          return sock.sendMessage(sender, {
            text: `📸 *Collector Mode Active*\n\nKirim atau reply gambar dengan *.banana nanopro* untuk menambah ke list.\n\nKetik *.banana nanopro done <prompt>* jika sudah selesai.\n\nGambar terkumpul: ${bananaSession[sender].images.length}/4`
          }, { quoted: msg });
        }

        const link = await uploadMedia(targetForUpload);
        if (!link) {
          return sock.sendMessage(sender, {
            text: "❌ Gagal mengupload gambar. Pastikan file adalah gambar yang valid."
          }, { quoted: msg });
        }

        if (bananaSession[sender].images.length >= 4) {
          return sock.sendMessage(sender, {
            text: "❌ *Limit Reached*\n\nMaksimal 4 gambar yang bisa dikumpulkan.\nGunakan *.banana nanopro done <prompt>* untuk memproses."
          }, { quoted: msg });
        }

        bananaSession[sender].images.push(link);
        await sock.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        return sock.sendMessage(sender, {
          text: `✅ *Image ${bananaSession[sender].images.length}/4 Added*\n\nKirim gambar lain atau ketik:\n*.banana nanopro done <prompt>*`
        }, { quoted: msg });
      }

      // ==================== NANO MODE ====================
      // Determine target message for image editing
      let targetMsg = null;
      if (msg.message?.imageMessage) {
        targetMsg = msg;
      } else if (quotedMsg?.imageMessage) {
        targetMsg = { message: quotedMsg };
      }

      const imageUrl = targetMsg ? await uploadMedia(targetMsg) : null;

      if (imageUrl) {
        // Image editing mode
        if (!prompt) {
          return sock.sendMessage(sender, {
            text: "⚠️ *Instruction Required*\n\nContoh: Reply gambar dengan *.banana make it a zombie*"
          }, { quoted: msg });
        }

        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        const { data: init } = await axios.get(
          `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}`
        );

        let resultUrl = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const { data: check } = await axios.get(
            `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2-result?task_id=${init.task_id}`
          );
          if (check.status === 'completed') {
            resultUrl = check.image_url;
            break;
          }
        }

        if (resultUrl) {
          await sock.sendMessage(sender, {
            image: { url: resultUrl },
            caption: `✨ *NANO EDIT SUCCESS*\n\n📝 *Prompt:* ${prompt}`
          }, { quoted: msg });
          await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        } else {
          await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
          return sock.sendMessage(sender, {
            text: "❌ Image edit timed out."
          }, { quoted: msg });
        }
      } else {
        // Text-to-image generation mode
        if (!prompt) {
          return sock.sendMessage(sender, {
            text: "⚠️ *Input Required*\n\nPenggunaan:\n• *.banana <prompt>* - Generate gambar dari teks\n• Reply gambar + *.banana <prompt>* - Edit gambar\n• *.banana nanopro* - Mode multi-image blending"
          }, { quoted: msg });
        }

        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const { data } = await axios.get(
          `https://omegatech-api.dixonomega.tech/api/ai/nano-banana-pro?prompt=${encodeURIComponent(prompt)}`
        );

        if (data.image) {
          await sock.sendMessage(sender, {
            image: { url: data.image },
            caption: `🍌 *NANO PRO GENERATION*\n\n📝 *Prompt:* ${prompt}`
          }, { quoted: msg });
          await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        } else {
          await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
          return sock.sendMessage(sender, {
            text: "❌ No image generated."
          }, { quoted: msg });
        }
      }
    } catch (e) {
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } }).catch(() => {});
      sock.sendMessage(sender, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
  }
};