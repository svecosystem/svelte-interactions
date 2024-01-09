// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.
import { writable, type Readable, get } from 'svelte/store';
import type { ActionReturn } from 'svelte/action';
import type { HoverEvent as IHoverEvent, HoverHandlers } from './events.js';
// prettier-ignore
import { safeOnMount, effect, isElement, isHTMLorSVGElement, executeCallbacks, noop, addEventListener } from '$lib/utils/index.js';

export type HoverConfig = HoverHandlers & {
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

class HoverEvent implements IHoverEvent {
	type: 'hoverstart' | 'hoverend';
	pointerType: 'mouse' | 'pen';
	target: Element;

	constructor(type: IHoverEvent['type'], pointerType: 'mouse' | 'pen', originalEvent: Event) {
		this.type = type;
		this.pointerType = pointerType;
		this.target = originalEvent.currentTarget as Element;
	}
}

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

	let unsubListener = noop;

	if (typeof PointerEvent !== 'undefined') {
		unsubListener = addEventListener(document, 'pointerup', handleGlobalPointerEvent);
	} else {
		unsubListener = addEventListener(document, 'touchend', setGlobalIgnoreEmulatedMouseEvents);
	}

	hoverCount++;
	return () => {
		hoverCount--;
		if (hoverCount > 0) {
			return;
		}

		unsubListener();
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

	// the element the action is attached to
	let nodeEl: HTMLElement | SVGElement | null = null;

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

	function dispatchHoverEvent(hoverEvent: HoverEvent) {
		nodeEl?.dispatchEvent(new CustomEvent<HoverEvent>(hoverEvent.type, { detail: hoverEvent }));
	}

	function onDisabled() {
		state.update((curr) => ({ ...curr, pointerType: '', target: null, isHovered: false }));
	}

	function triggerHoverStart(originalEvent: MouseOrPointerEvent, pointerType: HoverPointerType) {
		state.update((curr) => ({ ...curr, pointerType: pointerType ?? undefined }));

		const target = originalEvent.currentTarget;
		if (!isHTMLorSVGElement(target)) return;
		const $isDisabled = get(isDisabled);
		const $state = get(state);

		if (
			$isDisabled ||
			pointerType === 'touch' ||
			$state.isHovered ||
			!target.contains(originalEvent.target as Element)
		) {
			return;
		}

		state.update((curr) => ({ ...curr, isHovered: true, target }));

		const event = new HoverEvent('hoverstart', pointerType, originalEvent);

		onHoverStart?.({
			type: 'hoverstart',
			target,
			pointerType
		});

		dispatchHoverEvent(event);

		onHoverChange?.(true);

		isHovered.set(true);
	}

	function triggerHoverEnd(originalEvent: MouseOrPointerEvent, pointerType: HoverPointerType) {
		state.update((curr) => ({ ...curr, pointerType: '', target: null }));
		const $state = get(state);
		const currentTarget = originalEvent.currentTarget;

		if (pointerType === 'touch' || !$state.isHovered || !isElement(currentTarget)) return;

		state.update((curr) => ({ ...curr, isHovered: false }));
		const event = new HoverEvent('hoverend', pointerType, originalEvent);
		onHoverEnd?.({
			type: 'hoverend',
			target: currentTarget,
			pointerType
		});
		dispatchHoverEvent(event);

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
		nodeEl = node;

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
