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
        const existing = await page.cookies();
        if (existing.length) await page.deleteCookie(...existing);

        await page?.setCookie({
            name: 'auth-token',
            value: this.AUTH_TOKEN,
            domain: '.twitch.tv',
            path: '/',
            httpOnly: false,
            secure: true,
        });

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

        await this.acceptContentGate(page);

        return page;
    }

    private async acceptContentGate(page: Page) {
        // Селектор кнопки «Начать просмотр» в российской локали...
        const selector = 'button[data-test-selector="content-classification-gate-overlay-start-watching-button"]';
        try {
            // Ждём до 5 секунд, вдруг поплыло чуть подольше
            const btn = await page.waitForSelector(selector, { timeout: 5_000 });
            if (btn) {
              console.log('[BrowserService] Content gate detected, clicking accept…');
              await btn.click();
              // немного подождём, чтобы заставка скрылась
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch {
          // кнопки не было за 5сек → её нет, продолжаем
        }
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

    getPages(): Page[] {
        return this.pages;
    }
}