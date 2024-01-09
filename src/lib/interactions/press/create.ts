// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.
import { get, writable, type Readable, readonly } from 'svelte/store';
import type { ActionReturn } from 'svelte/action';

// prettier-ignore
import { disableTextSelection, restoreTextSelection, focusWithoutScrolling, getOwnerDocument, getOwnerWindow, isMac, isVirtualClick, isVirtualPointerEvent, openLink, createGlobalListeners, toWritableStores, executeCallbacks, noop, addEventListener, isHTMLorSVGElement } from '$lib/utils/index.js';

import type { PressEvent as IPressEvent, PressHandlers } from './events.js';
import type { FocusableElement, EventBase, PointerType } from '$lib/types/index.js';

export type PressConfig = PressHandlers & {
	/** Whether the target is in a controlled press state (e.g. an overlay it triggers is open). */
	isPressed?: boolean;
	/** Whether the press events should be disabled. */
	isDisabled?: boolean;
	/** Whether the target should not receive focus on press. */
	preventFocusOnPress?: boolean;
	/**
	 * Whether press events should be canceled when the pointer leaves the target while pressed.
	 * By default, this is `false`, which means if the pointer returns back over the target while
	 * still pressed, onPressStart will be fired again. If set to `true`, the press is canceled
	 * when the pointer leaves the target and onPressStart will not be fired if the pointer returns.
	 */
	shouldCancelOnPointerExit?: boolean;
	/** Whether text selection should be enabled on the pressable element. */
	allowTextSelectionOnPress?: boolean;
};

type PressState = {
	isPressed: boolean;
	ignoreEmulatedMouseEvents: boolean;
	ignoreClickAfterPress: boolean;
	didFirePressStart: boolean;
	isTriggeringEvent: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	activePointerId: any;
	target: FocusableElement | null;
	isOverTarget: boolean;
	pointerType: PointerType | null;
	userSelect?: string;
	metaKeyEvents?: Map<string, KeyboardEvent>;
};

type PressActionReturn = ActionReturn<
	undefined,
	{
		'on:press'?: (e: CustomEvent<PressEvent>) => void;
		'on:pressstart'?: (e: CustomEvent<PressEvent>) => void;
		'on:pressend'?: (e: CustomEvent<PressEvent>) => void;
		'on:pressup'?: (e: CustomEvent<PressEvent>) => void;
	}
>;

export type PressResult = {
	/** Whether the target is currently pressed. */
	isPressed: Readable<boolean>;
	/** A Svelte Action which handles applying the event listeners to the element. */
	pressAction: (node: HTMLElement | SVGElement) => PressActionReturn;
};

class PressEvent implements IPressEvent {
	type: IPressEvent['type'];
	pointerType: PointerType;
	target: Element;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	#shouldStopPropagation = true;

	constructor(type: IPressEvent['type'], pointerType: PointerType, originalEvent: EventBase) {
		this.type = type;
		this.pointerType = pointerType;
		this.target = originalEvent.currentTarget as Element;
		this.shiftKey = originalEvent.shiftKey;
		this.metaKey = originalEvent.metaKey;
		this.ctrlKey = originalEvent.ctrlKey;
		this.altKey = originalEvent.altKey;
	}

	continuePropagation() {
		this.#shouldStopPropagation = false;
	}

	get shouldStopPropagation() {
		return this.#shouldStopPropagation;
	}
}

const LINK_CLICKED = Symbol('linkClicked');

/**
 * Handles press interactions across mouse, touch, keyboard, and screen readers.
 * It normalizes behavior across browsers and platforms, and handles many nuances
 * of dealing with pointer and keyboard events.
 */
