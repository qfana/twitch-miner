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

		await page.setViewport({
			width: 1280,
			height: 3000,
		});

		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');


		console.log('[DEBUG] Загружаем страницу...');
		await page.goto('https://www.twitch.tv/drops/campaigns', {
			waitUntil: 'domcontentloaded',
			timeout: 60000,
		});

		console.log('[DEBUG] Начинаем прокрутку и сбор названий по ходу...');

		const collectedNames = new Set<string>();

		for (let i = 0; i < 50; i++) {
			// Собираем текущие видимые элементы
			const newNames = await page.$$eval('p.CoreText-sc-1txzju1-0.dzXkjr', (nodes) =>
				nodes.map(el => el.textContent?.trim()).filter(Boolean)
			);

			newNames.forEach(name => {
				if (name) collectedNames.add(name);
			});

			await page.evaluate(() => window.scrollBy(0, window.innerHeight));
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		await page.close();

		const slugs = Array.from(collectedNames)
			.map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, ''))
			.filter(Boolean);

		console.log('[DEBUG] Активные игры с дропсами:', slugs);
		return slugs;
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

		// Ждём, пока подгрузятся прогресс-бары
		await page.waitForSelector('div[role="progressbar"]', { timeout: 15000 });

		const hasUnfinishedDrop = await page.$$eval('div[role="progressbar"]', (bars, targetSlug) => {
			return bars.some(bar => {
				const parentCard = bar.closest('div[data-a-target="drop-campaign-card"]');
				if (!parentCard) return false;
				const gameName = parentCard.querySelector('p')?.textContent?.toLowerCase() || '';
				const transformed = gameName.replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
				const progress = parseInt(bar.getAttribute('aria-valuenow') || '0', 10);
				return transformed === targetSlug && progress < 100;
			});
		}, slug);

		await page.close();
		console.log(`[DEBUG] Для ${slug} незавершённый дроп найден:`, hasUnfinishedDrop);
		return !hasUnfinishedDrop;
	}

}