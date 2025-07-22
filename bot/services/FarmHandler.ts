import { Telegraf } from "telegraf";
import { BotContext } from "../bot";
import { IFarmHandlerService } from "./FarmHandler.inteface";

export class FarmHandlerService implements IFarmHandlerService {
    private bot: Telegraf<BotContext>

    constructor(bot: Telegraf<BotContext>) {
        this.bot = bot;
    }
        
    GetStatus(ctx: BotContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    StartFarming(ctx: BotContext): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    StopFarming(ctx: BotContext): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}