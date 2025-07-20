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


const monthMap: Record<string,string> = {
  'янв.': '01','фев.': '02','мар.': '03','апр.': '04','май': '05','июн.': '06',
  'июл.': '07','авг.': '08','сен.': '09','окт.': '10','ноя.': '11','дек.': '12',
};

function hasCampaignStarted(dateRange: string): boolean {
  const now = new Date();

  // Разделяем начало и конец
  const [startRaw, endRaw] = dateRange.split(' - ').map(s => s.trim());

  // Парсим одну сторону
  function parsePart(raw: string): Date {
    // 1) Убираем день недели ("сб, ")
    let t = raw.replace(/^[^,]+,\s*/, '');

    // 2) Отделяем GMT-метку, если она есть
    let tz = 'GMT+3'; // по умолчанию
    const tzMatch = t.match(/GMT[+-]\d+/);
    if (tzMatch) {
      tz = tzMatch[0];
      t = t.replace(tz, '').trim();
    }

    // t теперь что‑то вроде "19 июл., 23:30"
    // 3) Разбиваем по пробелам
    const [day, monthRusWithDot, time] = t.split(/\s+/);
    const monthRus = monthRusWithDot.replace(',', '');
    const month = monthMap[monthRus];
    if (!month) {
      throw new Error(`Не могу распознать месяц: ${monthRus}`);
    }

    // 4) Формируем ISO‑строку вида "YYYY-MM-DDTHH:mm:00+03:00"
    const year = now.getFullYear();
    const [hh, mm] = time.split(':');
    // переводим "GMT+3" → "+03:00"
    const sign = tz[3];              // '+' или '-'
    const offsetHours = tz.slice(4); // '3' или '03'
    const hhOffset = offsetHours.padStart(2, '0');
    const iso = `${year}-${month}-${day.padStart(2,'0')}T${hh}:${mm}:00${sign}${hhOffset}:00`;

    return new Date(iso);
  }

  const startDate = parsePart(startRaw);
  const endDate   = parsePart(endRaw);

  return now >= startDate && now <= endDate;
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

	    console.log(`[DEBUG] В/Д: ${campaigns.length} / ${slugs.length} `);
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
	  	}
	  
	  	// 3) Ждём пока подгрузится список «В процессе»
		await page.waitForSelector(
		  	'div.inventory-page div.inventory-max-width',
		  	{ timeout: 15_000 }
		);

	  	// 4) Находим карточку, в которой внутри есть ссылка на нужный slug
		const games = await page.$$('div.Layout-sc-1xcs6mc-0.jtROCr');
		let campaignCard = null;
		for (const game of games) {
			const cards = await game.$$('p[data-test-selector="DropsCampaignInProgressDescription-hint-text-parent"]');
			if (!cards.length) continue;

			for (const card of cards) {
				  const link = await card.$(`a[href*="/directory/category/${slug}"]`);
  
				  if (link) {
					campaignCard = game;
					break;
				  }
			}
		}

		if (!campaignCard) {
			  const claimed = await this.dropFullClaimed(slug);
			  if (!claimed) {
				  await page.close();
				  return false;   // → «надо смотреть» (не получен на 100%)
			  } else {
				return true;
			  }
		}
		
	  	// 5) Собираем все прогресс-бары внутри найденной карточки
  		const hasUnfinished = await campaignCard.$('div.Layout-sc-1xcs6mc-0.Oagqd') !== null;
		if (!hasUnfinished) {
			await page.close();
			return true
		};
	  
	  	// 6) Если все бары на 100%
	  	await page.close();
	  	return false;  // → «не смотреть»
	}

	public async getFirstOnlineChannel(login: string): Promise<boolean> {
	    const url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-80x45.jpg`;

 	// ставим таймаут, чтобы fetch не висел бесконечно
 	const controller = new AbortController();
 	const timeout = setTimeout(() => controller.abort(), 5_000); // 5 сек

 	try {
 	  	const res = await fetch(url, {
 	  	  	method: 'HEAD',
 	  	  	signal: controller.signal,
 	  	  	redirect: 'follow', // на всякий случай
 	  	});

 	  	if (!res.ok) {
 	  	  	console.warn(`[isLiveByPreview] HTTP ${res.status} for ${login}`);
 	  	  	return false;
 	  	}

 	  	const lenHeader = res.headers.get('content-length');
 	  	const len = lenHeader ? parseInt(lenHeader, 10) : 0;
 	  	return len > 1000;
 	} catch (err: any) {
 	  	if (err.name === 'AbortError') {
 	  	  	console.warn(`[isLiveByPreview] timeout for ${login}`);
 	  	} else {
 	  	  	console.error(`[isLiveByPreview] error for ${login}:`, err);
 	  	}
 	  	return false;
 	} finally {
 	  	clearTimeout(timeout);
 	}
  	}

private async dropFullClaimed(slug: string): Promise<boolean> {
	  const ctx = this.browserService.getContext();

	  // === 1) Собираем награды из карточки кампании ===
	  const page = await ctx.newPage();
	  await page.goto('https://dashboard.twitch.tv/viewer-rewards/drops', {
	    waitUntil: 'networkidle0',
	    timeout: 60_000,
	  });
	  // закрываем баннер, если есть
	  const consent = await page.$('button[data-a-target="consent-banner-accept"]');
	  if (consent) {
	    await consent.click();
	    await new Promise(resolve => setTimeout(resolve, 2000));
	  }

	  // находим ссылку внутри нужной карточки и поднимаемся до header
	  const linkHandle = await page.$(
	    `.accordion-header a[href*="/directory/category/${slug}"]`
	  );
	  if (!linkHandle) {
	    await page.close();
	    return true; // нет карточки — считаем «всё забрано»
	  }
	  const headerHandle = (await linkHandle.evaluateHandle(el =>
	    el.closest('.accordion-header')
	  )) as ElementHandle<Element>;

	  // раскрываем, если нужно
	  const isCollapsed = await headerHandle.evaluate(
	    h => h.getAttribute('aria-expanded') === 'false'
	  );
	  if (isCollapsed) {
	    await headerHandle.click();
	    await new Promise(resolve => setTimeout(resolve, 50));
	}

	  // панель наград — следующий элемент после header
	  const panelHandle = (await headerHandle.evaluateHandle(h =>
	    h.nextElementSibling
	  )) as ElementHandle<Element>;

	  // собираем alt всех картинок — это названия наград кампании
	  const campaignRewards: string[] = await panelHandle.$$eval(
	    'img[alt]',
	    imgs => imgs.map(i => i.getAttribute('alt')!.trim())
	  );

	  await page.close();

	  // === 2) Собираем уже полученные награды из инвентаря ===
	  const inv = await ctx.newPage();
	  await inv.goto('https://www.twitch.tv/drops/inventory', {
	    waitUntil: 'networkidle0',
	    timeout: 60_000,
	  });
	  // закрываем consent
	  const c2 = await inv.$('button[data-a-target="consent-banner-accept"]');
	  if (c2) {
	    await c2.click();
	    await new Promise(resolve => setTimeout(resolve, 2000));
		}

	  // Ждём, пока инвентарь прогрузится
	  await inv.waitForSelector('div.inventory-max-width', { timeout: 15_000 });

	  // В инвентаре уже забранные дропы — alt тех же img
	  const claimedRewards: string[] = await inv.$$eval(
	    'div.inventory-max-width img[alt]',
	    imgs => imgs.map(i => i.getAttribute('alt')!.trim())
	  );

	  await inv.close();

	  // === 3) Сравниваем: все campaignRewards должны быть в claimedRewards ===
	  const allClaimed = campaignRewards.every(name =>
	    claimedRewards.includes(name)
	  );

	  return allClaimed;
	}


}