import { IBrowserService } from "../browser/browser.interface";
import { IActivityService } from "./activite.interface";

export class ActivityService implements IActivityService {
    private active: boolean = false;
    private browserService: IBrowserService;

    constructor (browserService: IBrowserService) {
        this.browserService = browserService;
    }

    private async mouseMove(): Promise<void> {
        const page = this.browserService.getPages()[0];
        try {
            const viewport = page.viewport()!;
            const x = Math.random() * viewport.width;
            const y = Math.random() * viewport.height;
            await page.mouse.move(x, y, { steps: 3 });
        } catch { /* игнорируем */ }
    }

    private async claimReward(): Promise<void> {
        const page = this.browserService.getPages()[0];
        const btnSelector = 'button[aria-label^="Получить бонус"], button[aria-label^="Claim Bonus"]';
        
        // на всякий случай ограничимся областью community-points-summary
        const summary = await page.$('div[data-test-selector="community-points-summary"]');
        if (!summary) {
          return;
        }

        const btn = await summary.$(btnSelector);
        if (!btn) {
          return;
        }

        try {
          await btn.click();
          console.log('[TwitchService] Community Points claimed!');
        } catch (err) {
          console.warn('[TwitchService] Не удалось кликнуть по кнопке claim:', err);
        }
    }

    public every15sec(): void {
        if (!this.active) return;

        this.mouseMove();
    }

    public every30sec(): void {
        if (!this.active) return;

        this.claimReward();
    }

    public start(): void{ 
        this.active = true;
    }

    public stop(): void {
        this.active = false;
    }

}