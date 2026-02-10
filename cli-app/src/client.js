/**
 * WebSocket client for TranslaChat (join mode).
 * Connects to a host and sends/receives messages.
 */

const WebSocket = require('ws');
const { parseMessage } = require('./protocol');

class ChatClient {
  constructor(hostUrl) {
    this.hostUrl = hostUrl;
    this.ws = null;
    this.onMessage = null;   // callback: (msg) => void
    this.onClose = null;     // callback: () => void
    this.onOpen = null;      // callback: () => void
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.hostUrl);

      this.ws.on('open', () => {
        if (this.onOpen) this.onOpen();
        resolve();
      });

      this.ws.on('message', (raw) => {
        const msg = parseMessage(raw.toString());
        if (msg && this.onMessage) {
          this.onMessage(msg);
        }
      });

      this.ws.on('close', () => {
        if (this.onClose) this.onClose();
      });

      this.ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  send(rawMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(rawMessage);
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

module.exports = ChatClient;
