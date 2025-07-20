export interface UserService {
    getOrCreate(userId: string): Promise<void>;
}