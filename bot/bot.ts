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
                Markup.inlineKeyboard([
                    [ Markup.button.callback('▶️ Запустить фарм', 'START_FARM') ],
                    [ Markup.button.callback('⏹️ Остановить фарм', 'STOP_FARM') ],
                    [ Markup.button.callback('⚙️ Настройки',    'SETTINGS')   ],
                    [ Markup.button.callback('📊 Статус',       'STATUS')     ],
                    [ Markup.button.callback('💳 Подписка',     'SUBSCRIBE')  ],
                ])
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
