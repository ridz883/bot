const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'https://am.maulanabot.my.id',
    secretKey: process.env.ALOKMATON_SECRET || 'kontol_jangan_so_tau_ngentod_2636273',
    dbFile: path.join(__dirname, '../accounts.json')
};

const pendingOob = new Map();

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
];

let GLOBAL_COOKIES = {};

function generateFakeIP() {
    return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function makeRequest(method, url, payload = null, customHeaders = {}) {
    const headers = {
        ...customHeaders,
        'Accept': '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'X-Forwarded-For': generateFakeIP(),
        'CF-Connecting-IP': generateFakeIP()
    };

    if (payload && (method === 'POST' || method === 'PUT')) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        method,
        url,
        headers,
        data: payload,
        validateStatus: () => true,
    };

    const response = await axios(config);

    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
        (Array.isArray(setCookies) ? setCookies : [setCookies]).forEach(cookieStr => {
            const [nameValue] = cookieStr.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) GLOBAL_COOKIES[name.trim()] = value.trim();
        });
    }

    return response;
}

function getDynamicHeaders(customHeaders = {}) {
    return {
        'Accept': '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Priority': 'u=1, i',
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        'X-Requested-With': 'XMLHttpRequest',
        ...customHeaders
    };
}

async function loadAccounts() {
    try {
        if (fs.existsSync(CONFIG.dbFile)) {
            const data = fs.readFileSync(CONFIG.dbFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
    return [];
}

async function saveAccounts(accounts) {
    try {
        fs.writeFileSync(CONFIG.dbFile, JSON.stringify(accounts, null, 2));
    } catch (error) {
        console.error('Error saving accounts:', error);
    }
}

async function createNewOperatorSession() {
    const email = `operator_${Date.now()}@gmail.com`;
    const password = `Password${Math.floor(100000 + Math.random() * 900000)}`;
    
    const registerPayload = {
        email: email,
        password: password,
        returnSecureToken: true
    };

    const registerResponse = await makeRequest(
        'POST',
        'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyDGODufigYaWvP-Lg2nmzoRkKd3QbqUsR0',
        registerPayload,
        getDynamicHeaders()
    );

    if (!registerResponse.data.idToken) {
        throw new Error('Failed to create new operator account');
    }

    const account = {
        email: email,
        password: password,
        idToken: registerResponse.data.idToken,
        refreshToken: registerResponse.data.refreshToken,
        localId: registerResponse.data.localId,
        createdAt: new Date().toISOString()
    };

    const accounts = await loadAccounts();
    accounts.push(account);
    await saveAccounts(accounts);

    return account;
}

async function ensureOperatorLoggedIn() {
    let accounts = await loadAccounts();
    let operator = accounts[accounts.length - 1];

    if (!operator) {
        operator = await createNewOperatorSession();
    } else {
        try {
            const refreshPayload = {
                grant_type: 'refresh_token',
                refresh_token: operator.refreshToken
            };

            const refreshResponse = await makeRequest(
                'POST',
                'https://securetoken.googleapis.com/v1/token?key=AIzaSyDGODufigYaWvP-Lg2nmzoRkKd3QbqUsR0',
                refreshPayload,
                getDynamicHeaders({
                    'Content-Type': 'application/x-www-form-urlencoded'
                })
            );

            if (refreshResponse.data.access_token) {
                operator.idToken = refreshResponse.data.access_token;
                accounts[accounts.length - 1] = operator;
                await saveAccounts(accounts);
            } else {
                operator = await createNewOperatorSession();
            }
        } catch (error) {
            operator = await createNewOperatorSession();
        }
    }

    return operator;
}

async function sendOobLinkWithRetry(email, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const operator = await ensureOperatorLoggedIn();

            const oobPayload = {
                requestType: 'EMAIL_SIGNIN',
                email: email,
                returnOobLink: true,
                continueUrl: 'https://maulanabot.my.id/login?continue=https://maulanabot.my.id/dashboard',
                locale: 'id'
            };

            const oobResponse = await makeRequest(
                'POST',
                'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key=AIzaSyDGODufigYaWvP-Lg2nmzoRkKd3QbqUsR0',
                oobPayload,
                getDynamicHeaders({
                    'Authorization': `Bearer ${operator.idToken}`
                })
            );

            if (oobResponse.data.oobLink) {
                return oobResponse.data.oobLink;
            } else if (oobResponse.data.error?.message?.includes('TOO_MANY_ATTEMPTS')) {
                console.log(`Attempt ${attempt}: Rate limited, creating new operator account...`);
                await createNewOperatorSession();
            } else {
                throw new Error(oobResponse.data.error?.message || 'Unknown error');
            }
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
}

async function verifyOobLink(email, oobLink) {
    const match = oobLink.match(/oobCode=([^&]+)/);
    if (!match) {
        throw new Error('Invalid OOB link format');
    }
    const oobCode = match[1];

    const verifyPayload = {
        oobCode: oobCode,
        requestType: 'EMAIL_SIGNIN'
    };

    const verifyResponse = await makeRequest(
        'POST',
        'https://www.googleapis.com/identitytoolkit/v3/relyingparty/emailLinkSignin?key=AIzaSyDGODufigYaWvP-Lg2nmzoRkKd3QbqUsR0',
        verifyPayload,
        getDynamicHeaders()
    );

    if (verifyResponse.data.idToken) {
        const upgradePayload = {
            localId: verifyResponse.data.localId,
            upgradeToSignInProvider: 'password',
            password: `Password${Math.floor(100000 + Math.random() * 900000)}`
        };

        const upgradeResponse = await makeRequest(
            'POST',
            'https://www.googleapis.com/identitytoolkit/v3/relyingparty/setAccountInfo?key=AIzaSyDGODufigYaWvP-Lg2nmzoRkKd3QbqUsR0',
            upgradePayload,
            getDynamicHeaders({
                'Authorization': `Bearer ${verifyResponse.data.idToken}`
            })
        );

        return {
            success: true,
            user: {
                users: [{
                    localId: verifyResponse.data.localId,
                    email: email
                }]
            }
        };
    }

    return verifyResponse.data;
}

module.exports = {
    name: "alokmaton",
    async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
        const chatId = sender;
        const pushName = msg.pushName || 'User';
        
        const email = (typeof args === 'string' ? args : '').trim();
        if (!email) {
            return sock.sendMessage(chatId, { text: "❌ Format: .alokmaton <email>\nContoh: .alokmaton target@gmail.com" }, { quoted: msg });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sock.sendMessage(chatId, { text: `❌ Email tidak valid: ${email}` }, { quoted: msg });
        }

        if (pendingOob.has(chatId)) {
            return sock.sendMessage(chatId, { text: '⚠️ Anda masih memiliki proses verifikasi yang belum selesai. Silakan balas dengan link OOB.' }, { quoted: msg });
        }

        const statusMsg = await sock.sendMessage(chatId, { text: "⏳ *[1/3] Menyiapkan permintaan...*" }, { quoted: msg });
        const setStatus = async (txt) => {
            try { await sock.sendMessage(chatId, { text: txt, edit: statusMsg.key }); } catch (e) {}
        };

        try {
            await setStatus("📧 *[2/3] Mengirim link OOB ke " + email + "...*");
            
            const operator = await ensureOperatorLoggedIn();
            await sendOobLinkWithRetry(email);

            pendingOob.set(chatId, { email, operator, attempts: 0 });

            await setStatus("✅ *[3/3] Link OOB telah dikirim! Silakan balas dengan link yang diterima.*");
            
            await sock.sendMessage(chatId, { text: `Silakan buka email target, salin link OOB, lalu **balas pesan ini dengan link tersebut**.` }, { quoted: statusMsg });
        } catch (error) {
            console.error('[Alokmaton] Error:', error);
            pendingOob.delete(chatId);
            await setStatus("❌ Gagal mengirim link: " + error.message);
        }
    }
};

module.exports.handleReply = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    
    if (!pendingOob.has(chatId)) return false;

    const pending = pendingOob.get(chatId);
    const link = text.trim();
    
    if (!link || link.toLowerCase() === 'batal' || link.toLowerCase() === 'cancel') {
        pendingOob.delete(chatId);
        await sock.sendMessage(chatId, { text: 'Proses verifikasi dibatalkan.' }, { quoted: msg });
        return true;
    }

    const statusMsg = await sock.sendMessage(chatId, { text: "🔍 *[1/2] Memverifikasi link OOB...*" }, { quoted: msg });
    const setStatus = async (txt) => {
        try { await sock.sendMessage(chatId, { text: txt, edit: statusMsg.key }); } catch (e) {}
    };

    try {
        await setStatus("🔄 *[2/2] Memproses verifikasi...*");
        const result = await verifyOobLink(pending.email, link);

        let replyText = '';
        if (result.success === true || result.status === true) {
            replyText = '🎉 *TARGET BERHASIL DIUPGRADE KE PRO!*\n' +
                        `Local ID: ${result.user?.users?.[0]?.localId || 'N/A'}`;
        } else {
            replyText = `❌ Verifikasi gagal: ${result.message || result.msg || 'Tidak diketahui'}`;
        }
        
        await setStatus(replyText);
        pendingOob.delete(chatId);
    } catch (error) {
        console.error('[Alokmaton] Verify error:', error);
        await setStatus(`❌ Terjadi kesalahan saat verifikasi: ${error.message}`);
    }
    return true;
};