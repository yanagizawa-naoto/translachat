#!/usr/bin/env node
/**
 * E2E test for TranslaChat - tests WebSocket + translation without TUI.
 * Simulates a Japanese host and Korean client exchanging messages.
 */

const ChatServer = require('./src/server');
const ChatClient = require('./src/client');
const { translate } = require('./src/translator');
const {
  MessageType,
  createJoinMessage,
  createChatMessage,
  parseMessage,
} = require('./src/protocol');

const PORT = 3999; // Use a different port for testing
const results = [];
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== TranslaChat E2E Test ===\n');

  // --- Test 1: Translation API ---
  console.log('[1] Translation API');
  try {
    const jaToKo = await translate('こんにちは', 'ja', 'ko');
    assert(`ja→ko: "こんにちは" → "${jaToKo}"`, jaToKo && jaToKo.length > 0);

    const koToJa = await translate('감사합니다', 'ko', 'ja');
    assert(`ko→ja: "감사합니다" → "${koToJa}"`, koToJa && koToJa.length > 0);

    const same = await translate('テスト', 'ja', 'ja');
    assert(`Same lang returns original: "${same}"`, same === 'テスト');
  } catch (err) {
    assert(`Translation API reachable: ${err.message}`, false);
  }

  // --- Test 2: WebSocket Server/Client ---
  console.log('\n[2] WebSocket Connection');
  const server = new ChatServer(PORT);
  await server.start();
  assert('Server started on port ' + PORT, true);

  const client = new ChatClient(`ws://localhost:${PORT}`);

  // Collect messages received by server (from client)
  const serverReceived = [];
  server.onMessage = (msg) => serverReceived.push(msg);
  server.onPeerJoin = (name, lang) => serverReceived.push({ type: 'join', name, lang });

  // Collect messages received by client (from server)
  const clientReceived = [];
  client.onMessage = (msg) => clientReceived.push(msg);

  await client.connect();
  assert('Client connected', true);

  // --- Test 3: Join handshake ---
  console.log('\n[3] Join Handshake');
  client.send(createJoinMessage('MinJi', 'ko'));
  await sleep(200);
  assert('Server received join', serverReceived.some(m => m.type === 'join' && m.name === 'MinJi'));

  // --- Test 4: Message relay ---
  console.log('\n[4] Message Relay');

  // Host sends message (simulate by broadcasting via server)
  const hostMsg = createChatMessage('Naoto', 'ja', '今日はいい天気ですね');
  server.send(hostMsg);
  await sleep(200);
  assert('Client received host message', clientReceived.some(m => m.type === 'chat' && m.name === 'Naoto'));

  // Client sends message
  client.send(createChatMessage('MinJi', 'ko', '네, 정말 좋은 날씨예요'));
  await sleep(200);
  assert('Server received client message', serverReceived.some(m => m.type === 'chat' && m.name === 'MinJi'));

  // --- Test 5: Receiver-side translation ---
  console.log('\n[5] Receiver-side Translation (simulated)');

  // Simulate: Korean client receives Japanese message and translates
  const jaMsg = clientReceived.find(m => m.type === 'chat' && m.lang === 'ja');
  if (jaMsg) {
    const translated = await translate(jaMsg.text, 'ja', 'ko');
    assert(`Korean user sees: "${translated}" (original: "${jaMsg.text}")`, translated && translated.length > 0);
  } else {
    assert('Japanese message found for translation', false);
  }

  // Simulate: Japanese host receives Korean message and translates
  const koMsg = serverReceived.find(m => m.type === 'chat' && m.lang === 'ko');
  if (koMsg) {
    const translated = await translate(koMsg.text, 'ko', 'ja');
    assert(`Japanese user sees: "${translated}" (original: "${koMsg.text}")`, translated && translated.length > 0);
  } else {
    assert('Korean message found for translation', false);
  }

  // --- Cleanup ---
  client.close();
  server.close();
  await sleep(200);

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
