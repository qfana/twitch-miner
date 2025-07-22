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
                    [ Markup.button.callback('▶️ Запустить фарм', 'START_FARM') ],
                    [ Markup.button.callback('⏹️ Остановить фарм', 'STOP_FARM') ],
                    [ Markup.button.callback('⚙️ Настройки',    'SETTINGS')   ],
                    [ Markup.button.callback('📊 Статус',       'STATUS')     ],
                    [ Markup.button.callback('💳 Подписка',     'SUBSCRIBE')  ],
                ])
            );
        });

        // this.bot.hears('▶️ Запустить фарм', ctx => ctx.reply('Фарм запущен!'));
        // this.bot.hears('⏹️ Остановить фарм', ctx => ctx.reply('Фарм остановлен'));
        // this.bot.hears('⚙️ Настройки', ctx => ctx.reply('Здесь настройки...'));
        // this.bot.hears('📊 Статус', ctx => ctx.reply('Ваш статус...'));
        // this.bot.hears('💳 Подписка', ctx => ctx.reply('Информация о подписке...'));
    }

    public async launch() {
        await this.bot.launch();
        console.log('Telegram bot launched');
    }

}

const test = new BotManager();
test.launch();
