const axios = require('axios');

class DiscoverProfile {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://api.discoverprofile.com';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://discoverprofile.com/',
        'Origin': 'https://discoverprofile.com',
        ...options.headers
      }
    });

    this._cache = new Map();
    this._cacheTTL = options.cacheTTL || 5 * 60 * 1000;
  }

  async search(source, options = {}) {
    const { type = 'name', rescan = false } = options;
    if (!source || typeof source !== 'string') {
      throw new Error('Parameter "source" harus berupa string yang valid');
    }

    const cacheKey = `${source}:${type}:${rescan}`;
    if (!rescan && this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this._cacheTTL) {
        return cached.data;
      }
      this._cache.delete(cacheKey);
    }

    const payload = { source: source.trim(), type, rescan };
    const result = await this._requestWithRetry('/discoverprofile', 'POST', payload);

    this._cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  filterExisting(searchResult) {
    if (!searchResult?.result) return [];
    return searchResult.result.filter(item => item.isExist === true);
  }

  getStats(searchResult) {
    const results = searchResult?.result || [];
    const existing = results.filter(r => r.isExist);
    const categories = new Set(results.map(item => item.category).filter(Boolean));
    
    return {
      totalChecked: results.length,
      totalFound: existing.length,
      totalNotFound: results.length - existing.length,
      totalCategories: categories.size
    };
  }

  async _requestWithRetry(endpoint, method = 'GET', data = null, attempt = 1) {
    try {
      const config = { method, url: endpoint };
      if (data && (method === 'POST' || method === 'PUT')) config.data = data;
      const response = await this.client.request(config);
      if (response.data?.error) throw new Error(`API Error: ${response.data.error}`);
      return response.data;
    } catch (error) {
      if (attempt < this.retries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this._requestWithRetry(endpoint, method, data, attempt + 1);
      }
      throw new Error(`Request gagal setelah ${this.retries} percobaan: ${error.message}`);
    }
  }
}

module.exports = {
  name: "stalk",
  async run({ sock, msg, sender, args, axios, downloadMediaMessage }) {
    const text = (typeof args === 'string' ? args : '').trim();
    
    if (!text) {
      return sock.sendMessage(sender, { 
        text: "⚠️ Masukkan username/nickname yang ingin di-stalk!\n\nContoh: .stalk jokowi" 
      }, { quoted: msg });
    }

    try {
      const scraper = new DiscoverProfile({ timeout: 30000, retries: 3 });
      const result = await scraper.search(text, { type: 'name' });
      const stats = scraper.getStats(result);
      const existing = scraper.filterExisting(result);

      if (existing.length === 0) {
        return sock.sendMessage(sender, { 
          text: `❌ Tidak ditemukan profil untuk username "${text}" di platform manapun.` 
        }, { quoted: msg });
      }

      let caption = `🔍 *STALK PROFILE: ${text.toUpperCase()}*\n`;
      caption += `📊 Ditemukan: ${stats.totalFound}/${stats.totalChecked} platform\n`;
      caption += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      existing.forEach((item, index) => {
        caption += `${index + 1}. *${item.source}* [${item.category || 'Unknown'}]\n`;
        caption += `   🔗 ${item.url}\n\n`;
      });

      caption += `_Credit: Zx | Source: DiscoverProfile_`;

      await sock.sendMessage(sender, { text: caption }, { quoted: msg });

    } catch (e) {
      sock.sendMessage(sender, { text: "❌ Error: " + e.message }, { quoted: msg });
    }
  }
};