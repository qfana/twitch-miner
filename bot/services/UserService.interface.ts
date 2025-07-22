import { BotContext } from "../bot";

export interface IUserService {
    Settings(ctx: BotContext): Promise<void>;
    Subscribe(ctx: BotContext): Promise<void>;
}