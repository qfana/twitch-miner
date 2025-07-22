import { Telegraf, session, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { Stage } from 'telegraf/scenes';
import { FarmHandlerService } from './services/FarmHandler';
import { UserService } from './services/UserService';
import { IUserService } from './services/UserService.interface';
import { IFarmHandlerService } from './services/FarmHandler.inteface';
dotenv.config();


export interface BotContext extends Context {
  session: {
    step?: 'token' | 'games' | 'fallback';
  };
}

export class BotManager {
    private bot: Telegraf<BotContext>;
    private userService: IUserService;
    private farmHandlerService: IFarmHandlerService;

    constructor () {
        this.bot = new Telegraf<BotContext>(process.env.TELEGRAM_TOKEN!);
        this.userService = new UserService(this.bot);
        this.farmHandlerService = new FarmHandlerService(this.bot);

        this.Init();
        this.InitHears();
    }

    private async Init(): Promise<void> {
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

    private async _startFarm(ctx: BotContext) {
       this.farmHandlerService.StartFarming(ctx);
    }

    private async _stopFarm(ctx: BotContext) {
        this.farmHandlerService.StopFarming(ctx);
    }

    private async _settings(ctx: BotContext) {
        this.userService.Settings(ctx);
    }

    private async _status(ctx: BotContext) {
        this.farmHandlerService.GetStatus(ctx);
    }

    private async _subscribe(ctx: BotContext) {
        this.userService.Subscribe(ctx);
    }
}

const test = new BotManager();
test.launch();
