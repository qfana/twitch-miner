// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'tg-bot',
      cwd: '/root/twitch-miner',          // корень репо
      script: './bot/bot.ts',             // ваш TS‑файл
      interpreter: 'node',                // запускаем через node
      interpreter_args: [
        '-r', 'ts-node/register',         // регистрируем ts-node
        '-r', 'dotenv/config'             // грузим .env
      ],
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'twitch-miner',
      cwd: '/root/twitch-miner',
      script: './stream-watcher/src/main.ts',
      interpreter: 'node',
      interpreter_args: [
        '-r', 'ts-node/register',
        '-r', 'dotenv/config'
      ],
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
