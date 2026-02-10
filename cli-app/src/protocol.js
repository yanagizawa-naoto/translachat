/**
 * WebSocket message protocol definitions for TranslaChat.
 *
 * Message types:
 *   join    - Sent when a user connects (contains name, lang)
 *   chat    - A chat message (contains name, lang, text)
 *   system  - System notification (contains text)
 */

const MessageType = {
  JOIN: 'join',
  CHAT: 'chat',
  SYSTEM: 'system',
};

function createJoinMessage(name, lang) {
  return JSON.stringify({ type: MessageType.JOIN, name, lang });
}

function createChatMessage(name, lang, text) {
  return JSON.stringify({ type: MessageType.CHAT, name, lang, text });
}

function createSystemMessage(text) {
  return JSON.stringify({ type: MessageType.SYSTEM, text });
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  MessageType,
  createJoinMessage,
  createChatMessage,
  createSystemMessage,
  parseMessage,
};
