import puppeteer, { Browser, BrowserContext, Page } from "puppeteer";
import { IBrowserService } from "./browser.interface";
import dotenv from 'dotenv';
dotenv.config();

export class BrowserService implements IBrowserService {
    private browser!: Browser;
    private context!: BrowserContext;
    private pages: Page[] = [];
    private readonly AUTH_TOKEN = process.env.TWITCH_AUTH_TOKEN!;
    private readonly CHROME_PATH = process.env.TWITCH_CHROME_EXECUTABLE || '/usr/bin/google-chrome';


    /**
     * Инициализация браузера и установка куки (токен авторизации)
     * @returns {Promise<void>}
     */
    public async init(): Promise<void>  {
        this.browser = await puppeteer.launch({
            headless: true,
            executablePath: this.CHROME_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.createBrowserContext();

        await this.setCookie();
    }

    public async setCookie(): Promise<void> {
        const page = await this.context?.newPage();
        console.log('[DEBUG] Using AUTH_TOKEN:', this.AUTH_TOKEN);
        await page?.setCookie({
            name: 'auth-token',
            value: this.AUTH_TOKEN,
            domain: '.twitch.tv',
            path: '/',
            httpOnly: false,
            secure: true,
        },
        {
	        name: 'twilight-user',
	        value: '{%22authToken%22:%22691t7kz7s80krwxgsqersuid12n1y2%22%2C%22displayName%22:%22qfanat%22%2C%22id%22:%22511981511%22%2C%22login%22:%22qfanat%22%2C%22roles%22:{%22isStaff%22:false}%2C%22version%22:2}',
	        domain: '.twitch.tv',
	        path: '/',
	        httpOnly: false,
	        secure: true
	    });

        // Ждём, пока появится кнопка "Accept" и кликаем по ней
        try {
        	await page.waitForSelector('button:has-text("Accept")', { timeout: 5000 });
        	await page.click('button:has-text("Accept")');
        	console.log('[DEBUG] Нажали "Accept" на куки-баннере');
        } catch (err) {
        	console.log('[DEBUG] Куки-баннер не появился');
        }

        await page?.close();
    }

    async openUrl(url: string): Promise<Page | void> {
        const page = await this.context?.newPage();
        if (!page) return console.warn('[BrowserService | openUrl] Page not found');

        await page.goto(url);

        this.pages?.push(page)
        return page;
    }

    async openStream(channelName: string): Promise<Page | void> {
        const url = `https://www.twitch.tv/${channelName}`;
        const page = await this.context?.newPage();
        if (!page) return console.warn('[BrowserService | openStream] Page not found');

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        this.pages.push(page);
        console.log(`🟣 Stream opened: ${channelName}`);

        return page;
    }

    async destroy() {
        for (const page of this.pages) {
            try {
                await page.close();
            } catch {}
        }
        this.pages = [];
    }

    getContext(): BrowserContext {
        return this.context;
    }

    getBrowser(): Browser {
        return this.browser;
    }
}