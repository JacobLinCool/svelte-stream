import {
	FinalizedStreamingData,
	MemoryStreamData,
	StreamingHandleError,
	StreamingHandler,
	log
} from '$lib/index.js';
import { error, json, type RequestHandler } from '@sveltejs/kit';

log.enabled = true;

const handler = new StreamingHandler({
	// you can use FilesystemStreamData to save to disk or class implementing StreamDataBase
	dataConstructor: MemoryStreamData
});

export const GET: RequestHandler = async () => {
	return handler.start();
};

export const POST: RequestHandler = async (evt) => {
	try {
		const data = await handler.handle(evt.request);
		if (data instanceof FinalizedStreamingData) {
			console.log('final', data.id);
			return json({ message: `final ${data.id} (${data.all.byteLength} bytes)` });
		} else {
			console.log('partial', data.id, data.segment);
			return json({
				message: `partial ${data.id} ${data.segment} (${data.partial.byteLength} bytes)`
			});
		}
	} catch (e) {
		if (e instanceof StreamingHandleError) {
			return e.response();
		} else {
			error(500, 'unknown error');
		}
	}
};
