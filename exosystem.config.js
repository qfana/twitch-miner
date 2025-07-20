// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'tg-bot',
      // Команда, которую запускает PM2
      script: 'pnpm',
      // Аргументы: "exec ts-node bot/src/bot.ts"
      args: 'exec ts-node bot/bot.ts',
      // Окружение
      env: {
        NODE_ENV: 'production',
        TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
        // ...прочие переменные
      },
    },
    {
      name: 'twitch-miner',
      script: 'pnpm',
      args: 'exec ts-node stream-watcher/src/main.ts',
      env: {
        NODE_ENV: 'production',
        TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
        TWITCH_APP_TOKEN: process.env.TWITCH_APP_TOKEN,
        // ...прочие
      },
    },
  ],
};
