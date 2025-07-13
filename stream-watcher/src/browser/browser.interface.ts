import { Browser, BrowserContext, Page } from "puppeteer";

export interface IBrowserService {
  	init(): Promise<void>;
  	destroy(): Promise<void>;
	
  	setCookie(): Promise<void>;

  	openUrl(url: string): Promise<Page | void>;
  	openStream(channelName: string): Promise<Page | void>;

   	getBrowser(): Browser;
   	getContext(): BrowserContext;
	getPages(): Page[];
}