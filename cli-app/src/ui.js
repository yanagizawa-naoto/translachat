/**
 * Blessed TUI for TranslaChat - LINE-style chat layout.
 *
 * - Own messages: green background, right-aligned
 * - Peer messages: translated text (white) + original (gray), left-aligned
 * - System messages: centered, yellow
 */

const blessed = require('blessed');

class ChatUI {
  constructor(myName, myLang) {
    this.myName = myName;
    this.myLang = myLang;
    this.onSend = null; // callback: (text) => void
    this._messages = [];

    this.screen = blessed.screen({
      smartCSR: true,
      title: `TranslaChat - ${myName} (${myLang})`,
    });

    // Header bar
    this.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ` TranslaChat - ${myName} (${myLang})`,
      style: { fg: 'white', bg: 'blue', bold: true },
    });

    // Chat message area
    this.chatBox = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-3',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '|', style: { fg: 'cyan' } },
      mouse: true,
      tags: true,
    });

    // Input area
    this.inputBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'white', bg: '#333' },
    });

    this.input = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      inputOnFocus: true,
      style: {
        fg: 'white',
        bg: '#222',
      },
    });

    // Status bar (between chat and input)
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      content: ' Type message and press Enter to send. Ctrl+C to quit.',
      style: { fg: 'gray', bg: '#111' },
    });

    // Key bindings
    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    this.input.key(['escape'], () => {
      this.input.focus();
    });

    this.input.on('submit', (value) => {
      const text = value.trim();
      this.input.clearValue();
      this.input.focus();
      this.screen.render();
      if (text && this.onSend) {
        this.onSend(text);
      }
    });

    this.input.focus();
    this.screen.render();
  }

  /**
   * Add own message (right-aligned, green background).
   */
  addOwnMessage(name, text) {
    this._messages.push({ type: 'own', name, text });
    this._renderMessages();
  }

  /**
   * Add peer message with translation.
   * Shows translated text in white and original in gray.
   */
  addPeerMessage(name, translatedText, originalText, originalLang) {
    this._messages.push({
      type: 'peer',
      name,
      translatedText,
      originalText,
      originalLang,
    });
    this._renderMessages();
  }

  /**
   * Add a system notification (centered, yellow).
   */
  addSystemMessage(text) {
    this._messages.push({ type: 'system', text });
    this._renderMessages();
  }

  /**
   * Show "translating..." indicator.
   */
  setTranslating(isTranslating) {
    if (isTranslating) {
      this.statusBar.setContent(' {yellow-fg}Translating...{/yellow-fg}');
    } else {
      this.statusBar.setContent(' Type message and press Enter to send. Ctrl+C to quit.');
    }
    this.statusBar.style.tags = true;
    this.screen.render();
  }

  _renderMessages() {
    const width = this.chatBox.width - 2;
    let lines = [];

    for (const msg of this._messages) {
      if (msg.type === 'own') {
        // Right-aligned, green
        const label = `${msg.name}`;
        const padLabel = ' '.repeat(Math.max(0, width - label.length)) + label;
        lines.push(`{green-fg}${padLabel}{/green-fg}`);

        const msgLines = this._wrapText(msg.text, width - 2);
        for (const line of msgLines) {
          const padded = ' '.repeat(Math.max(0, width - line.length)) + line;
          lines.push(`{green-bg}{black-fg} ${padded} {/black-fg}{/green-bg}`);
        }
        lines.push('');
      } else if (msg.type === 'peer') {
        // Left-aligned
        lines.push(`{cyan-fg}${msg.name}{/cyan-fg}`);

        // Translated text (white)
        const transLines = this._wrapText(msg.translatedText, width - 2);
        for (const line of transLines) {
          lines.push(`{white-bg}{black-fg} ${line}${' '.repeat(Math.max(0, width - line.length))} {/black-fg}{/white-bg}`);
        }

        // Original text (gray, smaller)
        if (msg.originalText && msg.originalText !== msg.translatedText) {
          const origLines = this._wrapText(msg.originalText, width - 2);
          for (const line of origLines) {
            lines.push(`{gray-fg}  ${line}{/gray-fg}`);
          }
        }
        lines.push('');
      } else if (msg.type === 'system') {
        const pad = Math.max(0, Math.floor((width - msg.text.length) / 2));
        lines.push(`{yellow-fg}${' '.repeat(pad)}--- ${msg.text} ---{/yellow-fg}`);
        lines.push('');
      }
    }

    this.chatBox.setContent(lines.join('\n'));
    this.chatBox.tags = true;
    this.chatBox.setScrollPerc(100);
    this.screen.render();
  }

  _wrapText(text, maxWidth) {
    if (!text) return [''];
    const lines = [];
    let remaining = text;
    while (remaining.length > maxWidth) {
      lines.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth);
    }
    if (remaining) lines.push(remaining);
    return lines;
  }

  destroy() {
    this.screen.destroy();
  }
}

module.exports = ChatUI;
