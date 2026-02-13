#!/usr/bin/env node
/**
 * TranslaChat - CLI translation chat application.
 *
 * Usage:
 *   translachat create --lang ja --name Naoto --server https://app.yuuma.dev/translachat
 *   translachat join --code ABC123 --lang ko --name MinJi --server https://app.yuuma.dev/translachat
 */

const { Command } = require('commander');
const ChatUI = require('../src/ui');
const ChatClient = require('../src/client');

const DEFAULT_SERVER = process.env.TRANSLACHAT_SERVER || 'http://localhost:3000';

const program = new Command();

program
  .name('translachat')
  .description('Real-time translation chat')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new chat room')
  .requiredOption('--lang <lang>', 'Your language code (ja/ko/en/zh/...)')
  .requiredOption('--name <name>', 'Your display name')
  .option('--server <url>', 'Server URL', DEFAULT_SERVER)
  .action(createAction);

program
  .command('join')
  .description('Join a chat room')
  .requiredOption('--code <code>', 'Room invite code')
  .requiredOption('--lang <lang>', 'Your language code (ja/ko/en/zh/...)')
  .requiredOption('--name <name>', 'Your display name')
  .option('--server <url>', 'Server URL', DEFAULT_SERVER)
  .action(joinAction);

async function createAction(opts) {
  const { lang, name, server } = opts;
  const basePath = getBasePath(server);

  const ui = new ChatUI(name, lang);
  ui.addSystemMessage('Creating room...');

  try {
    const res = await httpPost(`${server}/api/rooms`);
    const { code } = JSON.parse(res);
    ui.addSystemMessage(`Room created! Invite code: ${code}`);
    ui.addSystemMessage(`Share: translachat join --code ${code} --lang <lang> --name <name>`);
    await connectAndChat(ui, server, basePath, code, name, lang);
  } catch (err) {
    ui.addSystemMessage(`Failed to create room: ${err.message}`);
  }
}

async function joinAction(opts) {
  const { code, lang, name, server } = opts;
  const basePath = getBasePath(server);

  const ui = new ChatUI(name, lang);
  ui.addSystemMessage(`Joining room ${code.toUpperCase()}...`);

  try {
    const res = await httpGet(`${server}/api/rooms/${code.toUpperCase()}`);
    const { exists } = JSON.parse(res);
    if (!exists) {
      ui.addSystemMessage('Room not found');
      return;
    }
    await connectAndChat(ui, server, basePath, code.toUpperCase(), name, lang);
  } catch (err) {
    ui.addSystemMessage(`Failed to join room: ${err.message}`);
  }
}

async function connectAndChat(ui, serverUrl, basePath, code, name, lang) {
  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
  const client = new ChatClient(wsUrl);

  client.onMessage = (msg) => {
    if (msg.type === 'system') {
      ui.addSystemMessage(msg.text);
    } else if (msg.type === 'translated') {
      const isOwn = msg.name === name && msg.lang === lang;
      const translatedText = msg.translations[lang] || msg.originalText;
      const showOriginal = msg.lang !== lang;

      if (isOwn) {
        ui.addOwnMessage(msg.name, msg.originalText);
      } else {
        ui.addPeerMessage(
          msg.name,
          translatedText,
          showOriginal ? msg.originalText : null,
          msg.lang
        );
      }
    } else if (msg.type === 'error') {
      ui.addSystemMessage(`Error: ${msg.text}`);
    }
  };

  client.onClose = () => {
    ui.addSystemMessage('Disconnected from server');
  };

  try {
    await client.connect();
    // Send join
    client.send(JSON.stringify({ type: 'join', code, name, lang }));
  } catch (err) {
    ui.addSystemMessage(`Connection failed: ${err.message}`);
    return;
  }

  // Handle outgoing messages
  ui.onSend = (text) => {
    client.send(JSON.stringify({ type: 'chat', text }));
  };

  process.on('SIGINT', () => {
    client.close();
    ui.destroy();
    process.exit(0);
  });
}

function getBasePath(serverUrl) {
  try {
    const url = new URL(serverUrl);
    return url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  } catch {
    return '/';
  }
}

function httpPost(url) {
  return httpRequest(url, 'POST');
}

function httpGet(url) {
  return httpRequest(url, 'GET');
}

function httpRequest(url, method) {
  const mod = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

program.parse();
