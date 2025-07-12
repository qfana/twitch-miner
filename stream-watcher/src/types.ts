export interface StreamChannel {
  channelName: string;
  gameName: string;
  isDropsEnabled: boolean;
  viewers: number;
}

export interface GamePriority {
  name: string;
  slug: string;
}
