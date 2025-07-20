import { Telegraf, session, Context, Scenes } from 'telegraf';

interface BotContext extends Context {
  session: {
    step?: 'token' | 'games' | 'fallback';
  };
}

export class BotManager {
    private bot: Telegraf<BotContext>;

    constructor () {
        this.bot = new Telegraf<BotContext>(process.env.TELEGRAM_TOKEN!);

        this.Init();
    }

    public async Init() {
        this.bot.use(session());

        this.bot.start(ctx => ctx.reply('Добро пожаловать!'));
        this.bot.help(ctx => ctx.reply('Используйте кнопки меню ниже.'));


        this.bot.command('menu', ctx => {
          ctx.reply('Главное меню', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Настройки ⚙️', callback_data: 'MENU_SETTINGS' }],
                [{ text: 'Запустить фарм ▶️', callback_data: 'MENU_START_FARM' }],
                [{ text: 'Остановить фарм ⏹️', callback_data: 'MENU_STOP_FARM' }],
                [{ text: 'Статус 📊', callback_data: 'MENU_STATUS' }],
                [{ text: 'Подписка 💳', callback_data: 'MENU_SUBSCRIBE' }],
              ],
            },
          });
        });
    }

    public async launch() {
        await this.bot.launch();
        console.log('Telegram bot launched');
    }
}

const test = new BotManager();