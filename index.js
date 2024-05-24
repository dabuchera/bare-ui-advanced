const { Readable } = require('bare-stream');
const ansiEscapes = require('bare-ansi-escapes');
const KeyDecoder = require('bare-ansi-escapes/key-decoder');

const constants = {
  EOL: '\r\n',
};

/* - Raw input from the user is received through this.input
   - This input is handled by _oninput, which forwards it to the KeyDecoder for parsing
   - The KeyDecoder processes this input and, upon recognizing specific keys or patterns, emits 'data' events handled by _onkey
   - The output stream (this.output) is used to send processed responses or prompts back to the user, based on the logic in _onkey and other methods of the class
*/

const UI =
  (module.exports =
  exports =
    class UI extends Readable {
      constructor(opts = {}) {
        super();

        this._prompt = opts.prompt || '> ';

        this._oninput = this._oninput.bind(this);
        this._onkey = this._onkey.bind(this);

        this._decoder = new KeyDecoder().on('data', this._onkey);
        this._history = new History();

        this.input = opts.input.on('data', this._oninput);
        this.output = opts.output;
        this.line = '';
        this.cursor = 0;

        this.selectionMode = false; // track if we are in selection mode
        this.choiceIndex = 0; // Index of the currently selected option
        this.options = opts.options; // Available options for choice

        this.on('data', this._online).resume();
      }

      setSelectionMode(bool){
        this.selectionMode = bool;
      }

      setOptions(options){
        this.options = options;
      }

      prompt() {
        this.write(ansiEscapes.cursorPosition(0) + ansiEscapes.eraseLine + this._prompt + this.line + ansiEscapes.cursorPosition(this._prompt.length + this.cursor));
      }

      promptOptions() {
        const optionsText = this.options
          .map((option, index) => {
            return (index === this.choiceIndex ? '[*] ' : '[ ] ') + option;
          })
          .join('\r\n');

        // Display the options and hide the cursor
        this.write('\r\n' + optionsText + constants.EOL + ansiEscapes.cursorHide);
      }

      close() {
        this.input.off('data', this._oninput);
        this.push(null);
      }

      write(data) {
        if (this.output) this.output.write(data);
      }

      clearLine() {
        this.write(constants.EOL);
        this.line = '';
        this.cursor = 0;
      }

      _oninput(data) {
        this._decoder.write(data);
      }

      _online(line) {
        this.emit('line', line); // For Node.js compatibility
      }

      _onkey(key) {
        // console.log(key); // For debugging purposes
        if (key.name === 'up') return this._onup();
        if (key.name === 'down') return this._ondown();

        if(!this.selectionMode){
          this._history.cursor = -1;
        }

        let characters;

        switch (key.name) {
          case 'd':
            if (key.ctrl) return this.close();
            characters = key.shift ? 'D' : 'd';
            break;

          case 'c':
            if (key.ctrl) return this.close();
            characters = key.shift ? 'C' : 'c';
            break;

          // If we are in selection mode, we should not allow the user to type
          case 'backspace': {
            if (this.selectionMode) {
              break;
            } else {
              return this._onbackspace();
            }
          }

          case 'linefeed':
          // If we are in selection mode, return the selected option
          case 'return': {
            if(!this.selectionMode && this.line.length === 0) {
              this.emit('line', "")
              return
            };
            if (this.selectionMode) {
              const selectedOption = this.options[this.choiceIndex];
              // this.write('\r\n' + ansiEscapes.colorBrightGreen + 'Selected option: ' + selectedOption + '\r\n' + ansiEscapes.modifierReset);
              this.clearLine();
              this.emit('selection', selectedOption);
              // show the cursor
              this.write(ansiEscapes.cursorShow);
              // Reset the history cursor
              // this._history = new History();
              return;
            } else {
              const line = this.line;
              if (line.trim() === '') return '';
              if (line !== this._history.get(0)) this._history.unshift(line);
              this.push(line);
              this.emit('history', this._history.entries);
              this.clearLine();
              return;
            }
          }

          case 'right':
            return this._onright();
          case 'left':
            return this._onleft();

          // If we are in selection mode, return that we are not selecting any option
          case 'escape': {
            if (this.selectionMode) {
              this.write('\r\n' + ansiEscapes.colorBrightRed + 'No option selected' + '\r\n' + ansiEscapes.modifierReset);
              this.clearLine();
              // show the cursor
              this.write(ansiEscapes.cursorShow);
              this.emit('selection', false);
              return;
            }
          }
          case 'f1':
          case 'f2':
          case 'f3':
          case 'f4':
          case 'f5':
          case 'f6':
          case 'f7':
          case 'f8':
          case 'f9':
          case 'f10':
          case 'f11':
          case 'f12':
          case 'clear':
          case 'end':
          case 'home':
          case 'pageup':
          case 'pagedown':
          case 'insert':
          case 'delete':
          case 'tab':
          case 'undefined':
            return;

          // If we are in selection mode, nothing should happen
          case 'space': {
            if (this.selectionMode) {
              break;
            } else {
              characters = ' ';
              break;
            }
          }

          default: {
            if (this.selectionMode) {
              return this._onup();
            } else {
              characters = key.shift ? key.name.toUpperCase() : key.name;
            }
          }
        }

        // If we are in selection mode, we should not allow the user to type
        if (!this.selectionMode) {
          this.line = this.line.substring(0, this.cursor) + characters + this.line.substring(this.cursor);
          this.cursor += characters.length;
          this.prompt();
        }
      }

      _onbackspace() {
        if (this.cursor) {
          this.write(ansiEscapes.cursorBack(2));

          this.line = this.line.substring(0, this.cursor - 1) + this.line.substring(this.cursor);

          this.cursor--;
          this.prompt();
        }
      }

      _onup() {
        if (this.selectionMode) {
          this.choiceIndex = (this.choiceIndex - 1 + this.options.length) % this.options.length;
          // Move cursor up to the start of options and erase everything below
          this.write(ansiEscapes.cursorUp(this.options.length) + ansiEscapes.eraseDisplayEnd);
          // Build the options text with the current selection marked
          const optionsText = this.options
            .map((option, index) => {
              return (index === this.choiceIndex ? '[*] ' : '[ ] ') + option;
            })
            .join('\r\n');
          // Display the options
          this.write(optionsText + constants.EOL);
        } else {
          if (this._history.cursor === -1 && this.line.length > 0) return;
          if (this._history.length === 0) return;
          if (this._history.length <= this._history.cursor + 1) return;

          this._history.cursor++;

          this.line = this._history.get(this._history.cursor);
          this.cursor = this.line.length;
          this.prompt();
        }
      }

      _ondown() {
        if (this.selectionMode) {
          this.choiceIndex = (this.choiceIndex + 1 + this.options.length) % this.options.length;
          // Move cursor up to the start of options and erase everything below
          this.write(ansiEscapes.cursorUp(this.options.length) + ansiEscapes.eraseDisplayEnd);
          // Build the options text with the current selection marked
          const optionsText = this.options
            .map((option, index) => {
              return (index === this.choiceIndex ? '[*] ' : '[ ] ') + option;
            })
            .join('\r\n');
          // Display the options
          this.write(optionsText + constants.EOL);
        } else {
          if (this._history.cursor === -1) return;

          this._history.cursor--;

          this.line = this._history.cursor === -1 ? '' : this._history.get(this._history.cursor);
          this.cursor = this.line.length;
          this.prompt();
        }
      }

      _onright() {
        // Only move the cursor if we are not in selection mode
        if (!this.selectionMode) {
          if (this.cursor < this.line.length) {
            this.cursor++;
            this.write(ansiEscapes.cursorForward());
          }
        }
      }

      _onleft() {
        // Only move the cursor if we are not in selection mode
        if (!this.selectionMode) {
          if (this.cursor) {
            this.cursor--;
            this.write(ansiEscapes.cursorBack());
          }
        }
      }
    });

exports.createInterface = function createInterface(opts) {
  return new UI(opts);
};

exports.constants = constants;

class History {
  constructor() {
    this.entries = [];
    this.cursor = -1;
  }

  get length() {
    return this.entries.length;
  }

  unshift(entry) {
    this.entries.unshift(entry);
  }

  get(index) {
    if (index < 0) index += this.length;
    if (index < 0 || index >= this.length) return null;

    return this.entries[index];
  }
}
