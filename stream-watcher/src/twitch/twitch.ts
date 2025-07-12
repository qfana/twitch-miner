import fs from 'fs';
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

		console.log('[DEBUG] Загружаем страницу...');
		await page.goto('https://www.twitch.tv/drops/campaigns', {
			waitUntil: 'domcontentloaded',
			timeout: 60000,
		});

		console.log('[DEBUG] Начинаем прокрутку страницы...');
		await page.evaluate(async () => {
			for (let i = 0; i < 15; i++) {
				window.scrollBy(0, window.innerHeight);
				await new Promise(resolve => setTimeout(resolve, 400));
			}
		});
		console.log('[DEBUG] Прокрутка завершена. Начинаем сбор названий...');

		const names = await page.$$eval('button.accordion-header p', (nodes) =>
			nodes.map(el => el.textContent?.trim()).filter(Boolean)
		);

		await page.close();

		const slugs = names
			.map(name => name!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, ''))
			.filter(Boolean);

		console.log('[DEBUG] Активные игры с дропсами:', slugs);
		return [...new Set(slugs)];
	}

	// Метод для проверки, есть ли незавершённые дропы по игре
	public async isDropClaimed(slug: string): Promise<boolean> {
		const context = this.browserService.getContext();
		const page = await context.newPage();

		await page.goto('https://www.twitch.tv/drops/inventory', {
			waitUntil: 'domcontentloaded',
			timeout: 60000,
		});

		console.log('[DEBUG] Проверяем инвентарь на предмет игры:', slug);

		// Ждём, пока подгрузятся элементы дропа
		await page.waitForSelector('div[data-a-target="drop-campaign-card"]', { timeout: 15000 });

		const isClaimed = await page.$$eval('div[data-a-target="drop-campaign-card"]', (cards, targetSlug) => {
			return !cards.some(card => {
				const gameName = card.querySelector('p')?.textContent?.toLowerCase() || '';
				const transformed = gameName.replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
				return transformed === targetSlug;
			});
		}, slug);

		await page.close();
		console.log(`[DEBUG] Для ${slug} получен дроп:`, isClaimed);
		return isClaimed;
	}

}