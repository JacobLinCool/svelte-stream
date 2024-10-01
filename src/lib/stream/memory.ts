import { log } from '../log.js';
import { StreamDataBase } from './base.js';

export class MemoryStreamData extends StreamDataBase {
	private partials = new Map<number, [Promise<Uint8Array>, () => void]>();
	private lastContinuity = -1;
	private finalSegment = -1;

	public set(segment: number, data: Uint8Array, done: boolean): void {
		log('Setting data for segment:', segment, 'done:', done);
		if (done) {
			this.finalSegment = segment;
			log('Final segment set:', this.finalSegment);
		}
		let resolve = () => {};
		const promise = new Promise<Uint8Array>((res) => {
			resolve = () => res(data);
		});
		this.partials.set(segment, [promise, resolve]);

		this.updateContinuity();
	}

	public get(segment: number): Promise<Uint8Array> {
		log('Getting data for segment:', segment);
		const partial = this.partials.get(segment);
		if (!partial) {
			throw new Error('Partial not found');
		}
		return partial[0];
	}

	public isDone(): boolean {
		const done = this.finalSegment !== -1;
		log('Checking if stream is done:', done);
		return done;
	}

	public async getFinal(): Promise<Uint8Array> {
		log('Getting final data');
		if (!this.isDone()) {
			throw new Error('Stream not finalized');
		}

		const promises = [];
		for (let i = 0; i <= this.finalSegment; i++) {
			const partial = this.partials.get(i);
			if (!partial) {
				throw new Error('Partial not found');
			}
			promises.push(partial[0]);
		}

		const data = await Promise.all(promises);
		const final = new Uint8Array(data.reduce((acc, d) => acc + d.length, 0));
		let offset = 0;
		for (const d of data) {
			final.set(d, offset);
			offset += d.length;
		}
		return final;
	}

	public clear(): void {
		// do nothing
	}

	private updateContinuity(): void {
		log('Updating continuity');
		let continuity = this.lastContinuity + 1;
		while (this.partials.has(continuity)) {
			const partial = this.partials.get(continuity);
			if (!partial) {
				throw new Error('Partial not found');
			}
			partial[1]?.();
			continuity++;
		}
		this.lastContinuity = continuity - 1;
	}
}
