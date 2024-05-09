import { Controller } from "@hotwired/stimulus";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "xterm-addon-fit";
import consumer from "../channels/consumer";

// Connects to data-controller="console"
export default class extends Controller {
  static values = { id: String };
  intervalId = null;

  connect() {
    this.setupTerminal();
    this.createChannel();
    this.setupTerminalHotkeys();
    this.startLogFetching();
  }

  disconnect() {
    this.stopLogFetching();
  }

  setupTerminal() {
    this.terminal = new Terminal({
      convertEol: true,
      fontFamily: `"Fira code", monospace`,
      fontSize: 18,
      cursorBlink: true,
      scrollBack: 100,
    });

    const fitAddon = new FitAddon();
    this.terminal.loadAddon(fitAddon);
    this.terminal.open(this.element);
    fitAddon.fit();

    window.addEventListener("resize", () => fitAddon.fit());
  }

  createChannel() {
    this.dockerConsole = consumer.subscriptions.create(
      {
        channel: "ContainerChannel",
        id: this.idValue,
      },
      {
        connected: () => {
          console.log("Connected to container channel");
          this.fetchLogs();
        },
        disconnected: () => {
          console.log("Disconnected to container channel");
        },
        received: (data) => {
          console.log("Received data", data.output);
          data.output.forEach((line) => {
            this.terminal.writeln(line);
          });
          this.trimTerminalBuffer();
        },
      }
    );
  }

  trimTerminalBuffer() {
    const terminalBuffer = this.terminal.buffer.active;
    const linesToTrim = terminalBuffer.length - 100;

    if (linesToTrim > 0) {
      // this.terminal.buffer.active.trimStart(linesToTrim);
    }
  }

  setupTerminalHotkeys() {
    this.terminal.onKey(({ key, domEvent }) => {
      if (domEvent.key == "Enter") {
        this.terminal.write("\r\n");
        this.sendCommand(key, this.idValue);
      } else if (domEvent.ctrlKey && domEvent.key === "l") {
        this.terminal.clear();
      } else {
        this.terminal.write(key);
      }
    });
  }

  sendCommand(command, id) {
    this.dockerConsole.perform("receive", {
      command: command,
      id: id,
    });
  }

  startLogFetching() {
    this.intervalId = setInterval(() => {
      this.fetchLogs();
    }, 1000);
  }

  stopLogFetching() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  fetchLogs() {
    this.dockerConsole.perform("fetch_logs", {
      id: this.idValue,
    });
  }
}
