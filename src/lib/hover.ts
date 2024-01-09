// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.

import { writable, type Readable, get } from 'svelte/store';
import type { HoverEvent, HoverEvents } from './types/events.js';
import type { ActionReturn } from 'svelte/action';
import { safeOnMount } from './utils/lifecycle.js';
import { effect } from './utils/effect.js';
import { isElement, isHTMLorSVGElement } from './utils/isElement.js';
import { executeCallbacks, noop } from './utils/callbacks.js';
import { addEventListener } from './utils/addEventListener.js';

export type HoverConfig = HoverEvents & {
	/** Whether the hover events should be disabled */
	isDisabled?: boolean;
};

type HoverPointerType = HoverEvent['pointerType'] | 'touch';

type HoverActionReturn = ActionReturn<
	undefined,
	{
		'on:hoverstart'?: (e: CustomEvent<HoverEvent>) => void;
		'on:hoverend'?: (e: CustomEvent<HoverEvent>) => void;
	}
>;

export type HoverResult = {
	/** Whether the element is currently being hovered */
	isHovered: Readable<boolean>;
	/** A Svelte action which handles applying the event listeners to the element */
	hoverAction: (node: HTMLElement | SVGElement) => HoverActionReturn;
};

// iOS fires onPointerEnter twice: once with pointerType="touch" and again with pointerType="mouse".
// We want to ignore these emulated events so they do not trigger hover behavior.
// See https://bugs.webkit.org/show_bug.cgi?id=214609
// As of 2024-01-08, this bug has been resolved at the end of 2022, however, we want
// to support older versions of iOS and revisit the necessity of this in the future
let globalIgnoreEmulatedMouseEvents = false;
let hoverCount = 0;

function setGlobalIgnoreEmulatedMouseEvents() {
	globalIgnoreEmulatedMouseEvents = true;

	// Clear globalIgnoreEmulatedMouseEvents after a short timeout. iOS fires onPointerEnter
	// with pointerType="mouse" immediately after onPointerUp and before onFocus. On other
	// devices that don't have this quirk, we don't want to ignore a mouse hover sometime in
	// the distant future because a user previously touched the element.
	setTimeout(() => {});
}

function handleGlobalPointerEvent(e: PointerEvent) {
	if (e.pointerType === 'touch') {
		setGlobalIgnoreEmulatedMouseEvents();
	}
}

function setupGlobalTouchEvents() {
	if (typeof document === 'undefined') {
		return;
	}

	if (typeof PointerEvent !== 'undefined') {
		document.addEventListener('pointerup', handleGlobalPointerEvent);
	} else {
		document.addEventListener('touchend', setGlobalIgnoreEmulatedMouseEvents);
	}

	hoverCount++;
	return () => {
		hoverCount--;
		if (hoverCount > 0) {
			return;
		}

		if (typeof PointerEvent !== 'undefined') {
			document.removeEventListener('pointerup', handleGlobalPointerEvent);
		} else {
			document.removeEventListener('touchend', setGlobalIgnoreEmulatedMouseEvents);
		}
	};
}

type MouseOrPointerEvent = MouseEvent | PointerEvent;

/**
 * Handles pointer hover interactions for an element. Normalizes behavior
 * across browsers and platforms, and ignores emulated mouse events on touch devices.
 */
