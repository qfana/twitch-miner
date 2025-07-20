import { ActivityService } from './activity/activity';
import { BrowserService } from './browser/browser'
import { TwitchService } from './twitch/twitch';
import { IGamePriority } from './types'
import { WatcherService } from './watcher/watcher';
import dotenv from 'dotenv';

dotenv.config();

class ControllerService {
	private drops: IGamePriority[];
	private streamers: string[];

	constructor(auth_token: string | undefined, drops: IGamePriority[], streamers: string[]) {
		this.drops = drops;
		this.streamers = streamers;

		this.init(auth_token);
	}

	private async init(auth_token: string | undefined) {
		if (!auth_token) return;
		const browserService = new BrowserService();
		await browserService.init(auth_token);

		
		const twitchService = new TwitchService(browserService);
		const activityService = new ActivityService(browserService);
		const watcherService = new WatcherService(twitchService, browserService, activityService, this.drops, this.streamers);

		await watcherService.startWatching();
	}
}

const prioritizedGames : IGamePriority[] = [
	{ name: 'Rust', slug: 'rust' },
	{ name: 'Diablo IV', slug: 'diablo-iv' },
	{ name: 'Escape From Tarkov', slug: 'escape-from-tarkov' },
	{ name: 'Marver Rivals', slug: 'marvel-rivals' }
];

const fallbackChannels = [
	'godrage77',
	'mishkagammi',
	'sinnexxy',
	'arssisbsd',
	'a13rt1k',
	'igoresh1xx',
]

const test = new ControllerService(process.env.TWITCH_AUTH_TOKEN, prioritizedGames, fallbackChannels);