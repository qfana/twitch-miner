// ecosystem.config.js
module.exports = {
  apps: [
    {
      name       : 'tg-bot',
      cwd        : '/root/twitch-miner',          // корень вашего репо
      script     : 'bot/bot.ts',                  // точка входа .ts
      interpreter: 'node',                        // используем Node
      interpreter_args: [
        '-r', 'ts-node/register',                // регистрируем ts-node
        '-r', 'dotenv/config'                    // (если нужно) подхват .env
      ],
      watch      : false,
      env_file   : '.env',                        // подтягиваем все ваши vars
      env        : {
        NODE_ENV: 'production'
      },
    },
    {
      name       : 'twitch-miner',
      cwd        : '/root/twitch-miner',
      script     : 'stream-watcher/src/main.ts',
      interpreter: 'node',
      interpreter_args: [
        '-r', 'ts-node/register',
        '-r', 'dotenv/config'
      ],
      watch      : false,
      env_file   : '.env',
      env        : {
        NODE_ENV: 'production'
      },
    }
  ]
}
