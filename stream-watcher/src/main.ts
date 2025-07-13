import { ActivityService } from './activity/activity';
import { BrowserService } from './browser/browser'
import { TwitchService } from './twitch/twitch';
import { GamePriority } from './types';
import { WatcherService } from './watcher/watcher';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
	const prioritizedGames : GamePriority[] = [
		{ name: 'PUBG: Battlegrounds', slug: 'pubg-battlegrounds' },
		{ name: 'Rust', slug: 'rust' },
		{ name: 'Albion Online', slug: 'albion-online' },
		{ name: 'Escape From Tarkov', slug: 'escape-from-tarkov' }
	];

    const fallbackChannels = [
        'sist1m',
        'tpnakyxny'
    ]

	const browserService = new BrowserService();
	await browserService.init();

	
	const twitchService = new TwitchService(browserService);
	const activityService = new ActivityService(browserService);
	const watcherService = new WatcherService(twitchService, browserService, activityService, prioritizedGames, fallbackChannels);

	await watcherService.startWatching();
})();
