const ENTER_CODES = new Set([10, 13]); // \n, \r
const CTRL_C_CODE = 3;
const CTRL_D_CODE = 4;
const BACKSPACE_CODES = new Set([8, 127]); // \b, DEL

// Single unified stdin reader for every prompt (masked or not) so exactly one
// consumer ever attaches to process.stdin at a time — mixing this with
// node:readline's own Interface caused lost/misdirected input across calls.
function promptField(label: string, masked: boolean): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    const useRawMode = Boolean(stdin.isTTY) && masked;
    if (useRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";

    const cleanup = (): void => {
      if (useRawMode) stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk: string): void => {
      for (const char of chunk) {
        const code = char.charCodeAt(0);
        if (ENTER_CODES.has(code)) {
          cleanup();
          if (useRawMode) process.stdout.write("\n");
          resolve(value.trimEnd());
          return;
        } else if (code === CTRL_D_CODE && value.length === 0) {
          cleanup();
          process.stdout.write("\n");
          resolve("");
          return;
        } else if (code === CTRL_C_CODE) {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        } else if (BACKSPACE_CODES.has(code)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (useRawMode) process.stdout.write("\b \b");
          }
        } else {
          value += char;
          if (useRawMode) process.stdout.write(masked ? "*" : char);
        }
      }
    };

    stdin.on("data", onData);
  });
}

export async function promptPlain(label: string): Promise<string> {
  return promptField(label, false);
}

export async function promptMasked(label: string): Promise<string> {
  return promptField(label, true);
}
