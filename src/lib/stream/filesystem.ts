import fs from 'node:fs';
import path from 'node:path';
import { log } from '../log.js';
import { StreamDataBase } from './base.js';

export class FilesystemStreamData extends StreamDataBase {
	private partials = new Map<number, [Promise<Uint8Array>, () => void]>();
	private lastContinuity = -1;
	private finalSegment = -1;
	private base: string;

	constructor(id: string, base = '.svelte-stream') {
		super();
		this.base = path.join(base, id);
		if (!fs.existsSync(this.base)) {
			fs.mkdirSync(this.base, { recursive: true });
		}
	}

	public set(segment: number, data: Uint8Array, done: boolean): void {
		log('Setting data for segment:', segment, 'done:', done);
		const filePath = this.getFilePath(segment);
		fs.writeFileSync(filePath, data);

		let resolve = () => {};
		const promise = new Promise<Uint8Array>((res) => {
			resolve = () => res(fs.readFileSync(filePath));
		});
		this.partials.set(segment, [promise, resolve]);

		if (done) {
			this.finalSegment = segment;
			log('Final segment set:', this.finalSegment);
		}

		this.updateContinuity();
	}

	public async get(segment: number): Promise<Uint8Array> {
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
			promises.push(this.get(i));
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
		log('Clearing filesystem stream data');
		for (const [segment] of this.partials) {
			const filePath = this.getFilePath(segment);
			fs.unlinkSync(filePath);
		}
		this.partials.clear();
		this.lastContinuity = -1;
		this.finalSegment = -1;
	}

	private getFilePath(segment: number): string {
		return path.join(this.base, `segment-${segment}.bin`);
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
