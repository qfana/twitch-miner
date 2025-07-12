import { BrowserService } from "../browser/browser";
import { ITwitchService } from "./twitch.interface";

export class TwitchService implements ITwitchService {
	constructor(private readonly browserService: BrowserService) {}
    
	public async getTwitchDropChannel(gameSlug: string): Promise<string | null> {
		const context = this.browserService.getContext();
		const page = await context.newPage();

		await page.goto(`https://www.twitch.tv/directory/category/${gameSlug}?filter=drops`, {
			waitUntil: 'domcontentloaded',
			timeout: 60000
		});

		const acceptBtn = await page.$('button[data-a-target="consent-banner-accept"]');
		if (acceptBtn) {
			await acceptBtn.click();
			await new Promise(resolve => setTimeout(resolve, 1000)); // дать время странице обновиться
		}


		try {
			await page.waitForSelector('a[data-a-target="preview-card-title-link"]', { timeout: 15000 });

		} catch (err) {
			console.warn(`[TwitchService] Нет активных стримов для игры ${gameSlug}`);
			await page.close();
			return null;
		}

		const channels: { name: string; viewers: number }[] = await page.$$eval('div[data-a-target="preview-card"]', (cards) => {
			return cards
				.map(card => {
					const dropsBadge = card.innerText.includes('DropsВключены') || card.innerText.includes('DropsEnabled');
					if (!dropsBadge) return null;
				
					const link = card.querySelector('a[data-a-target="preview-card-title-link"]');
					const viewersText = card.querySelector('[data-a-target="tw-stat-text"]')?.textContent || '';
				
					let viewers = 0;
					if (viewersText.includes('тыс.')) {
						viewers = parseFloat(viewersText.replace(/[^\d.]/g, '')) * 1000;
					} else {
						viewers = parseInt(viewersText.replace(/[^\d]/g, ''));
					}
				
					return {
						name: link?.getAttribute('href')?.replace('/', '') || '',
						viewers,
					};
				})
				.filter((x): x is { name: string; viewers: number } => Boolean(x)); // 👈 фильтрация с типизацией
		});

		await page.close();
		await context.close();

		if (!channels.length) return null;

		console.log(channels)
		const minViewers = channels.reduce((prev, curr) => (prev.viewers < curr.viewers ? prev : curr));
		return minViewers.name;
	}

	async hasActiveDropCampaign(fullGameName: string): Promise<boolean> {
		const context = this.browserService.getContext();
		const page = await context.newPage();

		await page.goto('https://www.twitch.tv/drops/campaigns', {
			waitUntil: 'domcontentloaded',
			timeout: 60000
		});

		// Ожидаем, пока React подгрузит список кампаний
		await page.waitForSelector('a[href*="/directory/category/"]', { timeout: 15000 });

		const gamesWithDrops = await page.$$eval('a[href*="/directory/category/"]', (elements) =>
			elements.map((el) => el.textContent?.trim())
		);

		await page.close();

		return gamesWithDrops.includes(fullGameName);
	}
}