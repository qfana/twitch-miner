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

	// Метод для получения списка активных игр с дропсами (Dashboard)
	public async getActiveDropGameSlugs(): Promise<string[]> {
	    const context = this.browserService.getContext();
	    const page = await context.newPage();

	    console.log('[DEBUG] Открываем Viewer Rewards Drops...');
	    await page.goto('https://dashboard.twitch.tv/viewer-rewards/drops', {
	        waitUntil: 'networkidle0',
	        timeout: 60000,
	    });

	    // Закрываем баннер согласия, если он есть
	    const accept = await page.$('button[data-a-target="consent-banner-accept"]');
	    if (accept) {
	        console.log('[DEBUG] Нажимаем Accept и ждём обновления');
	        await accept.click();
	        await new Promise(resolve => setTimeout(resolve, 2000));
	        await page.reload({ waitUntil: 'networkidle0' });
	    }

		await page.screenshot({ path: 'screenshot.png' });

	    console.log('[DEBUG] Собираем все карточки кампаний без прокрутки...');
	    // каждая .accordion-header это кампания
	    const campaigns = await page.$$eval('.accordion-header', nodes =>
	        nodes.map(node => {
	            const titleEl = node.querySelector('p.CoreText-sc-1txzju1-0.dzXkjr');
	            const dateEl = node.querySelector('p.CoreText-sc-1txzju1-0.jPfhdT');
	            if (!titleEl || !dateEl) return null;
	            const title = titleEl.textContent?.trim() || '';
	            const dateText = dateEl.textContent?.trim() || '';
	            return { title, dateText };
	        }).filter((c): c is { title: string; dateText: string } => !!c)
	    );

	    console.log('[DEBUG] Всего кампаний:', campaigns.length);

	    // Оставляем только те, у которых дата начала >= сегодня
	    const now = new Date();
	    const active = campaigns.filter(({ dateText }) => {
	        // dateText формат: "Sat, Jun 28, 6:00 PM GMT+3 - Mon, Aug 4, 6:00 PM GMT+3"
	        const startPart = dateText.split('-')[0].trim();
	        const startDate = new Date(startPart);
	        return startDate >= now;
	    });

	    console.log('[DEBUG] Активных по дате кампаний:', active.length);

	    await page.close();

	    // Преобразуем названия в слаги
	    const slugs = Array.from(new Set(
	        active.map(({ title }) =>
	            title
	                .toLowerCase()
	                .replace(/[^a-z0-9]+/g, '-')
	                .replace(/(^-+|-+$)/g, '')
	        )
	    ));

	    console.log('[DEBUG] Активные игры с дропсами (слуги):', slugs);
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