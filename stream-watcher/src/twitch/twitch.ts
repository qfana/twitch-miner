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

		console.log('[DEBUG] Начинаем прокрутку страницы');

		// РЕАЛЬНЫЙ СКРОЛЛ ДО КОНЦА СТРАНИЦЫ
		let previousHeight = await page.evaluate('document.body.scrollHeight');
		let attempts = 0;

		while (attempts < 5) {
			await page.evaluate(() => {
				window.scrollBy(0, window.innerHeight);
			});
			await new Promise(resolve => setTimeout(resolve, 700));
			const currentHeight = await page.evaluate('document.body.scrollHeight');

			if (currentHeight === previousHeight) {
				attempts++;
			} else {
				attempts = 0;
				previousHeight = currentHeight;
			}
		}

		console.log('[DEBUG] Прокрутка завершена. Начинаем сбор заголовков...');

		const gameNames = await page.$$eval('div[role="heading"][aria-level="3"]', (headers) =>
			headers.map(header => {
				const ps = header.querySelectorAll('p');
				let gameName = '';
			
				if (ps.length === 1) {
					gameName = ps[0].textContent?.trim() ?? '';
				} else if (ps.length >= 2) {
					// Если второй параграф — это название игры (как "PUBG: BATTLEGROUNDS")
					gameName = ps[1].textContent?.trim() ?? ps[0].textContent?.trim() ?? '';
				}
			
				return gameName;
			}).filter(name => !!name && name.length > 0)
		);


		await page.close();

		const slugs = gameNames
			.map(name => name
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '-')
				.replace(/(^-+|-+$)/g, '')
			)
			.filter(Boolean);

		console.log('[DEBUG] Активные игры с дропсами:', slugs);

		return [...new Set(slugs)];
	}

}