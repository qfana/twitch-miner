import { IBrowserService } from "../browser/browser.interface";
import { ITwitchService } from "../twitch/twitch.interface";
import { GamePriority } from "../types";
import { IWatcherService } from "./wathcer.interface";

export class WatcherService implements IWatcherService {
    private readonly CHECK_INTERVAL = 1000 * 60 * 5; // 5 minutes
    private intervalId?: NodeJS.Timeout;
    private currentStream?: string;

    constructor(
		private readonly twitchService: ITwitchService,
		private readonly browserService: IBrowserService,
		private readonly gamePriorityList: GamePriority[], // список slug'ов
        private readonly fallbackChannels: string[]
	) {}

    public async startWatching(): Promise<void> {
        console.log('👀 WatcherService запущен');
		await this.checkAndWatch();

		this.intervalId = setInterval(() => {
			this.checkAndWatch().catch(err => console.error('[WatcherService] Ошибка при проверке:', err));
		}, this.CHECK_INTERVAL);
    }

    public async stopWatching(): Promise<void> {
		if (this.intervalId) clearInterval(this.intervalId);
		await this.browserService.destroy();
		console.log('🛑 WatcherService остановлен');
	}

    private async checkAndWatch(): Promise<void> {
        for (const game of this.gamePriorityList) {
        	const channel = await this.twitchService.getTwitchDropChannel(game.slug);
        	if (channel) {
				await this.switchToStream(channel);
				return;
        	}
        }
    
        console.log('⚠️ Нет активных дропов — переключаемся на fallback стримы');
        for (const fallback of this.fallbackChannels) {
        	await this.switchToStream(fallback);
        	return;
        }
        
        console.log('⛔ Нет доступных стримов вообще');
    }

    private async switchToStream(channel: string): Promise<void> {
		if (this.currentStream === channel) return;

		console.log(`🔁 Переключение на новый стрим: ${channel}`);
		await this.browserService.destroy(); // Закрываем предыдущие стримы
		await this.browserService.openStream(channel);
		this.currentStream = channel;
	}
}