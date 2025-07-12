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
			await page.waitForSelector('a.preview-card-channel-link', {
				timeout: 30000
			});
		} catch (err) {
			console.warn(`[TwitchService] Нет активных стримов для игры ${gameSlug}`);
			await page.close();
			return null;
		}

		const channels: ({ name: string; viewers: number } | null)[] = await page.$$eval('a.preview-card-channel-link', (links) => {
			return links.map(link => {
				const href = link.getAttribute('href');
				if (!href) return null;
				return { name: href.replace('/', ''), viewers: 0 }; // viewers позже, если нужно
			}).filter(Boolean);
		});
	
		await page.close();
	
		if (!channels.length) return null;
	
		// Можно сделать случайный выбор или вернуть первый:
		const random = channels[Math.floor(Math.random() * channels.length)];
		return random?.name || null;
	}

	public async getActiveDropGameSlugs(): Promise<string[]> {
		const context = this.browserService.getContext();
		const page = await context.newPage();

		await page.goto('https://www.twitch.tv/drops/campaigns', {
			waitUntil: 'domcontentloaded',
			timeout: 60000,
		});

		await page.waitForSelector('div[role="heading"][aria-level="3"] p', { timeout: 15000 });

		const gameNames = await page.$$eval('div[role="heading"][aria-level="3"] p', (nodes) =>
			nodes.map(n => n.textContent?.trim()).filter(Boolean)
		);

		await page.close();

		const slugs = gameNames
			.map(name => (name ?? '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '-')
				.replace(/(^-+|-+$)/g, '')
			)
			.filter(Boolean);

		return [...new Set(slugs)];
	}
}