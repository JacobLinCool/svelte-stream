<script lang="ts">
	import { StreamingClient, log } from '$lib/client.js';
	import { onMount } from 'svelte';

	log.enabled = true;

	let client: StreamingClient;
	let stream: MediaStream;
	let mediaRecorder: MediaRecorder;
	let isRecording = false;
	let recordingTime = 0;
	let timerInterval: number;
	let logs: string[] = [];
	let logContainer: HTMLDivElement;

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
		isRecording = true;
		recordingTime = 0;
		logs = [];
		timerInterval = setInterval(() => {
			recordingTime++;
		}, 1000) as unknown as number;

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
		addLog(`Started recording with ID: ${id}`);
		const res = await client.send(id, readable, callback);
		const final = await res.json();
		addLog(`[Final]: ${final.message}`);
	}

	function stopRecording() {
		isRecording = false;
		clearInterval(timerInterval);
		mediaRecorder.stop();
		addLog('Recording stopped');
	}

	function addLog(message: string) {
		logs = [...logs, message];
		setTimeout(() => {
			if (logContainer) {
				logContainer.scrollTop = -100000;
			}
		}, 0);
	}

	async function callback(res: Response) {
		const data = await res.json();
		addLog(`[Callback]: ${data.message}`);
	}

	function formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
	}
</script>

<div class="container">
	<button class="record-button" class:recording={isRecording} on:click={toggleRecording}>
		{#if isRecording}
			<span class="stop-icon"></span>
		{:else}
			<span class="mic-icon">🎙️</span>
		{/if}
	</button>
	<div class="timer">{formatTime(recordingTime)}</div>
	<div class="log-container" bind:this={logContainer}>
		{#each logs as log}
			<div class="log-entry">{log}</div>
		{/each}
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		height: 100vh;
		padding-top: 50px;
	}

	.record-button {
		width: 80px;
		height: 80px;
		background-color: #f0f0f0;
		border: none;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.record-button:hover {
		background-color: #e0e0e0;
	}

	.record-button.recording {
		background-color: #ff4136;
		animation: pulse 1.5s infinite;
	}

	.mic-icon {
		font-size: 32px;
	}

	.stop-icon {
		width: 20px;
		height: 20px;
		background-color: white;
	}

	.timer {
		margin-top: 20px;
		font-size: 24px;
		font-weight: bold;
	}

	.log-container {
		margin-top: 20px;
		width: 80%;
		max-width: 640px;
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid #ccc;
		border-radius: 5px;
		padding: 10px;
		display: flex;
		flex-direction: column-reverse;
		scroll-behavior: smooth;
	}

	.log-entry {
		font-family: monospace;
		font-size: 14px;
		margin-bottom: 5px;
		white-space: pre-wrap;
		word-break: break-all;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
