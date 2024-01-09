<script lang="ts">
	import { createHover, createLongPress, createPress } from '$lib/index.js';

	const { pressAction } = createPress();
	const { hoverAction } = createHover();
	const { longPressAction } = createLongPress();
</script>

<button
	use:pressAction
	use:longPressAction
	use:hoverAction
	on:press={() => {
		console.log('press');
	}}
	on:pressend={() => {
		console.log('pressend');
	}}
	on:pressstart={() => {
		console.log('pressstart');
	}}
	on:pressup={() => {
		console.log('pressup');
	}}
	on:hoverstart={() => {
		console.log('hoverstart');
	}}
	on:hoverend={() => {
		console.log('hoverend');
	}}
	on:longpress={() => {
		console.log('longpress');
	}}
	on:longpressstart={() => {
		console.log('longpressstart');
	}}
	on:longpressend={() => {
		console.log('longpressend');
	}}
>
	Hello World
</button>
