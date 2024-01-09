<script lang="ts">
	import { createPress } from '$lib/press.js';

	const { pressAction } = createPress();
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
