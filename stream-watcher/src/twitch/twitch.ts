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

		console.log('[DEBUG] Открываем страницу кампаний с дропсами...');
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
		console.log('[DEBUG] Прокрутка завершена.');

		// Проверим количество всех accordion-блоков
		const accordionCount = await page.$$eval('button.accordion-header', nodes => nodes.length);
		console.log(`[DEBUG] Найдено accordion-блоков: ${accordionCount}`);

		// Извлекаем полную структуру (innerHTML и textContent) каждого
		const gameNames = await page.$$eval('button.accordion-header', (buttons) => {
			const result: string[] = [];

			buttons.forEach((btn, index) => {
				const paragraphs = btn.querySelectorAll('p');
				const logParts = [`[DEBUG] [${index}] <p> count: ${paragraphs.length}`];

				paragraphs.forEach((p, pIndex) => {
					logParts.push(`[p${pIndex}] text: "${p.textContent?.trim()}"`);
				});

				const name = paragraphs.length >= 1 ? paragraphs[0].textContent?.trim() : null;
				if (name) {
					result.push(name);
					logParts.push(`[DEBUG] Добавлено имя: "${name}"`);
				}

				console.log(logParts.join(' | '));
			});

			return result;
		});

		console.log('[DEBUG] Имена игр до обработки:', gameNames);

		await page.close();

		const slugs = gameNames
			.map(name =>
				name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-') // всё кроме a-z и 0–9 на дефис
					.replace(/(^-+|-+$)/g, '')   // удалить дефисы с начала/конца
			)
			.filter(Boolean);

		console.log('[DEBUG] Активные игры с дропсами:', slugs);

		return [...new Set(slugs)];
	}

}