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

	    console.log('[DEBUG] Всего кампаний:', campaigns.length);

		console.log(campaigns)
	    // Оставляем только те, у которых дата начала >= сегодня
	    const active = campaigns.filter(({ dateText }) => {
	        return hasCampaignStarted(dateText);
	    });

	    console.log('[DEBUG] Активных по дате кампаний:', active.length);

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

	    console.log('[DEBUG] Активные игры с дропсами (слуги):', slugs);
	    return slugs;
	}


	// Метод для проверки, есть ли незавершённые дропы по игре
	public async isDropClaimed(slug: string): Promise<boolean> {
		const ctx = this.browserService.getContext();
 		const page = await ctx.newPage();

 		// Заходим на страницу инвентаря Drops
 		await page.goto('https://www.twitch.tv/drops/inventory', {
 		  	waitUntil: 'networkidle0',
 		  	timeout: 60000,
 		});

 		// Если есть баннер cookie — закрываем его
 		const consent = await page.$('button[data-a-target="consent-banner-accept"]');
 		if (consent) {
 		  	await consent.click();
 		  	await new Promise(resolve => setTimeout(resolve, 2000));
 		  	await page.reload({ waitUntil: 'networkidle0' });
 		}

 		// Ждём, пока прогрузятся карточки инвентаря
 		await page.waitForSelector('div[data-a-target="drop-campaign-card"]', { timeout: 15000 });

 		// 1) Находим карточку нужной кампании по href
 		const campaignHandle = await page.$(
 		  	`a[data-test-selector="DropsCampaignInProgressDescription-no-channels-hint-text"]
 		  		+ a.tw-link[href*="/directory/category/${slug}"]`
 		);

 		if (!campaignHandle) {
 		  // кампания вообще не показана — значит дроп не получен на 100%
 		  await page.close();
 		  return true;
 		}

 		// 3) Ищем внутри этой карточки все прогресс-бары
 		const progressBars = await campaignHandle.$$(
 		  	'div.tw-progress-bar[role="progressbar"]'
 		);

 		for (const bar of progressBars) {
 		  	const now = await bar.evaluate(el => parseInt(el.getAttribute('aria-valuenow')!, 10));
 		  	const max = await bar.evaluate(el => parseInt(el.getAttribute('aria-valuemax')!, 10));
 		  	if (now < max) {
 		  	  // хоть один бар не довязан до max — дроп ещё можно получить
 		  	  await page.close();
 		  	  return true;
 		  	}
 		}

 		// все бары полные — дроп получен
 		await page.close();
 		return false;
	}

}