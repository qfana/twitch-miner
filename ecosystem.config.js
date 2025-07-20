module.exports = {
  apps: [
    {
      name: 'tg-bot',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node bot/bot.ts',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'twitch-miner',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node stream-watcher/src/main.ts',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
