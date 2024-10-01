import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { log } from './log.js';
import { MemoryStreamData, StreamDataBase, StreamHolder } from './stream/index.js';

export class StreamingHandleError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
		this.name = 'StreamingHandleError';
	}

	public response(): Response {
		return new Response(this.message, { status: this.status });
	}
}

export class PartialStreamingData {
	constructor(
		public id: string,
		public segment: number,
		public partial: Uint8Array,
		public done: boolean
	) {}
}

export class FinalizedStreamingData extends PartialStreamingData {
	constructor(
		id: string,
		segment: number,
		partial: Uint8Array,
		done: boolean,
		public all: Uint8Array
	) {
		super(id, segment, partial, done);
	}
}

export interface StreamingHandlerOptions {
	timeout: number;
	dataConstructor: new (id: string) => StreamDataBase;
}

export class StreamingHandler {
	private holder: StreamHolder;

	constructor(options: Partial<StreamingHandlerOptions> = {}) {
		this.holder = new StreamHolder(
			options.dataConstructor || MemoryStreamData,
			options.timeout || 1000 * 60 * 10
		);
		log('StreamingHandler initialized with timeout:', options.timeout);
	}

	public start(id = randomUUID()): Response {
		log('Starting new stream with id:', id);
		if (!this.holder.add(id)) {
			log('Stream already exists:', id);
			throw new StreamingHandleError('Stream already exists', 409);
		}
		return json({ streamId: id });
	}

	public async handle(request: Request): Promise<PartialStreamingData | FinalizedStreamingData> {
		log('Handling incoming request');
		if (!this.isStreamingRequest(request)) {
			log('Invalid request: Missing stream headers');
			throw new StreamingHandleError('Missing stream headers', 400);
		}

		const id = request.headers.get('X-Svelte-Stream-Id');
		const segment = parseInt(request.headers.get('X-Svelte-Stream-Segment') || '0', 10);
		const done = request.headers.get('X-Svelte-Stream-Done') === 'true';

		log('Request details:', { id, segment, done });

		if (!id) {
			log('Invalid request: Missing stream id');
			throw new StreamingHandleError('Invalid stream id', 400);
		}

		const stream = this.holder.get(id);
		if (!stream) {
			log('Stream not found:', id);
			throw new StreamingHandleError('Stream not found', 404);
		}

		this.holder.resetTimeout(id);

		const body = await request.arrayBuffer();
		const content = new Uint8Array(body);
		log('Received content length:', content.length);

		stream.set(segment, content, done);

		if (done) {
			log('Stream completed:', id);
			const all = await stream.getFinal();
			this.holder.delete(id);
			return new FinalizedStreamingData(id, segment, content, done, all);
		}

		log('Partial data received for stream:', id, 'segment:', segment);
		const promise = stream.get(segment);
		return new PartialStreamingData(id, segment, await promise, done);
	}

	public isStreamingRequest(request: Request): boolean {
		return (
			request.headers.has('X-Svelte-Stream-Id') &&
			request.headers.has('X-Svelte-Stream-Segment') &&
			request.headers.has('X-Svelte-Stream-Done')
		);
	}
}