export function createPress(config?: PressConfig): PressResult {
	const defaults = {
		isPressed: false,
		isDisabled: false,
		preventFocusOnPress: false,
		shouldCancelOnPointerExit: false,
		allowTextSelectionOnPress: false
	};
	const {
		onPress,
		onPressChange,
		onPressStart,
		onPressEnd,
		onPressUp,
		isPressed: isPressedProp,
		...rest
	} = { ...defaults, ...config };

	const opts = toWritableStores({ ...rest, isPressedProp });

	const isPressed = writable(false);

	const state = writable<PressState>({
		isPressed: false,
		ignoreEmulatedMouseEvents: false,
		ignoreClickAfterPress: false,
		didFirePressStart: false,
		isTriggeringEvent: false,
		activePointerId: null,
		target: null,
		isOverTarget: false,
		pointerType: null
	});

	const { addGlobalListener, removeAllGlobalListeners } = createGlobalListeners();

	// the element the action is attached to
	let nodeEl: HTMLElement | SVGElement | null = null;

	function dispatchPressEvent(pressEvent: PressEvent) {
		nodeEl?.dispatchEvent(new CustomEvent<PressEvent>(pressEvent.type, { detail: pressEvent }));
	}

	function triggerPressStart(originalEvent: EventBase, pointerType: PointerType) {
		const $state = get(state);
		const $isDisabled = get(opts.isDisabled);

		if ($isDisabled || $state.didFirePressStart) {
			return false;
		}
		let shouldStopPropagation = true;
		state.update((curr) => ({ ...curr, isTriggeringEvent: true }));

		const event = new PressEvent('pressstart', pointerType, originalEvent);
		onPressStart?.(event);
		dispatchPressEvent(event);
		shouldStopPropagation = event.shouldStopPropagation;

		onPressChange?.(true);

		state.update((curr) => ({
			...curr,
			isTriggeringEvent: false,
			didFirePressStart: true
		}));
		isPressed.set(true);
		return shouldStopPropagation;
	}

	function triggerPressEnd(originalEvent: EventBase, pointerType: PointerType, wasPressed = true) {
		const $state = get(state);
		if (!$state.didFirePressStart) {
			return false;
		}

		state.update((curr) => ({
			...curr,
			ignoreClickAfterPress: true,
			didFirePressStart: false,
			isTriggeringEvent: true
		}));

		let shouldStopPropagation = true;

		const event = new PressEvent('pressend', pointerType, originalEvent);
		onPressEnd?.(event);
		dispatchPressEvent(event);
		shouldStopPropagation = event.shouldStopPropagation;

		onPressChange?.(false);

		isPressed.set(false);
		const $isDisabled = get(opts.isDisabled);
		if (wasPressed && !$isDisabled) {
			const event = new PressEvent('press', pointerType, originalEvent);
			onPress?.(event);
			dispatchPressEvent(event);
			shouldStopPropagation &&= event.shouldStopPropagation;
		}

		state.update((curr) => ({
			...curr,
			isTriggeringEvent: false
		}));

		return shouldStopPropagation;
	}

	function triggerPressUp(originalEvent: EventBase, pointerType: PointerType) {
		if (get(opts.isDisabled)) {
			return false;
		}

		state.update((curr) => ({ ...curr, isTriggeringEvent: true }));
		const event = new PressEvent('pressup', pointerType, originalEvent);
		onPressUp?.(event);
		dispatchPressEvent(event);
		state.update((curr) => ({ ...curr, isTriggeringEvent: false }));
		return event.shouldStopPropagation;
	}

	function cancel(e: EventBase) {
		const $state = get(state);
		if ($state.isPressed && $state.target) {
			if ($state.isOverTarget && $state.pointerType != null) {
				triggerPressEnd(createEvent($state.target, e), $state.pointerType, false);
			}
			state.update((curr) => ({
				...curr,
				isPressed: false,
				isOverTarget: false,
				activePointerId: null,
				pointerType: null
			}));
			removeAllGlobalListeners();
			if (!get(opts.allowTextSelectionOnPress)) {
				restoreTextSelection($state.target);
			}
		}
	}

	function cancelOnPointerExit(e: EventBase) {
		if (get(opts.shouldCancelOnPointerExit)) {
			cancel(e);
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		const $state = get(state);
		if ($state.isPressed && $state.target && isValidKeyboardEvent(e, $state.target)) {
			if (shouldPreventDefaultKeyboard(e.target as Element, e.key)) {
				e.preventDefault();
			}

			const target = e.target as Element;
			const shouldStopPropagation = triggerPressEnd(
				createEvent($state.target, e),
				'keyboard',
				$state.target.contains(target)
			);
			removeAllGlobalListeners();

			if (shouldStopPropagation) {
				e.stopPropagation();
			}

			// If a link was triggered with a key other than Enter, open the URL ourselves.
			// This means the link has a role override, and the default browser behavior
			// only applies when using the Enter key.
			if (
				e.key !== 'Enter' &&
				isHTMLAnchorLink($state.target) &&
				$state.target.contains(target) &&
				//@ts-expect-error - applyig a symbol to an event
				!e[LINK_CLICKED]
			) {
				// Store a hidden property on the event so we only trigger link click once,
				// even if there are multiple usePress instances attached to the element.
				//@ts-expect-error - applyig a symbol to an event
				e[LINK_CLICKED] = true;
				openLink($state.target, e, false);
			}
			$state.metaKeyEvents?.delete(e.key);
			state.update((curr) => ({
				...curr,
				isPressed: false,
				metaKeyEvents: $state.metaKeyEvents
			}));
		} else if (e.key === 'Meta' && $state.metaKeyEvents?.size) {
			// If we recorded keydown events that occurred while the Meta key was pressed,
			// and those haven't received keyup events already, fire keyup events ourselves.
			// See comment above for more info about the macOS bug causing this.
			const events = $state.metaKeyEvents;
			state.update((curr) => ({ ...curr, metaKeyEvents: undefined }));
			for (const event of events.values()) {
				$state.target?.dispatchEvent(new KeyboardEvent('keyup', event));
			}
		}
	}

	function getBaseHandlers() {
		return {
			onKeyDown: (e: KeyboardEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (isValidKeyboardEvent(e, currentTarget) && currentTarget.contains(e.target as Element)) {
					if (shouldPreventDefaultKeyboard(e.target as Element, e.key)) {
						e.preventDefault();
					}
					const $state = get(state);

					// If the event is repeating, it may have started on a different element
					// after which focus moved to the current element. Ignore these events and
					// only handle the first key down event.
					let shouldStopPropagation = true;
					if (!$state.isPressed && !e.repeat) {
						state.update((curr) => ({ ...curr, target: currentTarget, isPressed: true }));
						shouldStopPropagation = triggerPressStart(e, 'keyboard');

						// Focus may move before the key up event, so register the event on the document
						// instead of the same element where the key down event occurred.
						addGlobalListener(getOwnerDocument(currentTarget), 'keyup', onKeyUp, false);
					}

					if (shouldStopPropagation) {
						e.stopPropagation();
					}

					// Keep track of the keydown events that occur while the Meta (e.g. Command) key is held.
					// macOS has a bug where keyup events are not fired while the Meta key is down.
					// When the Meta key itself is released we will get an event for that, and we'll act as if
					// all of these other keys were released as well.
					// https://bugs.chromium.org/p/chromium/issues/detail?id=1393524
					// https://bugs.webkit.org/show_bug.cgi?id=55291
					// https://bugzilla.mozilla.org/show_bug.cgi?id=1299553
					if (e.metaKey && isMac()) {
						$state.metaKeyEvents?.set(e.key, e);
						state.update((curr) => ({ ...curr, metaKeyEvents: $state.metaKeyEvents }));
					}
				} else if (e.key === 'Meta') {
					state.update((curr) => ({ ...curr, metaKeyEvents: new Map() }));
				}
			},
			onKeyUp: (e: KeyboardEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				const $state = get(state);
				if (
					isValidKeyboardEvent(e, currentTarget) &&
					!e.repeat &&
					currentTarget.contains(e.target as Element) &&
					$state.target
				) {
					triggerPressUp(createEvent($state.target, e), 'keyboard');
				}
			},
			onClick: (e: MouseEvent) => {
				const $state = get(state);
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) return;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if (e.button === 0 && !$state.isTriggeringEvent && (openLink as any).isOpening) {
					let shouldStopPropagation = true;
					const $isDisabled = get(opts.isDisabled);
					if ($isDisabled) {
						e.preventDefault();
					}

					// If triggered from a screen reader or by using element.click(),
					// trigger as if it were a keyboard click.
					if (
						!$state.ignoreClickAfterPress &&
						!$state.ignoreEmulatedMouseEvents &&
						!$state.isPressed &&
						($state.pointerType === 'virtual' || isVirtualClick(e))
					) {
						// Ensure the element receives focus (VoiceOver on iOS does not do this)
						if (!$isDisabled && !get(opts.preventFocusOnPress)) {
							focusWithoutScrolling(currentTarget);
						}

						const stopPressStart = triggerPressStart(e, 'virtual');
						const stopPressUp = triggerPressUp(e, 'virtual');
						const stopPressEnd = triggerPressEnd(e, 'virtual');
						shouldStopPropagation = stopPressStart && stopPressUp && stopPressEnd;
					}

					state.update((curr) => ({
						...curr,
						ignoreEmulatedMouseEvents: false,
						ignoreClickAfterPress: false
					}));

					if (shouldStopPropagation) {
						e.stopPropagation();
					}
				}
			}
		};
	}

	function getPointerHandlers() {
		function onPointerUp(e: PointerEvent) {
			const $state = get(state);
			if (
				e.pointerId === $state.activePointerId &&
				$state.isPressed &&
				e.button === 0 &&
				$state.target
			) {
				if (isOverTarget(e, $state.target) && $state.pointerType != null) {
					triggerPressEnd(createEvent($state.target, e), $state.pointerType);
				} else if ($state.isOverTarget && $state.pointerType != null) {
					triggerPressEnd(createEvent($state.target, e), $state.pointerType, false);
				}

				state.update((curr) => ({
					...curr,
					isPressed: false,
					isOverTarget: false,
					activePointerId: null,
					pointerType: null
				}));

				removeAllGlobalListeners();
				if (!get(opts.allowTextSelectionOnPress)) {
					restoreTextSelection($state.target);
				}
			}
		}
		// Safari on iOS < 13.2 does not implement pointerenter/pointerleave events correctly.
		// Use pointer move events instead to implement our own hit testing.
		// See https://bugs.webkit.org/show_bug.cgi?id=199803
		function onPointerMove(e: PointerEvent) {
			const $state = get(state);
			if (e.pointerId !== $state.activePointerId) {
				return;
			}

			if ($state.target && isOverTarget(e, $state.target)) {
				if (!$state.isOverTarget && $state.pointerType != null) {
					state.update((curr) => ({ ...curr, isOverTarget: true }));
					triggerPressStart(createEvent($state.target, e), $state.pointerType);
				}
			} else if ($state.target && $state.isOverTarget && $state.pointerType != null) {
				state.update((curr) => ({ ...curr, isOverTarget: false }));
				triggerPressEnd(createEvent($state.target, e), $state.pointerType, false);
				cancelOnPointerExit(e);
			}
		}

		function onPointerCancel(e: PointerEvent) {
			cancel(e);
		}

		return {
			onPointerDown: (e: PointerEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (e.button !== 0 || !currentTarget.contains(e.target as HTMLElement)) return;
				const $state = get(state);

				// iOS safari fires pointer events from VoiceOver with incorrect coordinates/target.
				// Ignore and let the onClick handler take care of it instead.
				// https://bugs.webkit.org/show_bug.cgi?id=222627
				// https://bugs.webkit.org/show_bug.cgi?id=223202
				if (isVirtualPointerEvent(e)) {
					state.update((curr) => ({ ...curr, pointerType: 'virtual' }));
					return;
				}

				state.update((curr) => ({ ...curr, pointerType: e.pointerType as PointerType }));

				let shouldStopPropagation = true;

				if (!$state.isPressed) {
					state.update((curr) => ({
						...curr,
						isPressed: true,
						isOverTarget: true,
						activePointerId: e.pointerId,
						target: currentTarget
					}));

					if (!get(opts.isDisabled) && !get(opts.preventFocusOnPress)) {
						focusWithoutScrolling(currentTarget);
					}

					if (!get(opts.allowTextSelectionOnPress)) {
						disableTextSelection(currentTarget);
					}

					shouldStopPropagation = triggerPressStart(e, e.pointerType as PointerType);

					addGlobalListener(getOwnerDocument(currentTarget), 'pointermove', onPointerMove, false);
					addGlobalListener(getOwnerDocument(currentTarget), 'pointerup', onPointerUp, false);
					addGlobalListener(
						getOwnerDocument(currentTarget),
						'pointercancel',
						onPointerCancel,
						false
					);
				}

				if (shouldStopPropagation) {
					e.stopPropagation();
				}
			},
			onMouseDown: (e: MouseEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}

				if (e.button === 0) {
					// Chrome and Firefox on touch Windows devices require mouse down events
					// to be canceled in addition to pointer events, or an extra asynchronous
					// focus event will be fired.
					if (shouldPreventDefault(e.currentTarget as Element)) {
						e.preventDefault();
					}

					e.stopPropagation();
				}
			},
			onPointerUp: (e: PointerEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				const $state = get(state);
				if (!currentTarget.contains(e.target as HTMLElement) || $state.pointerType === 'virtual')
					return;

				// Only handle left clicks
				// Safari on iOS sometimes fires pointerup events, even
				// when the touch isn't over the target, so double check.
				if (e.button === 0 && isOverTarget(e, currentTarget)) {
					triggerPressUp(e, $state.pointerType || (e.pointerType as PointerType));
				}
			}
		};
	}

	function getNonPointerHandlers() {
		function onMouseUp(e: MouseEvent) {
			// Only handle left clicks
			if (e.button !== 0) {
				return;
			}
			const $state = get(state);

			state.update((curr) => ({ ...curr, isPressed: false }));
			removeAllGlobalListeners();

			if ($state.ignoreEmulatedMouseEvents) {
				state.update((curr) => ({ ...curr, ignoreEmulatedMouseEvents: false }));
				return;
			}

			if ($state.target && isOverTarget(e, $state.target) && $state.pointerType != null) {
				triggerPressEnd(createEvent($state.target, e), $state.pointerType);
			} else if ($state.target && $state.isOverTarget && $state.pointerType != null) {
				triggerPressEnd(createEvent($state.target, e), $state.pointerType, false);
			}

			state.update((curr) => ({ ...curr, isOverTarget: false }));
		}

		function onScroll(e: Event) {
			const $state = get(state);
			if ($state.isPressed && (e.target as Element).contains($state.target)) {
				cancel({
					currentTarget: $state.target,
					shiftKey: false,
					ctrlKey: false,
					metaKey: false,
					altKey: false
				});
			}
		}

		return {
			onMouseDown: (e: MouseEvent) => {
				const currentTarget = e.currentTarget;
				const $state = get(state);
				if (!isHTMLorSVGElement(currentTarget)) return;
				// Only handle left clicks
				if (e.button !== 0 || !currentTarget.contains(e.target as Element)) {
					return;
				}

				// Due to browser inconsistencies, especially on mobile browsers, we prevent
				// default on mouse down and handle focusing the pressable element ourselves.
				if (shouldPreventDefault(currentTarget)) {
					e.preventDefault();
				}

				if ($state.ignoreEmulatedMouseEvents) {
					e.stopPropagation();
					return;
				}

				$state.pointerType = isVirtualClick(e) ? 'virtual' : 'mouse';
				state.update((curr) => ({
					...curr,
					isPressed: true,
					isOverTarget: true,
					target: currentTarget,
					pointerType: $state.pointerType
				}));

				if (!get(opts.isDisabled) && !get(opts.preventFocusOnPress)) {
					focusWithoutScrolling(currentTarget);
				}

				const shouldStopPropagation = triggerPressStart(e, $state.pointerType as PointerType);
				if (shouldStopPropagation) {
					e.stopPropagation();
				}

				addGlobalListener(getOwnerDocument(currentTarget), 'mouseup', onMouseUp, false);
			},
			onMouseEnter: (e: MouseEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}
				const $state = get(state);

				let shouldStopPropagation = true;
				if ($state.isPressed && !$state.ignoreEmulatedMouseEvents && $state.pointerType != null) {
					state.update((curr) => ({ ...curr, isOverTarget: true }));
					shouldStopPropagation = triggerPressStart(e, $state.pointerType);
				}

				if (shouldStopPropagation) {
					e.stopPropagation();
				}
			},
			onMouseLeave: (e: MouseEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}

				let shouldStopPropagation = true;
				const $state = get(state);
				if ($state.isPressed && !$state.ignoreEmulatedMouseEvents && $state.pointerType != null) {
					state.update((curr) => ({ ...curr, isOverTarget: false }));
					shouldStopPropagation = triggerPressEnd(e, $state.pointerType, false);
					cancelOnPointerExit(e);
				}

				if (shouldStopPropagation) {
					e.stopPropagation();
				}
			},
			onMouseUp: (e: MouseEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}
				const $state = get(state);
				if (!$state.ignoreEmulatedMouseEvents && e.button === 0) {
					triggerPressUp(e, $state.pointerType || 'mouse');
				}
			},
			onTouchStart: (e: TouchEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}

				const touch = getTouchFromEvent(e);
				if (!touch) return;

				state.update((curr) => ({
					...curr,
					activePointerId: touch.identifier,
					ignoreEmulatedMouseEvents: true,
					isOverTarget: true,
					isPressed: true,
					target: currentTarget,
					pointerType: 'touch'
				}));

				// Due to browser inconsistencies, especially on mobile browsers, we prevent default
				// on the emulated mouse event and handle focusing the pressable element ourselves.
				if (!get(opts.isDisabled) && !get(opts.preventFocusOnPress)) {
					focusWithoutScrolling(currentTarget);
				}
				const $state = get(state);

				if (!get(opts.allowTextSelectionOnPress)) {
					disableTextSelection($state.target as HTMLElement);
				}

				const shouldStopPropagation = triggerPressStart(e, $state.pointerType as PointerType);
				if (shouldStopPropagation) {
					e.stopPropagation();
				}

				addGlobalListener(getOwnerWindow(currentTarget), 'scroll', onScroll, true);
			},
			onTouchMove: (e: TouchEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}
				const $state = get(state);

				if (!$state.isPressed) {
					e.stopPropagation();
					return;
				}

				const touch = getTouchById(e, $state.activePointerId);
				let shouldStopPropagation = true;

				if (touch && isOverTarget(touch, currentTarget)) {
					if (!$state.isOverTarget && $state.pointerType != null) {
						state.update((curr) => ({ ...curr, isOverTarget: true }));
						shouldStopPropagation = triggerPressStart(e, $state.pointerType);
					}
				} else if ($state.isOverTarget && $state.pointerType != null) {
					state.update((curr) => ({ ...curr, isOverTarget: false }));
					shouldStopPropagation = triggerPressEnd(e, $state.pointerType, false);
					cancelOnPointerExit(e);
				}

				if (shouldStopPropagation) {
					e.stopPropagation();
				}
			},
			onTouchEnd: (e: TouchEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}
				const $state = get(state);

				if (!$state.isPressed) {
					e.stopPropagation();
					return;
				}

				const touch = getTouchById(e, $state.activePointerId);
				let shouldStopPropagation = true;
				if (touch && isOverTarget(touch, currentTarget) && $state.pointerType != null) {
					triggerPressUp(e, $state.pointerType);
					shouldStopPropagation = triggerPressEnd(e, $state.pointerType);
				} else if ($state.isOverTarget && $state.pointerType != null) {
					shouldStopPropagation = triggerPressEnd(e, $state.pointerType, false);
				}

				if (shouldStopPropagation) {
					e.stopPropagation();
				}

				state.update((curr) => ({
					...curr,
					isPressed: false,
					activePointerId: null,
					isOverTarget: false,
					ignoreEmulatedMouseEvents: true
				}));

				if ($state.target && !get(opts.allowTextSelectionOnPress)) {
					restoreTextSelection($state.target);
				}
				removeAllGlobalListeners();
			},
			onTouchCancel: (e: TouchEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}

				e.stopPropagation();
				const $state = get(state);
				if ($state.isPressed) {
					cancel(e);
				}
			},
			onDragStart: (e: DragEvent) => {
				const currentTarget = e.currentTarget;
				if (!isHTMLorSVGElement(currentTarget)) return;
				if (!currentTarget.contains(e.target as Element)) {
					return;
				}

				cancel(e);
			}
		};
	}

	function pressAction(node: HTMLElement | SVGElement) {
		const baseHandlers = getBaseHandlers();
		nodeEl = node;

		const unsubBaseHandlers = executeCallbacks(
			addEventListener(node, 'keydown', baseHandlers.onKeyDown),
			addEventListener(node, 'keyup', baseHandlers.onKeyUp),
			addEventListener(node, 'click', baseHandlers.onClick)
		);

		let unsubOtherHandlers = noop;

		if (typeof PointerEvent !== 'undefined') {
			const handlers = getPointerHandlers();
			unsubOtherHandlers = executeCallbacks(
				addEventListener(node, 'pointerdown', handlers.onPointerDown),
				addEventListener(node, 'mousedown', handlers.onMouseDown),
				addEventListener(node, 'pointerup', handlers.onPointerUp)
			);
		} else {
			const handlers = getNonPointerHandlers();
			unsubOtherHandlers = executeCallbacks(
				addEventListener(node, 'mousedown', handlers.onMouseDown),
				addEventListener(node, 'mouseenter', handlers.onMouseEnter),
				addEventListener(node, 'mouseleave', handlers.onMouseLeave),
				addEventListener(node, 'mouseup', handlers.onMouseUp),
				addEventListener(node, 'touchstart', handlers.onTouchStart),
				addEventListener(node, 'touchmove', handlers.onTouchMove),
				addEventListener(node, 'touchend', handlers.onTouchEnd),
				addEventListener(node, 'touchcancel', handlers.onTouchCancel),
				addEventListener(node, 'dragstart', handlers.onDragStart)
			);
		}

		return {
			destroy() {
				// Remove user-select: none in case destroy immediately after pressStart
				if (!get(opts.allowTextSelectionOnPress)) {
					const target = get(state).target;
					if (target) {
						restoreTextSelection(target);
					}
				}
				unsubBaseHandlers();
				unsubOtherHandlers();
			}
		};
	}

	return {
		pressAction,
		isPressed: readonly(isPressed)
	};
}

