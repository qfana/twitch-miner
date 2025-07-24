import { Markup, Telegraf } from 'telegraf';
import { BotContext } from '../bot';
import { IUserService } from './UserService.interface';
import { inlineKeyboard } from 'telegraf/typings/markup';

const TEXTS = {
    SETTINGS: `*Настройки*

🔑 *Установить ключ аутентификации*  
_Введите ваш Twitch Auth Token, чтобы бот мог авторизоваться под вашим аккаунтом и собирать дропсы._

🎮 *Настройка игр*  
_Укажите список игр (их slug’ов) через запятую, например «rust, diablo-iv, escape-from-tarkov». Бот будет отслеживать дроп‑кампании именно по этим играм._

📺 *Настройка стримеров*  
_Добавьте резервных стримеров (логины через запятую). Если активных дропов по выбранным играм не найдётся, бот переключится на этих fallback‑каналов._`

}
export class UserService implements IUserService {
    private bot: Telegraf<BotContext>;

    constructor(bot: Telegraf<BotContext>) {
        this.bot = bot;
    }

    async Settings(ctx: BotContext): Promise<void> {

        await ctx.reply(
            TEXTS.SETTINGS,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [ Markup.button.callback('🔑 Установить ключ аутентификации', 'SET_AUTH_KEY') ],
                    [ Markup.button.callback('🎮 Настройка игр',                'SET_DROPS_GAME') ],
                    [ Markup.button.callback('📺 Настройка стримеров',           'SET_FALLBACK')  ],
                ])
            }
        );
    }

    async Subscribe(ctx: BotContext): Promise<void> {
        throw new Error('Method not implemented.');
    }
}