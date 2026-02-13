/**
 * Blessed TUI for TranslaChat - LINE-style chat layout.
 *
 * - Own messages: green background, right-aligned
 * - Peer messages: translated text (white) + original (gray), left-aligned
 * - System messages: centered, yellow
 */

const blessed = require('blessed');

/**
 * Get display width of a string, accounting for CJK double-width characters.
 */
function strWidth(s) {
  if (blessed.unicode && blessed.unicode.strWidth) {
    return blessed.unicode.strWidth(s);
  }
  // Fallback: count CJK chars as 2, others as 1
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

class ChatUI {
  constructor(myName, myLang) {
    this.myName = myName;
    this.myLang = myLang;
    this.onSend = null; // callback: (text) => void
    this._messages = [];

    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: `TranslaChat - ${myName} (${myLang})`,
    });

    this._inputBuffer = '';

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
      tags: true,
    });

    // Input display (not a textbox - we handle input ourselves)
    this.inputBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ' > ',
      style: { fg: 'white', bg: '#222' },
    });

    // Status bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      content: ' Type message and press Enter to send. Ctrl+C to quit.',
      style: { fg: 'gray', bg: '#111' },
    });

    // Handle all input via screen keypress (works with CJK/IME)
    this.screen.on('keypress', (ch, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.exit(0);
      }

      // Scroll chat with Page Up/Down
      if (key && key.name === 'pageup') {
        this.chatBox.scroll(-5);
        this.screen.render();
        return;
      }
      if (key && key.name === 'pagedown') {
        this.chatBox.scroll(5);
        this.screen.render();
        return;
      }

      if (key && (key.name === 'enter' || key.name === 'return')) {
        const text = this._inputBuffer.trim();
        this._inputBuffer = '';
        this._updateInputDisplay();
        if (text && this.onSend) {
          this.onSend(text);
        }
        return;
      }

      if (key && key.name === 'backspace') {
        const chars = [...this._inputBuffer];
        chars.pop();
        this._inputBuffer = chars.join('');
        this._updateInputDisplay();
        return;
      }

      // Regular character input (including CJK)
      if (ch && !key.ctrl && !key.meta) {
        this._inputBuffer += ch;
        this._updateInputDisplay();
      }
    });

    // Reposition cursor after every render so IME window appears at input line
    this.screen.on('render', () => {
      this._positionCursor();
    });

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

  _updateInputDisplay() {
    this.inputBox.setContent(` > ${this._inputBuffer}`);
    this.screen.render();
  }

  _positionCursor() {
    // Position terminal cursor at end of input text so IME window appears there
    const cursorX = 3 + strWidth(this._inputBuffer); // " > " = 3 chars
    const cursorY = this.screen.rows - 1;             // bottom row
    this.screen.program.cup(cursorY, cursorX);
    this.screen.program.showCursor();
  }

  _renderMessages() {
    const width = this.chatBox.width - 2;
    let lines = [];

    const maxBubble = Math.floor(width * 0.7); // Bubble max 70% of width

    for (const msg of this._messages) {
      if (msg.type === 'own') {
        // Right-aligned name
        const label = msg.name;
        lines.push(`{green-fg}${' '.repeat(Math.max(0, width - strWidth(label)))}${label}{/green-fg}`);

        // Right-aligned compact bubble
        const msgLines = this._wrapText(msg.text, maxBubble - 2);
        for (const line of msgLines) {
          const bubble = ` ${line} `;
          const bubbleW = strWidth(bubble);
          const pad = ' '.repeat(Math.max(0, width - bubbleW));
          lines.push(`${pad}{green-bg}{black-fg}${bubble}{/black-fg}{/green-bg}`);
        }
        lines.push('');
      } else if (msg.type === 'peer') {
        // Left-aligned name
        lines.push(`{cyan-fg}${msg.name}{/cyan-fg}`);

        // Left-aligned compact bubble
        const transLines = this._wrapText(msg.translatedText, maxBubble - 2);
        for (const line of transLines) {
          const bubble = ` ${line} `;
          lines.push(`{white-bg}{black-fg}${bubble}{/black-fg}{/white-bg}`);
        }

        // Original text (gray)
        if (msg.originalText && msg.originalText !== msg.translatedText) {
          const origLines = this._wrapText(msg.originalText, maxBubble - 2);
          for (const line of origLines) {
            lines.push(`{gray-fg}  ${line}{/gray-fg}`);
          }
        }
        lines.push('');
      } else if (msg.type === 'system') {
        const pad = Math.max(0, Math.floor((width - strWidth(msg.text)) / 2));
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
    let line = '';
    let lineW = 0;
    for (const ch of text) {
      const chW = strWidth(ch);
      if (lineW + chW > maxWidth) {
        lines.push(line);
        line = ch;
        lineW = chW;
      } else {
        line += ch;
        lineW += chW;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  destroy() {
    this.screen.destroy();
  }
}

module.exports = ChatUI;
