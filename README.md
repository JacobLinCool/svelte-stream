# Svelte Stream

Streaming audio, video, and other data from the browser to the server without WebSockets or WebRTC.

## Features

- Real-time streaming of data (audio, video, etc.) from browser to server
- Support for chunked data transfer
- Easy-to-use client-side API
- Flexible server-side handling
- Support HTTP/1, no WebSockets or WebRTC required

## Installation

```sh
npm install svelte-stream
```

## Usage

### Client Side

```html
<script lang="ts">
  import { StreamingClient } from 'svelte-stream/client';
  import { onMount } from 'svelte';

  let client: StreamingClient;
  let stream: MediaStream;
  let mediaRecorder: MediaRecorder;
  let isRecording = false;

  onMount(async () => {
    client = new StreamingClient('/api');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
  });

  async function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    const readable = new ReadableStream({
      start(controller) {
        mediaRecorder.ondataavailable = (event) => {
          controller.enqueue(event.data);
        };
        mediaRecorder.onstop = () => {
          controller.close();
        };
        mediaRecorder.start(1000);
      }
    });

    const id = await client.getStarted();
    const res = await client.send(id, readable, callback);
    const final = await res.json();
    console.log(final);
  }

  function stopRecording() {
    isRecording = false;
    mediaRecorder.stop();
  }

  async function callback(res: Response) {
    const data = await res.json();
    console.log(data);
  }
</script>
```

### Server Side

```ts
import { StreamingHandler, StreamingHandleError, FinalizedStreamingData } from 'svelte-stream';
import { error, json, type RequestHandler } from '@sveltejs/kit';

const handler = new StreamingHandler();

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
```
