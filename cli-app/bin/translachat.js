#!/usr/bin/env node
/**
 * TranslaChat - CLI translation chat application.
 *
 * Usage:
 *   translachat host --lang ja --name Naoto
 *   translachat join --lang ko --host localhost:3000 --name MinJi
 */

const { Command } = require('commander');
const ChatUI = require('../src/ui');
const ChatServer = require('../src/server');
const ChatClient = require('../src/client');
const { translate } = require('../src/translator');
const {
  MessageType,
  createJoinMessage,
  createChatMessage,
} = require('../src/protocol');

const DEFAULT_PORT = 3000;

const program = new Command();

program
  .name('translachat')
  .description('Real-time translation chat between Japanese and Korean')
  .version('1.0.0');

program
  .command('host')
  .description('Host a chat room')
  .requiredOption('--lang <lang>', 'Your language code (ja/ko)')
  .requiredOption('--name <name>', 'Your display name')
  .option('--port <port>', 'WebSocket port', String(DEFAULT_PORT))
  .action(hostAction);

program
  .command('join')
  .description('Join a chat room')
  .requiredOption('--lang <lang>', 'Your language code (ja/ko)')
  .requiredOption('--name <name>', 'Your display name')
  .requiredOption('--host <host>', 'Host address (e.g., localhost:3000)')
  .action(joinAction);

async function hostAction(opts) {
  const { lang, name, port: portStr } = opts;
  const port = parseInt(portStr, 10);
  const server = new ChatServer(port);

  const ui = new ChatUI(name, lang);
  ui.addSystemMessage(`Starting server on port ${port}...`);

  try {
    await server.start();
    ui.addSystemMessage(`Server started. Waiting for connections on port ${port}`);
  } catch (err) {
    ui.addSystemMessage(`Failed to start server: ${err.message}`);
    return;
  }

  // Handle incoming messages from peers
  server.onMessage = async (msg) => {
    if (msg.type === MessageType.CHAT) {
      await handleIncomingChat(ui, lang, msg);
    }
  };

  server.onPeerJoin = (peerName, peerLang) => {
    ui.addSystemMessage(`${peerName} (${peerLang}) joined`);
  };

  server.onPeerLeave = (peerName) => {
    ui.addSystemMessage(`${peerName} left`);
  };

  // Handle outgoing messages
  ui.onSend = (text) => {
    ui.addOwnMessage(name, text);
    const raw = createChatMessage(name, lang, text);
    server.send(raw);
  };

  process.on('SIGINT', () => {
    server.close();
    ui.destroy();
    process.exit(0);
  });
}

async function joinAction(opts) {
  const { lang, name, host } = opts;
  const wsUrl = `ws://${host}`;
  const client = new ChatClient(wsUrl);

  const ui = new ChatUI(name, lang);
  ui.addSystemMessage(`Connecting to ${host}...`);

  try {
    await client.connect();
    ui.addSystemMessage(`Connected to ${host}`);
    // Send join message
    client.send(createJoinMessage(name, lang));
  } catch (err) {
    ui.addSystemMessage(`Failed to connect: ${err.message}`);
    return;
  }

  // Handle incoming messages
  client.onMessage = async (msg) => {
    if (msg.type === MessageType.CHAT) {
      await handleIncomingChat(ui, lang, msg);
    } else if (msg.type === MessageType.SYSTEM) {
      ui.addSystemMessage(msg.text);
    }
  };

  client.onClose = () => {
    ui.addSystemMessage('Disconnected from server');
  };

  // Handle outgoing messages
  ui.onSend = (text) => {
    ui.addOwnMessage(name, text);
    client.send(createChatMessage(name, lang, text));
  };

  process.on('SIGINT', () => {
    client.close();
    ui.destroy();
    process.exit(0);
  });
}

/**
 * Handle an incoming chat message: translate if needed, then display.
 */
async function handleIncomingChat(ui, myLang, msg) {
  const { name: senderName, lang: senderLang, text: originalText } = msg;

  if (senderLang === myLang) {
    // Same language, no translation needed
    ui.addPeerMessage(senderName, originalText, null, senderLang);
    return;
  }

  // Translate from sender's language to my language
  ui.setTranslating(true);
  try {
    const translatedText = await translate(originalText, senderLang, myLang);
    ui.addPeerMessage(senderName, translatedText, originalText, senderLang);
  } catch (err) {
    // Show original with error note
    ui.addPeerMessage(
      senderName,
      `[Translation error: ${err.message}] ${originalText}`,
      originalText,
      senderLang
    );
  } finally {
    ui.setTranslating(false);
  }
}

program.parse();
