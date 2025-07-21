// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'twitch-miner',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node stream-watcher/src/main.ts',
      env_file: '.env',
    },
    {
      name: 'tg-bot',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node bot/bot.ts',
      env_file: '.env',
    },
  ],
};
