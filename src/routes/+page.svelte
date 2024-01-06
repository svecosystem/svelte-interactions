<script lang="ts">
	import { initPress } from '$lib/press.js';

	const { pressAction } = initPress();
</script>

<button
	use:pressAction
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
>
	Hello World
</button>
