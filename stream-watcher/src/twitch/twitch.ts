import fs from 'fs';
import { BrowserService } from "../browser/browser";
import { ITwitchService } from "./twitch.interface";

function hasCampaignStarted(dateRange: string): boolean {
    // русские месяцы в формате "янв.", "фев.", ... без точки / с точкой
    const monthsMap: Record<string, number> = {
        'янв,': 0, 'фев,': 1, 'мар,': 2, 'апр,': 3, 'май,': 4, 'июн,': 5,
        'июл,': 6, 'авг,': 7, 'сен,': 8, 'окт,': 9, 'ноя,': 10, 'дек,': 11
    };

    // 1. Отделяем часть до дефиса
    const [startPart] = dateRange.split(' - ');
    // пример startPart: "вт, 24 июн., 18:00"

    // 2. Убираем день недели и запятые, остаётся "24 июн. 18:00"
    const cleaned = startPart
        .replace(/^[^,]*,\s*/, '')     // убираем "вт, "
        .replace(/\./g, '')            // убираем точки из "июн."
        .trim();                       // "24 июн 18:00"

    // 3. Разбиваем на дату и время
    const [dayStr, monthStr, timeStr] = cleaned.split(/\s+/);
    const [hourStr, minuteStr] = timeStr.split(':');

    const day   = parseInt(dayStr, 10);
    const month = monthsMap[monthStr.toLowerCase()];
    const hour  = parseInt(hourStr, 10);
    const minute= parseInt(minuteStr, 10);

    // 4. Берём текущий год
    const now    = new Date();
    const year   = now.getFullYear();

    // 5. Собираем дату старта в локальной временной зоне
    const startDate = new Date(year, month, day, hour, minute);

    // 6. Сравниваем
    return now.getTime() >= startDate.getTime();
}
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
  		const campaigns: { name: string; dateText: string }[] = await page.$$eval(
  		  	'.accordion-header',
  		  	headers => headers.map(header => {
  		  	  	// 1) имя кампании
  		  	  	const nameDiv = Array.from(
  		  	  	  	header.querySelectorAll('div.Layout-sc-1xcs6mc-0')
  		  	  	).find(d => d.classList.contains('hJWyGb'));
  		  	  	const name = nameDiv
  		  	  	  	?.querySelector('img.tw-image.alt')
  		  	  	  	?.textContent?.trim() ?? '';
			  
  		  	  	// 2) текст с диапазоном дат из div.caYeGJ
  		  	  	const dateDiv = header.querySelector('div.Layout-sc-1xcs6mc-0.caYeGJ');
  		  	  	const dateText = dateDiv?.textContent?.trim() ?? '';
			  
  		  	  	return { name, dateText };
  		  	})
  		);

	    console.log('[DEBUG] Всего кампаний:', campaigns.length);

	    // Оставляем только те, у которых дата начала >= сегодня
	    const active = campaigns.filter(({ dateText }) => {
	        return hasCampaignStarted(dateText);
	    });

	    console.log('[DEBUG] Активных по дате кампаний:', active.length);

	    await page.close();

		console.log(active)

	    // Преобразуем названия в слаги
	    const slugs = Array.from(new Set(
    	    active.map(({ name }) =>
    	        name
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