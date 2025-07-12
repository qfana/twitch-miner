export interface ITwitchService {
    getTwitchDropChannel(gameName: string): Promise<string | null>;
    getActiveDropGameSlugs(): Promise<string[]>;
}