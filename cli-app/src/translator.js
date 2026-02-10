/**
 * Translation API client for TranslaChat.
 * Calls the local Flask translation API.
 */

const http = require('http');

const API_URL = process.env.TRANSLATE_API || 'http://localhost:5050';

function translate(text, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    if (sourceLang === targetLang) {
      return resolve(text);
    }

    const url = new URL('/translate', API_URL);
    const body = JSON.stringify({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    });

    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error));
          } else {
            resolve(json.translated_text);
          }
        } catch (e) {
          reject(new Error(`Translation API parse error: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Translation API error: ${e.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Translation API timeout'));
    });

    req.write(body);
    req.end();
  });
}

function healthCheck() {
  return new Promise((resolve, reject) => {
    const url = new URL('/health', API_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', (e) => reject(e));
  });
}

module.exports = { translate, healthCheck };
