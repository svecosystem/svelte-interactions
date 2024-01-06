# Svelte Interactions

At surface level, interactions may seem like a simple concept, but once you start peeling back the onion they are quite complex. For something as simple as a button to behave properly across all browsers and devices, you need more than just a `click` event handler.

If you aren't convinced, it's highly recommended to read [this three-part blog post](https://react-spectrum.adobe.com/blog/building-a-button-part-1.html), which goes into detail about the complexities of interactions.

This project is heavily inspired by that article and contains code derived from [React Aria's](https://react-spectrum.adobe.com) Interactions packages. It aims to provide a similar API for Svelte, in the form of [Svelte Actions](https://svelte.dev/docs/svelte-action) and eventually spreadable event attributes (once Svelte 5 is released).

## Press Interaction

The `press` interaction is used to implement buttons, links, and other pressable elements. It handles mouse, touch, and keyboard interactions, and ensures that the element is accessible to screen readers and keyboard users.

No more having to wrangle all those event handlers yourself! Just and use the `press` action along with the different `PressEvents` to provide a consistent experience across all browsers and devices.

#### Basic Usage

```svelte
<script lang="ts">
	import { initPress } from 'svelte-interactions';

	const { pressAction } = initPress();
</script>

<button
	use:pressAction
	on:press={(e) => {
		console.log('you just pressed a button!', e);
	}}
>
	Press Me
</button>
```

### initPress

Creates a new `press` interaction instance. Each element should have its own instance, as it maintains state for a single element. For example, if you had multiple buttons on a page:

```svelte
<script lang="ts">
	import { initPress } from 'svelte-interactions';

	const { pressAction: pressOne } = initPress();
	const { pressAction: pressTwo } = initPress();
</script>

<button use:pressOne on:press> Button One </button>
<button use:pressTwo on:press> Button Two </button>
```

#### PressConfig

`initPress` takes in an optional `PressConfig` object, which can be used to customize the interaction.

```ts
type PressConfig = PressHandlers {
	/**
	 * Whether the target is in a controlled press state
	 * (e.g. an overlay it triggers is open).
	 *
	 * @default false
	 */
	isPressed?: boolean;

	/**
	 * Whether the press events should be disabled.
	 *
	 * @default false
	 */
	isDisabled?: boolean;

	/**
	 * Whether the target should not receive focus on press.
	 *
	 * @default false
	 */
	preventFocusOnPress?: boolean;

	/**
	 * Whether press events should be canceled when the pointer
	 * leaves the target while pressed. By default, this is
	 * `false`, which means if the pointer returns back over
	 * the target while pressed, `pressstart`/`onPressStart`
	 * will be fired again. If set to `true`, the press is
	 * canceled when the pointer leaves the target and
	 * `pressstart`/`onPressStart` will not be fired if the
	 * pointer returns.
	 *
	 * @default false
	 */
	shouldCancelOnPointerExit?: boolean;

	/**
	 * Whether text selection should be enabled on the pressable element.
	 */
	allowTextSelectionOnPress?: boolean;
};
```

The `PressConfig` object also includes handlers for all the different `PressHandlers`. These are provided as a convenience, should you prefer to handle the events here rather than the custom `on:press*` events dispatched by the element with the `pressAction`.

Be aware that if you use these handlers, the custom `on:press*` events will still be dispatched, so be sure you aren't handling the same event twice.

```ts
type PressHandlers = {
	/**
	 * Handler that is called when the press is released
	 * over the target.
	 */
	onPress?: (e: PressEvent) => void;

	/**
	 * Handler that is called when a press interaction starts.
	 */
	onPressStart?: (e: PressEvent) => void;

	/**
	 * Handler that is called when a press interaction ends,
	 * either over the target or when the pointer leaves the target.
	 */
	onPressEnd?: (e: PressEvent) => void;

	/**
	 * Handler that is called when the press state changes.
	 */
	onPressChange?: (isPressed: boolean) => void;

	/**
	 * Handler that is called when a press is released over the
	 * target, regardless of whether it started on the target or
	 * not.
	 */
	onPressUp?: (e: PressEvent) => void;
};
```

### Custom Events

When you apply the `pressAction` to an element, it will dispatch custom `on:press*` events. You can use either these or the `PressEvents` handlers provided by `initPress` to handle the different press events.

```ts
type CustomEvents = {
	/**
	 * Event dispatched when the press is released over the target.
	 */
	'on:press'?: (e: CustomEvent<PressEvent>) => void;

	/**
	 * Event dispatched when a press interaction starts.
	 */
	'on:pressstart'?: (e: CustomEvent<PressEvent>) => void;

	/**
	 * Event dispatched when a press interaction ends,
	 * either over the target or when the pointer leaves the target.
	 */
	'on:pressend'?: (e: CustomEvent<PressEvent>) => void;

	/**
	 * Event dispatched when a press is released over the target,
	 * regardless of whether it started on the target or not.
	 */
	'on:pressup'?: (e: CustomEvent<PressEvent>) => void;
};
```

#### PressEvent

```ts
type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

export interface PressEvent {
	/** The type of press event being fired. */
	type: 'pressstart' | 'pressend' | 'pressup' | 'press';

	/** The pointer type that triggered the press event. */
	pointerType: PointerType;

	/** The target element of the press event. */
	target: Element;

	/** Whether the shift keyboard modifier was held during the press event. */
	shiftKey: boolean;

	/** Whether the ctrl keyboard modifier was held during the press event. */
	ctrlKey: boolean;

	/** Whether the meta keyboard modifier was held during the press event. */
	metaKey: boolean;

	/** Whether the alt keyboard modifier was held during the press event. */
	altKey: boolean;

	/**
	 * By default, press events stop propagation to parent elements.
	 * In cases where a handler decides not to handle a specific event,
	 * it can call `continuePropagation()` to allow a parent to handle it.
	 */
	continuePropagation(): void;
}
```
