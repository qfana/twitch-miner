import fs from 'fs';
import { BrowserService } from "../browser/browser";
import { ITwitchService } from "./twitch.interface";
import { ElementHandle, BrowserContext } from 'puppeteer';
import fetch from 'node-fetch';

async function isLiveByPreview(login: string): Promise<boolean> {
  const url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-80x45.jpg`;
  const res = await fetch(url, { method: 'HEAD' });
  const len = Number(res.headers.get('content-length') || 0);
  return len > 1000; // если превью >1 КБ — вероятно, стрим идёт
}


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
		console.log(`[TwitchService] Поиск активных стримов для игры ${gameSlug}`);
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
	    }

	    // каждая .accordion-header это кампания
  		const campaigns: { name: string; dateText: string; }[] = await page.$$eval(
  		  	'.accordion-header',
  		  	headers => headers.map(header => {
  		  	  	// 1) имя кампании
  		  	  	const img = header.querySelector<HTMLImageElement>('img.tw-image');
  		  	  	const name = img?.alt.trim() ?? '';

  		  	  	// 2) текст с диапазоном дат из div.caYeGJ
  		  	  	const dateDiv = header.querySelector('div.Layout-sc-1xcs6mc-0.caYeGJ');
  		  	  	const dateText = dateDiv?.textContent?.trim() ?? '';
			  
  		  	  	return { name, dateText };
  		  	})
  		);

	    // Оставляем только те, у которых дата начала >= сегодня
	    const active = campaigns.filter(({ dateText }) => {
	        return hasCampaignStarted(dateText);
	    });

	    await page.close();

	    // Преобразуем названия в слаги
	    const slugs = Array.from(new Set(
    	    active.map(({ name }) =>
    	        name
    	            .toLowerCase()
    	            .replace(/[^a-z0-9]+/g, '-')
    	            .replace(/(^-+|-+$)/g, '')
    	    )
    	));

	    	    console.log(`[DEBUG] Всего/${campaigns.length} / ${active.length} / ${slugs.length} `);
	    return slugs;
	}


	// Метод для проверки, есть ли незавершённые дропы по игре
	/**
	 * true  — если ещё можно получить дроп за просмотр стрима;
	 * false — если дроп уже получен или недоступен.
	 */
	public async isDropClaimed(slug: string): Promise<boolean> {
	  	const ctx = this.browserService.getContext();
	  	const page = await ctx.newPage();
		
	  	// 1) Заходим в инвентарь
	  	await page.goto('https://www.twitch.tv/drops/inventory', {
	  	  	waitUntil: 'networkidle2',
	  	  	timeout: 60000,
	  	});
	  
	  	// 2) Закрываем баннер согласия, если он вылез
	  	const consent = await page.$('button[data-a-target="consent-banner-accept"]');
	  	if (consent) {
	  	  	await consent.click();
	  	  	await new Promise(resolve => setTimeout(resolve, 2000));
	  	  	await page.reload({ waitUntil: 'networkidle2' });
	  	}
	  
	  	// 3) Ждём пока подгрузится список «В процессе»
		await page.waitForSelector(
		  	'div.inventory-page div.inventory-max-width',
		  	{ timeout: 15_000 }
		);

	  	// 4) Находим карточку, в которой внутри есть ссылка на нужный slug
	  	const cards = await page.$$('p[data-test-selector="DropsCampaignInProgressDescription-hint-text-parent"]');
  		let campaignCard = null;
  		for (const card of cards) {
  		  	const link = await card.$(`a[href*="/directory/category/${slug}"]`);

  		  	if (link) {
  		  	  campaignCard = card;
  		  	  break;
  		  	}
  		}
		
	  	if (!campaignCard) {
	  	  	// либо дроп не начался, либо мы его уже выкупили (его уже нет в «В процессе»)
	  	  	await page.close();
	  	  	return false;   // → «надо смотреть» (не получен на 100%)
	  	}
	  
	  	// 5) Собираем все прогресс-бары внутри найденной карточки
  		const bars = await campaignCard.$$('div.tw-progress-bar');
		if (!bars.length) return true // Не нужно смотреть, так-как все награды получены
  		for (const bar of bars) {
  		  	// корректно типизируем el как Element
  		  	const now = Number(await bar.evaluate((el: Element) => el.getAttribute('aria-valuenow')));
  		  	const max = Number(await bar.evaluate((el: Element) => el.getAttribute('aria-valuemax')));
  		  	if (now < max) {
  		  	  	// Есть незавершённый шаг — дроп ещё можно получить
  		  	  	await page.close();
				console.log('now < max', now, max)
  		  	  	return true;
  		  	}
  		}
	  
	  	// 6) Если все бары на 100%
	  	await page.close();
	  	return false;  // → «не смотреть»
	}

	public async getFirstOnlineChannel(login: string): Promise<boolean> {
	    const url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-80x45.jpg`;
  		const res = await fetch(url, { method: 'HEAD' });
  		const len = Number(res.headers.get('content-length') || 0);
  		return len > 1000;
  	}


}