import { IFarmStatus } from "../../stream-watcher/src/types";
import { BotContext } from "../bot";

export interface IFarmHandlerService {
    GetStatus(ctx: BotContext): Promise<void>;
    StartFarming(ctx: BotContext): Promise<boolean>;
    StopFarming(ctx: BotContext): Promise<boolean>;
}