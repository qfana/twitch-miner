export interface IGamePriority {
  name: string;
  slug: string;
}

export interface IFarmStatus {
  gameName: string | null;
  streamerName: string | null;
  channelPoints: number;
}