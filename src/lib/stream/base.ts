export abstract class StreamDataBase {
	public abstract set(segment: number, data: Uint8Array, done: boolean): void;
	public abstract get(segment: number): Promise<Uint8Array>;
	public abstract isDone(): boolean;
	public abstract getFinal(): Promise<Uint8Array>;
	public abstract clear(): void;
}
