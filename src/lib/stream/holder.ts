import { log } from '../log.js';
import type { StreamDataBase } from './base.js';

export class StreamHolder<T extends StreamDataBase = StreamDataBase> {
	private streams: Map<string, T>;
	private timeouts: Map<string, number>;
	private timeoutDuration: number;
	private dataConstructor: new (id: string) => T;

	constructor(dataConstructor: new (id: string) => T, timeoutDuration: number) {
		this.streams = new Map();
		this.timeouts = new Map();
		this.timeoutDuration = timeoutDuration;
		this.dataConstructor = dataConstructor;
		log(`StreamHolder<${dataConstructor.name}> created with timeout duration:`, timeoutDuration);
	}

	public add(id: string): boolean {
		log('Adding new stream:', id);
		if (this.streams.has(id)) {
			return false;
		}
		this.streams.set(id, new this.dataConstructor(id));
		this.setTimeout(id);
		return true;
	}

	public get(id: string): StreamDataBase | undefined {
		log('Getting stream:', id);
		return this.streams.get(id);
	}

	public delete(id: string): void {
		log('Deleting stream:', id);
		this.streams.get(id)?.clear();
		this.streams.delete(id);
		this.clearTimeout(id);
	}

	public resetTimeout(id: string): void {
		log('Resetting timeout for stream:', id);
		this.clearTimeout(id);
		this.setTimeout(id);
	}

	private setTimeout(id: string): void {
		log('Setting timeout for stream:', id);
		const timeout = setTimeout(() => {
			this.delete(id);
		}, this.timeoutDuration) as unknown as number;
		this.timeouts.set(id, timeout);
	}

	private clearTimeout(id: string): void {
		log('Clearing timeout for stream:', id);
		const timeout = this.timeouts.get(id);
		if (timeout) {
			clearTimeout(timeout);
			this.timeouts.delete(id);
		}
	}
}
