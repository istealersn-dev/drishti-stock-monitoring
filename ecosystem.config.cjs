const os = require("node:os");
const path = require("node:path");

const pm2Logs = path.join(os.homedir(), ".pm2", "logs");

module.exports = {
  apps: [
    {
      name: "drishti-agent",
      script: "packages/agent/dist/main.js",
      cwd: __dirname,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        DRISHTI_DRY_RUN: "false",
      },
      log_file: path.join(pm2Logs, "drishti-agent.log"),
      error_file: path.join(pm2Logs, "drishti-agent-error.log"),
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
    },
    {
      name: "drishti-tunnel",
      script: "/opt/homebrew/bin/cloudflared",
      interpreter: "none",
      args: "tunnel run ede69225-3e84-4ca1-a897-56632e2f9c7d",
      log_file: path.join(pm2Logs, "drishti-tunnel.log"),
      error_file: path.join(pm2Logs, "drishti-tunnel-error.log"),
      time: true,
      restart_delay: 3000,
      max_restarts: 20,
      autorestart: true,
    },
  ],
};
