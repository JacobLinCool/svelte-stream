import { log } from './log.js';

export type StreamCallback = (res: Response, segment: number) => unknown;

export type BackoffConfig = {
	initialDelay: number;
	maxDelay: number;
	factor: number;
	maxAttempts: number;
};

export class StreamingClient {
	private readonly req: Request;
	private readonly backoffConfig: BackoffConfig;

	constructor(
		private readonly input: RequestInfo | URL,
		private readonly init?: RequestInit,
		backoffConfig?: Partial<BackoffConfig>
	) {
		this.req = new Request(input, init);
		// Set default backoff configuration
		this.backoffConfig = {
			initialDelay: 1000,
			maxDelay: 30000,
			factor: 2,
			maxAttempts: 20,
			...backoffConfig
		};
	}

	private async sendWithBackoff(
		segment: number,
		value: Uint8Array | undefined,
		id: string,
		done: boolean
	): Promise<Response> {
		let delay = this.backoffConfig.initialDelay;
		let attempts = 0;
		let userError = false;

		while (attempts < this.backoffConfig.maxAttempts) {
			try {
				const res = await fetch(this.req, {
					body: value,
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						'X-Svelte-Stream-Id': id,
						'X-Svelte-Stream-Segment': segment.toString(),
						'X-Svelte-Stream-Done': done.toString()
					}
				});

				if (res.ok) {
					return res;
				}

				userError = res.status >= 400 && res.status < 500;
				throw new Error(`Failed to send segment ${segment}: ${res.status} ${res.statusText}`);
			} catch (error) {
				log(`Error sending segment ${segment}, attempt ${attempts + 1}: ${error}`);
				if (userError) {
					throw error;
				}

				attempts++;
				if (attempts >= this.backoffConfig.maxAttempts) {
					throw error;
				}

				await new Promise((resolve) => setTimeout(resolve, delay));
				delay = Math.min(delay * this.backoffConfig.factor, this.backoffConfig.maxDelay);
			}
		}

		throw new Error(
			`Failed to send segment ${segment} after ${this.backoffConfig.maxAttempts} attempts`
		);
	}

	public async send(
		id: string,
		stream: ReadableStream<Uint8Array>,
		callback?: StreamCallback
	): Promise<Response> {
		log(`Starting to send stream with id: ${id}`);
		const reader = stream.getReader();
		let done = false;
		let segment = 0;
		let res: Response | null = null;

		while (!done) {
			const { value, done: done_ } = await reader.read();
			done = done_;

			log(`Sending segment ${segment}, done: ${done}`);
			res = await this.sendWithBackoff(segment, value, id, done);

			if (!done) {
				log(`Calling callback for segment ${segment}`);
				callback?.(res, segment);
			}
			segment++;
		}

		if (!res) {
			throw new Error('Failed to get final response');
		}
		return res;
	}

	public async getStarted(input = this.input, init = this.init): Promise<string> {
		log('Getting started with streaming');
		const res = await fetch(new Request(input, init));
		if (!res.ok) {
			throw new Error('Failed to start streaming');
		}

		const data = await res.json();
		const id = data.streamId;
		if (typeof id !== 'string') {
			throw new Error('Invalid stream ID');
		}
		log(`Stream started with id: ${id}`);
		return id;
	}
}

export { log };
