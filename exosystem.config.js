module.exports = {
  apps: [
    {
      name: 'twitch-miner',
      script: 'stream-watcher/src/main.ts',
      interpreter: 'node',
      interpreter_args: '-r ts-node/register',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'tg-bot',
      script: 'bot/bot.ts',
      interpreter: 'node',
      interpreter_args: '-r ts-node/register',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