function isHTMLAnchorLink(target: Element): target is HTMLAnchorElement {
	return target.tagName === 'A' && target.hasAttribute('href');
}

function isValidKeyboardEvent(event: KeyboardEvent, currentTarget: Element): boolean {
	const { key, code } = event;
	const element = currentTarget as HTMLElement;
	const role = element.getAttribute('role');
	// Accessibility for keyboards. Space and Enter only.
	// "Spacebar" is for IE 11
	return (
		(key === 'Enter' || key === ' ' || key === 'Spacebar' || code === 'Space') &&
		!(
			(element instanceof getOwnerWindow(element).HTMLInputElement &&
				!isValidInputKey(element, key)) ||
			element instanceof getOwnerWindow(element).HTMLTextAreaElement ||
			element.isContentEditable
		) &&
		// Links should only trigger with Enter key
		!((role === 'link' || (!role && isHTMLAnchorLink(element))) && key !== 'Enter')
	);
}

function getTouchFromEvent(event: TouchEvent): Touch | null {
	const { targetTouches } = event;
	if (targetTouches.length > 0) {
		return targetTouches[0];
	}
	return null;
}

function getTouchById(event: TouchEvent, pointerId: null | number): null | Touch {
	const changedTouches = event.changedTouches;
	for (let i = 0; i < changedTouches.length; i++) {
		const touch = changedTouches[i];
		if (touch.identifier === pointerId) {
			return touch;
		}
	}
	return null;
}

