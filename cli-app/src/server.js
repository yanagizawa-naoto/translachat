/**
 * WebSocket server for TranslaChat (host mode).
 * Manages connections and relays messages between peers.
 */

const { WebSocketServer, WebSocket } = require('ws');
const { MessageType, createSystemMessage, parseMessage } = require('./protocol');

class ChatServer {
  constructor(port) {
    this.port = port;
    this.wss = null;
    this.clients = new Map(); // ws -> { name, lang }
    this.onMessage = null;    // callback: (msg) => void
    this.onPeerJoin = null;   // callback: (name, lang) => void
    this.onPeerLeave = null;  // callback: (name) => void
  }

  start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port }, () => {
        resolve();
      });

      this.wss.on('error', reject);

      this.wss.on('connection', (ws) => {
        ws.on('message', (raw) => {
          const msg = parseMessage(raw.toString());
          if (!msg) return;

          if (msg.type === MessageType.JOIN) {
            this.clients.set(ws, { name: msg.name, lang: msg.lang });
            // Notify all other clients
            this._broadcast(createSystemMessage(`${msg.name} (${msg.lang}) joined`), ws);
            if (this.onPeerJoin) this.onPeerJoin(msg.name, msg.lang);
          } else if (msg.type === MessageType.CHAT) {
            // Relay to all other clients
            this._broadcast(raw.toString(), ws);
            if (this.onMessage) this.onMessage(msg);
          }
        });

        ws.on('close', () => {
          const info = this.clients.get(ws);
          if (info) {
            this.clients.delete(ws);
            this._broadcast(createSystemMessage(`${info.name} left`));
            if (this.onPeerLeave) this.onPeerLeave(info.name);
          }
        });
      });
    });
  }

  /**
   * Send a message as the host to all connected clients.
   */
  send(rawMessage) {
    this._broadcast(rawMessage);
  }

  _broadcast(data, excludeWs) {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  close() {
    if (this.wss) this.wss.close();
  }
}

module.exports = ChatServer;
