export interface IActivityService {
    start(): void;
    stop(): void;
    
    every15sec(): void;
    every30sec(): void;
}