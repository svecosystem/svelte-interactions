import type { ActionReturn } from 'svelte/action';
import type { LongPressEvent as ILongPressEvent, LongPressHandlers } from './events.js';
import type { PointerType } from '$lib/types/index.js';
import { createPress, type PressEvent } from '$lib/interactions/press/index.js';
import { createGlobalListeners } from '$lib/utils/globalListeners.js';
import { effect } from '$lib/utils/effect.js';
import { createDescription } from '$lib/utils/description.js';
import { writable, type Writable } from 'svelte/store';

export type LongPressConfig = LongPressHandlers & {
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

class LongPressEvent implements ILongPressEvent {
	type: ILongPressEvent['type'];
	pointerType: PointerType;
	target: Element;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	#shouldStopPropagation = true;

	constructor(
		type: ILongPressEvent['type'],
		pointerType: PointerType,
		pressEvent: Omit<PressEvent, 'type'> & { type: ILongPressEvent['type'] }
	) {
		this.type = type;
		this.pointerType = pointerType;
		this.target = pressEvent.target;
		this.shiftKey = pressEvent.shiftKey;
		this.metaKey = pressEvent.metaKey;
		this.ctrlKey = pressEvent.ctrlKey;
		this.altKey = pressEvent.altKey;
	}

	get shouldStopPropagation() {
		return this.#shouldStopPropagation;
	}
}

type LongPressActionReturn = ActionReturn<
	undefined,
	{
		'on:longpress'?: (e: CustomEvent<LongPressEvent>) => void;
		'on:longpressstart'?: (e: CustomEvent<LongPressEvent>) => void;
		'on:longpressend'?: (e: CustomEvent<LongPressEvent>) => void;
	}
>;

export type LongPressResult = {
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

const DEFAULT_THRESHOLD = 500;

/**
 * Handles long press interactions across mouse and touch devices.
 * Supports a customizable time threshold,accessibility description,
 * and normalizes behavior across browsers and devices.
 */
export function createLongPress(config?: LongPressConfig): LongPressResult {
	const defaults = {
		isDisabled: false,
		threshold: DEFAULT_THRESHOLD
	};
	const {
		onLongPress,
		onLongPressEnd,
		onLongPressStart,
		isDisabled,
		threshold,
		accessibilityDescription: accessibilityDescriptionProp
	} = {
		...defaults,
		...config
	};

	let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
	let nodeEl: HTMLElement | SVGElement | null = null;

	const { addGlobalListener, removeGlobalListener } = createGlobalListeners();
	const accessibilityDescription = writable(accessibilityDescriptionProp);

	function dispatchLongPressEvent(longPressEvent: LongPressEvent) {
		nodeEl?.dispatchEvent(
			new CustomEvent<LongPressEvent>(longPressEvent.type, { detail: longPressEvent })
		);
	}

	const { pressAction } = createPress({
		isDisabled,
		onPressStart(e) {
			e.continuePropagation();
			if (e.pointerType !== 'mouse' && e.pointerType !== 'touch') return;

			const startEvent = { ...e, type: 'longpressstart' as const };
			const event = new LongPressEvent('longpressstart', e.pointerType, startEvent);
			onLongPressStart?.(startEvent);
			dispatchLongPressEvent(event);

			timeout = setTimeout(() => {
				// prevent other `press` handlers from handling this event
				e.target.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
				const pressEvent = { ...e, type: 'longpress' as const };
				const event = new LongPressEvent('longpress', e.pointerType, pressEvent);
				onLongPress?.(pressEvent);
				dispatchLongPressEvent(event);
				timeout = undefined;
			}, threshold);

			// prevent context menu, which may open on long press on touch devices
			if (e.pointerType !== 'touch') return;
			const onContextMenu = (e: Event) => {
				e.preventDefault();
			};

			addGlobalListener(e.target, 'contextmenu', onContextMenu, { once: true });
			addGlobalListener(
				window,
				'pointerup',
				() => {
					// If no contextmenu event is fired quickly after pointerup,
					// remove the handler so future context menu events outside
					// a long press are not prevented.
					setTimeout(() => {
						removeGlobalListener(e.target, 'contextmenu', onContextMenu);
					}, 30);
				},
				{ once: true }
			);
		},
		onPressEnd(e) {
			if (timeout) {
				clearTimeout(timeout);
			}

			if (e.pointerType !== 'mouse' && e.pointerType !== 'touch') return;

			const endEvent = { ...e, type: 'longpressend' as const };
			const event = new LongPressEvent('longpressend', e.pointerType, endEvent);
			onLongPressEnd?.(endEvent);
			dispatchLongPressEvent(event);
		}
	});

	const ariaDescribedBy = createDescription(accessibilityDescription);

	function longPressAction(node: HTMLElement | SVGElement): LongPressActionReturn {
		nodeEl = node;

		const unsub = effect([ariaDescribedBy], ([$ariaDescribedBy]) => {
			if (!$ariaDescribedBy) return;
			node.setAttribute('aria-describedby', $ariaDescribedBy);
		});

		const { destroy } = pressAction(node);

		return {
			destroy() {
				unsub();
				destroy?.();
			}
		};
	}

	return {
		longPressAction,
		accessibilityDescription
	};
}
