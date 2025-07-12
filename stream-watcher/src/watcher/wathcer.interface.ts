export interface IWatcherService {
    startWatching(): Promise<void>;
    stopWatching(): Promise<void>;
}