import { ActivityService } from './activity/activity';
import { BrowserService } from './browser/browser'
import { TwitchService } from './twitch/twitch';
import { GamePriority } from './types';
import { WatcherService } from './watcher/watcher';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
	const prioritizedGames : GamePriority[] = [
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

	const browserService = new BrowserService();
	await browserService.init();

	
	const twitchService = new TwitchService(browserService);
	const activityService = new ActivityService(browserService);
	const watcherService = new WatcherService(twitchService, browserService, activityService, prioritizedGames, fallbackChannels);

	await watcherService.startWatching();
})();
