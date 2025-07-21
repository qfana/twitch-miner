import { Telegraf, session, Context } from 'telegraf';
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

        this.bot.inlineQuery('hello', (ctx) => ctx.answerCbQuery('Hello!'));

        
    }

    public async launch() {
        await this.bot.launch();
        console.log('Telegram bot launched');
    }
}

const test = new BotManager();
test.launch();
