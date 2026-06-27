type LogLevel = "info" | "warn" | "error" | "debug";

type LogRecord = {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
};

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const record: LogRecord = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...context,
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  /** @param msg - Log message @param context - Additional fields */
  info(message: string, context?: Record<string, unknown>): void {
    write("info", message, context);
  },
  /** @param msg - Log message @param context - Additional fields */
  warn(message: string, context?: Record<string, unknown>): void {
    write("warn", message, context);
  },
  /** @param msg - Log message @param context - Additional fields */
  error(message: string, context?: Record<string, unknown>): void {
    write("error", message, context);
  },
  /** @param msg - Log message @param context - Additional fields */
  debug(message: string, context?: Record<string, unknown>): void {
    write("debug", message, context);
  },
};
