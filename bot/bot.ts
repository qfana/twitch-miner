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
        this.InitHears();
    }

    private async Init() {
        this.bot.use(session());
        
        this.bot.start(ctx => {
            return ctx.reply(
                'Привет! Чем займёмся?',
                Markup.keyboard([
                    ['▶️ Запустить фарм', '⏹️ Остановить фарм'],
                    ['⚙️ Настройки',       '📊 Статус'],
                    ['💳 Подписка']
                ])
                .resize()
                .oneTime(false)
            );
        });
    }

    private async InitHears() {
        this.bot.hears('▶️ Запустить фарм', this._startFarm.bind(this));
        this.bot.hears('⏹️ Остановить фарм', this._stopFarm.bind(this));
        this.bot.hears('⚙️ Настройки', this._settings.bind(this));
        this.bot.hears('📊 Статус', this._status.bind(this));
        this.bot.hears('💳 Подписка', this._subscribe.bind(this));
    }

    public async launch() {
        await this.bot.launch();
        console.log('Telegram bot launched');
    }

    private async _startFarm(...args: any[]) {
        console.log(...args)
    }

    private async _stopFarm(...args: any[]) {
        
    }

    private async _settings() {
        
    }

    private async _status() {
        
    }

    private async _subscribe() {
        
    }
}

const test = new BotManager();
test.launch();
