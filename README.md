# Svelte Interactions

At surface level, interactions may seem like a simple concept, but once you start peeling back the onion they are quite complex. For something as simple as a button to behave properly across all browsers and devices, you need more than just a `click` event handler.

If you aren't convinced, it's highly recommended to read [this three-part blog post](https://react-spectrum.adobe.com/blog/building-a-button-part-1.html), which goes into detail about the complexities of interactions.

This project is heavily inspired by that article and contains a ton of code derived from [React Aria's](https://react-spectrum.adobe.com) Interactions packages. It aims to provide a similar API for Svelte, in the form of [Svelte Actions](https://svelte.dev/docs/svelte-action) and eventually spreadable event attributes (once Svelte 5 is released).

While this project is still in its infancy, it'll be documented here. It will eventually get a dedicated website, but for now this will have to do.

## Installation

```bash
npm install svelte-interactions
```

## Press Interaction

The `press` interaction is used to implement buttons, links, and other pressable elements. It handles mouse, touch, and keyboard interactions, and ensures that the element is accessible to screen readers and keyboard users.

No more having to wrangle all those event handlers yourself! Just and use the `press` action along with the different `PressEvents` to provide a consistent experience across all browsers and devices.

#### Basic Usage

```svelte
<script lang="ts">
	import { createPress } from 'svelte-interactions';

	const { pressAction } = createPress();
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

### createPress

Creates a new `press` interaction instance. Each element should have its own instance, as it maintains state for a single element. For example, if you had multiple buttons on a page:

```svelte
<script lang="ts">
	import { createPress } from 'svelte-interactions';

	const { pressAction: pressOne } = createPress();
	const { pressAction: pressTwo } = createPress();
</script>

<button use:pressOne on:press> Button One </button>
<button use:pressTwo on:press> Button Two </button>
```

#### PressConfig

`createPress` takes in an optional `PressConfig` object, which can be used to customize the interaction.

```ts
import { createPress } from 'svelte-interactions';

const { pressAction } = createPress({ isDisabled: true });
```

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

Be aware that event if you use these handlers, the custom `on:press*` events for whatever handlers you use will not be dispatched to the element. We only dispatch the events that aren't handled by the `PressHandlers`.

```ts
type PressHandlers = {
	/**
	 * Handler called when the press is released over the target.
	 */
	onPress?: (e: PressEvent) => void;

	/**
	 * Handler called when a press interaction starts.
	 */
	onPressStart?: (e: PressEvent) => void;

	/**
	 * Handler called when a press interaction ends, either over
	 * the target or when the pointer leaves the target.
	 */
	onPressEnd?: (e: PressEvent) => void;

	/**
	 * Handler called when the press state changes.
	 */
	onPressChange?: (isPressed: boolean) => void;

	/**
	 * Handler called when a press is released over the target,
	 * regardless of whether it started on the target or not.
	 */
	onPressUp?: (e: PressEvent) => void;
};
```

### PressResult

The `createPress` function returns a `PressResult` object, which contains the `pressAction` action, and the `isPressed` state. More returned properties may be added in the future if needed.

```ts
type PressResult = {
	/** Whether the target is currently pressed. */
	isPressed: Readable<boolean>;
	/** A Svelte Action which handles applying the event listeners to the element. */
	pressAction: (node: HTMLElement | SVGElement) => PressActionReturn;
};
```

### Custom Events

When you apply the `pressAction` to an element, it will dispatch custom `on:press*` events. You can use these or the `PressHandlers` to handle the various press events.

```ts
type PressActionReturn = ActionReturn<
	undefined,
	{
		/**
		 * Dispatched when the press is released over the target.
		 */
		'on:press'?: (e: CustomEvent<PressEvent>) => void;

		/**
		 * Dispatched when a press interaction starts.
		 */
		'on:pressstart'?: (e: CustomEvent<PressEvent>) => void;

		/**
		 * Dispatched when a press interaction ends, either over
		 * the target or when the pointer leaves the target.
		 */
		'on:pressend'?: (e: CustomEvent<PressEvent>) => void;

		/**
		 * Dispatched when a press is released over the target,
		 * regardless of whether it started on the target or not.
		 */
		'on:pressup'?: (e: CustomEvent<PressEvent>) => void;
	}
>;
```

#### PressEvent

This is the event object dispatched by the custom `on:press*` events, and is also passed to the `PressHandlers` should you choose to use them.

```ts
type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

interface PressEvent {
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

## Long Press Interaction

The `hover` interaction provides an API for consistent long press behavior across all browsers and devices, with support for a custom time threshold and accessible description.

#### Basic Usage

```svelte
<script lang="ts">
	import { createLongPress } from 'svelte-interactions';

	const { longPressAction } = createLongPress();
</script>

<button
	use:longPressAction
	on:longpress={(e) => {
		console.log('you just long pressed a button!', e);
	}}
>
	Long Press Me
</button>
```

### createLongPress

Creates a new `longpress` interaction instance. Each element should have its own instance, as it maintains state for a single element. For example, if you had multiple buttons on a page:

```svelte
<script lang="ts">
	import { createLongPress } from 'svelte-interactions';

	const { longPressAction: longPressOne } = createLongPress();
	const { longPressAction: longPressTwo } = createLongPress();
</script>

<button use:longPressOne on:longpress> Button One </button>
<button use:longPressTwo on:longpress> Button Two </button>
```

#### LongPressConfig

`createLongPress` takes in an optional `LongPressConfig` object, which can be used to customize the interaction.

```ts
import { createLongPress } from 'svelte-interactions';

const { pressLongAction } = createPress({ isDisabled: true, threshold: 1000 });
```

```ts
type LongPressConfig = LongPressHandlers & {
	/**
	 * Whether the long press events should be disabled
	 */
	isDisabled?: boolean;

	/**
	 * The amount of time (in milliseconds) to wait before
	 * triggering a long press event.
	 */
	threshold?: number;

	/**
	 * A description for assistive techology users indicating that a
	 * long press action is available, e.g. "Long press to open menu".
	 */
	accessibilityDescription?: string;
};
```

The `LongPressConfig` object also includes handlers for all the different `LongPressHandlers`. These are provided as a convenience, should you prefer to handle the events here rather than the custom `on:longpress*` events dispatched by the element with the `longPressAction`.

Be aware that event if you use these handlers, the custom `on:longpress*` events for whatever handlers you use will not be dispatched to the element. We only dispatch the events that aren't handled by the `LongPressHandlers`.

```ts
export type LongPressHandlers = {
	/**
	 * Handler that is called when a long press interaction starts.
	 */
	onLongPressStart?: (e: LongPressEvent) => void;

	/**
	 * Handler that is called when a long press interaction ends, either
	 * over the target or when the pointer leaves the target.
	 */
	onLongPressEnd?: (e: LongPressEvent) => void;

	/**
	 * Handler that is called when the threshold time is met while
	 * the press is over the target.
	 */
	onLongPress?: (e: LongPressEvent) => void;
};
```

### LongPressResult

The `createLongPress` function returns a `LongPressResult` object, which contains the `longPressAction` action, and the `description` state. More returned properties may be added in the future if needed.

```ts
type LongPressResult = {
	/**
	 * A Svelte action which handles applying the event listeners
	 * and dispatching events to the element
	 */
	longPressAction: (node: HTMLElement | SVGElement) => LongPressActionReturn;

	/**
	 * A writable store to manage the accessible description for the long
	 * press action. It's initially populated with the value passed to the
	 * `accessibilityDescription` config option, but can be updated at any
	 * time by calling `description.set()`, and the new description will
	 * reflect in the DOM.
	 */
	accessibilityDescription: Writable<string | undefined>;
};
```

### Custom Events

When you apply the `longPressAction` to an element, it will dispatch custom `on:longpress*` events for events you aren't handling via the `LongPressConfig` props. You can use these or the `LongPressHandlers` to handle the various `longpress` events.

```ts
type LongPressActionReturn = ActionReturn<
	undefined,
	{
		/**
		 * Dispatched when the threshold time is met while
		 * the press is over the target.
		 */
		'on:longpress'?: (e: CustomEvent<LongPressEvent>) => void;

		/**
		 * Dispatched when a long press interaction starts.
		 */
		'on:longpressstart'?: (e: CustomEvent<LongPressEvent>) => void;

		/**
		 * Dispatched when a long press interaction ends, either
		 * over the target or when the pointer leaves the target.
		 */
		'on:longpressend'?: (e: CustomEvent<LongPressEvent>) => void;
	}
>;
```

#### PressEvent

This is the event object dispatched by the custom `on:press*` events, and is also passed to the `PressHandlers` should you choose to use them.

```ts
type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

interface PressEvent {
	/** The type of longpress event being fired. */
	type: 'longpressstart' | 'longpressend' | 'longpress';

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
}
```

## Hover Interaction

The `hover` interaction provides an API for consistent hover behavior across all browsers and devices, ignoring emulated mouse events on touch devices.

#### Basic Usage

```svelte
<script lang="ts">
	import { createHover } from 'svelte-interactions';

	const { hoverAction } = createHover();
</script>

<button
	use:hoverAction
	on:hoverstart={(e) => {
		console.log('you just hovered me!', e);
	}}
	on:hoverstart={(e) => {
		console.log('you just unhovered me!', e);
	}}
>
	Press Me
</button>
```

### createHover

Creates a new `hover` interaction instance. Each element should have its own instance, as it maintains state for a single element. For example, if you had multiple elements you wanted to apply hover state to on a page:

```svelte
<script lang="ts">
	import { createPress } from 'svelte-interactions';

	const { hoverAction: hoverOne } = createHover();
	const { hoverAction: hoverTwo } = createHover();
</script>

<div use:hoverOne on:hoverstart>Hoverable element one</div>
<div use:hoverTwo on:hoverstart>Hoverable element two</div>
```

#### HoverConfig

The `createHover` function takes in an optional `HoverConfig` object, which can be used to customize the interaction.

```ts
import { createHover } from 'svelte-interactions';

const { hoverAction } = createHover({ isDisabled: true });
```

```ts
type HoverConfig = HoverHandlers & {
	/**
	 * Whether the hover events should be disabled
	 */
	isDisabled?: boolean;
};
```

The `HoverConfig` object also includes handlers for all the different `HoverHandlers`. These are provided as a convenience, should you prefer to handle the events here rather than the custom `on:hover*` events dispatched by the element with the `hoverAction`.

Be aware that event if you use these handlers, the custom `on:hover*` events for whatever handlers you use will not be dispatched to the element. We only dispatch the events that aren't handled by the `HoverHandlers`.

```ts
type HoverHandlers = {
	/**
	 * Handler called when a hover interaction starts.
	 */
	onHoverStart?: (e: HoverEvent) => void;

	/**
	 * Handler called when a hover interaction ends.
	 */
	onHoverEnd?: (e: HoverEvent) => void;

	/**
	 * Handler called when the hover state changes.
	 */
	onHoverChange?: (isHovering: boolean) => void;
};
```

### HoverResult

The `createHover` function returns a `HoverResult` object, which contains the `hoverAction` action, and the `isHovering` state. More returned properties may be added in the future if needed.

```ts
export type HoverResult = {
	/**
	 * Whether the element is currently being hovered
	 */
	isHovered: Readable<boolean>;

	/**
	 * A Svelte action which handles applying the event listeners
	 * to the element and dispatching the custom `on:hover*` events.
	 */
	hoverAction: (node: HTMLElement | SVGElement) => HoverActionReturn;
};
```

### Custom Events

When you apply the `hoverAction` to an element, it will dispatch custom `on:hover*` events. You can use these or the `HoverHandlers` to handle the various hover events.

```ts
type HoverActionReturn = ActionReturn<
	undefined,
	{
		/**
		 * Dispatched when a hover interaction starts.
		 */
		'on:hoverstart'?: (e: CustomEvent<HoverEvent>) => void;

		/**
		 * Dispatched when a hover interaction ends.
		 */
		'on:hoverend'?: (e: CustomEvent<HoverEvent>) => void;
	}
>;
```

#### HoverEvent

This is the event object dispatched by the custom `on:hover*` events, and is also passed to the `HoverHandlers` should you choose to use them.

```ts
interface HoverEvent {
	/** The type of hover event being fired. */
	type: 'hoverstart' | 'hoverend';
	/** The pointer type that triggered the hover event. */
	pointerType: 'mouse' | 'pen';
	/** The target element of the hover event. */
	target: Element;
}
```