function createEvent(target: FocusableElement, e: EventBase): EventBase {
	return {
		currentTarget: target,
		shiftKey: e.shiftKey,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		altKey: e.altKey
	};
}

type Rect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

type EventPoint = {
	clientX: number;
	clientY: number;
	width?: number;
	height?: number;
	radiusX?: number;
	radiusY?: number;
};

function getPointClientRect(point: EventPoint): Rect {
	let offsetX = 0;
	let offsetY = 0;
	if (point.width !== undefined) {
		offsetX = point.width / 2;
	} else if (point.radiusX !== undefined) {
		offsetX = point.radiusX;
	}
	if (point.height !== undefined) {
		offsetY = point.height / 2;
	} else if (point.radiusY !== undefined) {
		offsetY = point.radiusY;
	}

	return {
		top: point.clientY - offsetY,
		right: point.clientX + offsetX,
		bottom: point.clientY + offsetY,
		left: point.clientX - offsetX
	};
}

function areRectanglesOverlapping(a: Rect, b: Rect) {
	// check if they cannot overlap on x axis
	if (a.left > b.right || b.left > a.right) {
		return false;
	}
	// check if they cannot overlap on y axis
	if (a.top > b.bottom || b.top > a.bottom) {
		return false;
	}
	return true;
}

function isOverTarget(point: EventPoint, target: Element) {
	const rect = target.getBoundingClientRect();
	const pointRect = getPointClientRect(point);
	return areRectanglesOverlapping(rect, pointRect);
}

function shouldPreventDefault(target: Element) {
	// We cannot prevent default if the target is a draggable element.
	return !(target instanceof HTMLElement) || !target.hasAttribute('draggable');
}

function shouldPreventDefaultKeyboard(target: Element, key: string) {
	if (target instanceof HTMLInputElement) {
		return !isValidInputKey(target, key);
	}

	if (target instanceof HTMLButtonElement) {
		return target.type !== 'submit' && target.type !== 'reset';
	}

	if (isHTMLAnchorLink(target)) {
		return false;
	}

	return true;
}

const nonTextInputTypes = new Set([
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'image',
	'button',
	'submit',
	'reset'
]);

function isValidInputKey(target: HTMLInputElement, key: string) {
	// Only space should toggle checkboxes and radios, not enter.
	return target.type === 'checkbox' || target.type === 'radio'
		? key === ' '
		: nonTextInputTypes.has(target.type);
}
