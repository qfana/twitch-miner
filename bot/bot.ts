import { Telegraf, session, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { Stage } from 'telegraf/scenes';
dotenv.config();


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

        this.bot.start(ctx => {
              return ctx.reply(
                'Привет! Чем займёмся?',
                Markup.keyboard([
                  ['▶️ Запустить фарм', '⏹️ Остановить фарм'],
                  ['⚙️ Настройки', '📊 Статус'],
                  ['💳 Подписка']
                ])
                .resize()      // подогнать размер
                .oneTime(false) // оставить клавиатуру после первого нажатия
              );
            });
    }

    public async launch() {
        await this.bot.launch();
        console.log('Telegram bot launched');
    }
}

const test = new BotManager();
test.launch();
