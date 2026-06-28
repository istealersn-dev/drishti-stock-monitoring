module.exports = {
  apps: [
    {
      name: "drishti-agent",
      script: "packages/agent/dist/main.js",
      cwd: "/Users/stanleynadar/Documents/Engineering/drishti-stock-monitoring",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        DRISHTI_DRY_RUN: "false",
      },
      log_file: "/Users/stanleynadar/.pm2/logs/drishti-agent.log",
      error_file: "/Users/stanleynadar/.pm2/logs/drishti-agent-error.log",
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
      log_file: "/Users/stanleynadar/.pm2/logs/drishti-tunnel.log",
      error_file: "/Users/stanleynadar/.pm2/logs/drishti-tunnel-error.log",
      time: true,
      restart_delay: 3000,
      max_restarts: 20,
      autorestart: true,
    },
  ],
};
