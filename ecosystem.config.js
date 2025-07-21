module.exports = {
  apps: [
    {
      name: 'tg-bot',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node -P tsconfig.json bot/bot.ts',
      watch: false,
      env_file: '.env'
    },
    {
      name: 'twitch-miner',
      cwd: './',
      script: 'pnpm',
      args: 'exec ts-node -P tsconfig.json stream-watcher/src/main.ts',
      watch: false,
      env_file: '.env'
    }
  ]
};
