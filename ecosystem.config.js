module.exports = {
  apps: [
    {
      name: 'tg-bot',
      cwd: './',
      script: 'bot/bot.ts',
      interpreter: 'node',
      interpreter_args: ['-r', 'ts-node/register'],
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'twitch-miner',
      cwd: './',
      script: 'stream-watcher/src/main.ts',
      interpreter: 'node',
      interpreter_args: ['-r', 'ts-node/register'],
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};