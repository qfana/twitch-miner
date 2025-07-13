import { IActivityService } from "../activity/activite.interface";
import { IBrowserService } from "../browser/browser.interface";
import { ITwitchService } from "../twitch/twitch.interface";
import { GamePriority } from "../types";
import { IWatcherService } from "./wathcer.interface";

export class WatcherService implements IWatcherService {
    private readonly CHECK_INTERVAL = 1000 * 5; // 5 sec
    private intervalId?: NodeJS.Timeout;
    private currentStream?: string | null;
	private currentFarmingSlug: string | null = null;
	private counterTicks?: number;

    constructor(
		private readonly twitchService: ITwitchService,
		private readonly browserService: IBrowserService,
		private readonly activityService: IActivityService,
		private readonly gamePriorityList: GamePriority[], // список slug'ов
        private readonly fallbackChannels: string[]
	) {}

    public async startWatching(): Promise<void> {
		this.intervalId = setInterval(() => {
			this._every5sec();
		}, this.CHECK_INTERVAL);
    }

	private async _every5sec(): Promise<void> {
		if (!this.counterTicks && this.counterTicks !== 0) {
			this.counterTicks = 0
			await this.checkAndWatch().catch(err => console.error('[WatcherService] Ошибка при проверке:', err));
		} else {
			this.counterTicks++;
		}


		if (this.currentStream) {
			const page = this.browserService.getPages()[0];

			const pageUrl = page?.url();

			if (!pageUrl || !pageUrl.includes(this.currentStream)) {
				this.activityService.stop();
				this.currentStream = null;
			};
		}


		if (this.counterTicks % 3 === 0) this._every15sec();
		if (this.counterTicks % 6 === 0) this._every30sec();
		if (this.counterTicks % 60 === 0) this._every15min();
	}

	private async _every15sec(): Promise<void> {
		this.activityService.every15sec();
	}

	private async _every30sec(): Promise<void> {
		this.activityService.every30sec();
	}

	private async _every15min(): Promise<void> {
		console.log('[WatcherService] 15 MINUTES CHECKS STARTED');
		if (this.currentFarmingSlug) { 
			const channel = await this.twitchService.getTwitchDropChannel(this.currentFarmingSlug);

			if (channel) {
				await this.switchToStream(channel);
				return;
			}
		}

		await this.checkAndWatch().catch(err => console.error('[WatcherService] Ошибка при проверке:', err));
	}

    public async stopWatching(): Promise<void> {
		if (this.intervalId) clearInterval(this.intervalId);
		await this.browserService.destroy();
		console.log('🛑 WatcherService остановлен');
	}	

	private async checkAndWatch(): Promise<void> {
		const activeDropSlugs = await this.twitchService.getActiveDropGameSlugs();

		for (const game of this.gamePriorityList) {
			if (!activeDropSlugs.includes(game.slug)) continue;

			const alreadyClaimed = await this.twitchService.isDropClaimed(game.slug);
			if (alreadyClaimed) {
				console.log(`[DEBUG] Дроп по ${game.slug} уже получен, пропускаем`);
				continue;
			}

			const channel = await this.twitchService.getTwitchDropChannel(game.slug);
			if (channel) {
				this.currentFarmingSlug = game.slug;           // запомним, что этим slug сейчас занимаемся
				await this.switchToStream(channel);
				return;
			}
		}

		console.log('⚠️ Нет активных дропов — переключаемся на fallback стримы');
		for (const fallback of this.fallbackChannels) {
			const lived = await this.twitchService.getFirstOnlineChannel(fallback);
			if (lived) {
				await this.switchToStream(fallback);
				return;
			}
		}

		console.log('⛔ Нет доступных стримов вообще');
	}

    private async switchToStream(channel: string): Promise<void> {
		if (this.currentStream === channel) return;

		console.log(`🔁 Переключение на новый стрим: ${channel}`);
		await this.browserService.destroy(); // Закрываем предыдущие стримы
		await this.browserService.openStream(channel);
		this.currentStream = channel;

		this.activityService.start();
	}
}