<script lang="ts">
	import { createHover } from '$lib/hover.js';
	import { createPress } from '$lib/press.js';

	const { pressAction } = createPress();
	const { hoverAction } = createHover();
</script>

<button
	use:pressAction
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
>
	Hello World
</button>