export function createHover(config?: HoverConfig): HoverResult {
	const defaults = { isDisabled: false };

	const {
		onHoverStart,
		onHoverChange,
		onHoverEnd,
		isDisabled: isDisabledProp
	} = { ...defaults, ...config };

	const isDisabled = writable(isDisabledProp);
	const isHovered = writable(false);

	type HoverState = {
		isHovered: boolean;
		ignoreEmulatedMouseEvents: boolean;
		pointerType: string;
		target: Element | null;
	};

	const state = writable<HoverState>({
		isHovered: false,
		ignoreEmulatedMouseEvents: false,
		pointerType: '',
		target: null
	});

	safeOnMount(setupGlobalTouchEvents);

	function onDisabled() {
		state.update((curr) => ({ ...curr, pointerType: '', target: null, isHovered: false }));
	}

	function triggerHoverStart(event: MouseOrPointerEvent, pointerType: HoverPointerType) {
		state.update((curr) => ({ ...curr, pointerType: pointerType ?? undefined }));

		const target = event.currentTarget;
		if (!isHTMLorSVGElement(target)) return;
		const $isDisabled = get(isDisabled);
		const $state = get(state);

		if (
			$isDisabled ||
			pointerType === 'touch' ||
			$state.isHovered ||
			!target.contains(event.target as Element)
		) {
			return;
		}

		state.update((curr) => ({ ...curr, isHovered: true, target }));

		onHoverStart?.({
			type: 'hoverstart',
			target,
			pointerType
		});

		onHoverChange?.(true);

		isHovered.set(true);
	}

	function triggerHoverEnd(event: MouseOrPointerEvent, pointerType: HoverPointerType) {
		state.update((curr) => ({ ...curr, pointerType: '', target: null }));
		const $state = get(state);
		const currentTarget = event.currentTarget;

		if (pointerType === 'touch' || !$state.isHovered || !isElement(currentTarget)) return;

		state.update((curr) => ({ ...curr, isHovered: false }));

		onHoverEnd?.({
			type: 'hoverend',
			target: currentTarget,
			pointerType
		});

		onHoverChange?.(false);

		isHovered.set(false);
	}

	function getPointerHandlers() {
		function onPointerEnter(e: PointerEvent) {
			const pointerType = e.pointerType;
			if (!isHoverPointerType(pointerType)) return;
			if (globalIgnoreEmulatedMouseEvents && e.pointerType === 'mouse') return;

			triggerHoverStart(e, pointerType);
		}

		function onPointerLeave(e: PointerEvent) {
			const $isDisabled = get(isDisabled);
			const pointerType = e.pointerType;
			const currentTarget = e.currentTarget;
			if (
				$isDisabled ||
				!isElement(currentTarget) ||
				!currentTarget.contains(e.target as Element) ||
				!isHoverPointerType(pointerType)
			) {
				return;
			}
			triggerHoverEnd(e, pointerType);
		}

		return { onPointerEnter, onPointerLeave };
	}

	function getMouseAndTouchHandlers() {
		function onTouchStart() {
			state.update((curr) => ({ ...curr, ignoreEmulatedMouseEvents: true }));
		}

		function onMouseEnter(e: MouseEvent) {
			const $state = get(state);
			if (!$state.ignoreEmulatedMouseEvents && !globalIgnoreEmulatedMouseEvents) {
				triggerHoverStart(e, 'mouse');
			}

			state.update((curr) => ({ ...curr, ignoreEmulatedMouseEvents: false }));
		}

		function onMouseLeave(e: MouseEvent) {
			const $isDisabled = get(isDisabled);
			const currentTarget = e.currentTarget;
			if ($isDisabled || !isElement(currentTarget) || !currentTarget.contains(e.target as Element))
				return;
			triggerHoverEnd(e, 'mouse');
		}

		return { onTouchStart, onMouseEnter, onMouseLeave };
	}

	effect([isDisabled], ([$isDisabled]) => {
		if ($isDisabled) {
			onDisabled();
		}
	});

	function hoverAction(node: HTMLElement | SVGElement) {
		let unsubHandlers = noop;

		if (typeof PointerEvent !== 'undefined') {
			const handlers = getPointerHandlers();
			unsubHandlers = executeCallbacks(
				addEventListener(node, 'pointerenter', handlers.onPointerEnter),
				addEventListener(node, 'pointerleave', handlers.onPointerLeave)
			);
		} else {
			const handlers = getMouseAndTouchHandlers();
			unsubHandlers = executeCallbacks(
				addEventListener(node, 'mouseenter', handlers.onMouseEnter),
				addEventListener(node, 'mouseleave', handlers.onMouseLeave),
				addEventListener(node, 'touchstart', handlers.onTouchStart)
			);
		}

		return {
			destroy: unsubHandlers
		};
	}

	return {
		hoverAction,
		isHovered
	};
}

function isHoverPointerType(pointerType: string): pointerType is HoverPointerType {
	return pointerType === 'mouse' || pointerType === 'pen' || pointerType === 'touch';
}
