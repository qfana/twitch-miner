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

		await page.waitForSelector('a[data-a-target="preview-card-title-link"]', { timeout: 15000 });

		const channels = await page.$$eval('a[data-a-target="preview-card-title-link"]', (elements) => {
			return elements.map((el) => {
				const parent = el.closest('div[data-a-target="preview-card"]')!;
				const viewersText = parent.querySelector('[data-a-target="tw-stat-text"]')?.textContent || '';

				let viewers = 0;
				if (viewersText.includes('тыс.')) {
					viewers = parseFloat(viewersText.replace(/[^\d.]/g, '')) * 1000;
				} else {
					viewers = parseInt(viewersText.replace(/[^\d]/g, ''));
				}

				return {
					name: el.getAttribute('href')?.replace('/', '') || '',
					viewers
				};
			});
		});

		await page.close();
		await context.close();

		if (!channels.length) return null;

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