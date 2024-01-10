import type { PointerType } from '$lib/types/events.js';
import type { ActionReturn } from 'svelte/action';
import type {
	MoveMoveEvent,
	MoveStartEvent,
	MoveEndEvent,
	MoveHandlers,
	MoveEvent
} from './events.js';
import { createGlobalListeners } from '$lib/utils/globalListeners.js';
import { get, writable } from 'svelte/store';
import { disableTextSelection, restoreTextSelection } from '$lib/utils/textSelection.js';
import { executeCallbacks, noop } from '$lib/utils/callbacks.js';
import { addEventListener } from '$lib/utils/addEventListener.js';

interface EventBase {
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
}

type MoveActionReturn = ActionReturn<
	undefined,
	{
		'on:move'?: (e: CustomEvent<MoveMoveEvent>) => void;
		'on:movestart'?: (e: CustomEvent<MoveStartEvent>) => void;
		'on:moveend'?: (e: CustomEvent<MoveEndEvent>) => void;
	}
>;

export type MoveConfig = MoveHandlers;

export type MoveResult = {
	/**
	 * A Svelte action which handles applying the event listeners
	 * and dispatching events to the element
	 */
	moveAction: (node: HTMLElement | SVGElement) => MoveActionReturn;
};

/**
 * Handles move interactions across mouse, touch, and keyboard, including dragging with
 * the mouse or touch, and using the arrow keys. Normalizes behavior across browsers and
 * platforms, and ignores emulated mouse events on touch devices.
 */
export function createMove(config?: MoveConfig): MoveResult {
	const defaults = {
		onMove: undefined,
		onMoveStart: undefined,
		onMoveEnd: undefined
	};
	const { onMove, onMoveStart, onMoveEnd } = { ...defaults, ...config };

	type MoveState = {
		didMove: boolean;
		lastPosition: { pageX: number; pageY: number } | null;
		id: number | null;
	};

	let nodeEl: HTMLElement | SVGElement | null = null;

	const state = writable<MoveState>({
		didMove: false,
		lastPosition: null,
		id: null
	});

	const { addGlobalListener, removeGlobalListener } = createGlobalListeners();

	function dispatchMoveEvent(moveEvent: MoveEvent) {
		nodeEl?.dispatchEvent(new CustomEvent<MoveEvent>(moveEvent.type, { detail: moveEvent }));
	}

	function move(
		originalEvent: EventBase,
		pointerType: PointerType,
		deltaX: number,
		deltaY: number
	) {
		if (deltaX === 0 && deltaY === 0) return;

		const $state = get(state);

		if (!$state.didMove) {
			state.update((curr) => ({ ...curr, didMove: true }));

			const moveStartEvent = {
				type: 'movestart' as const,
				pointerType,
				shiftKey: originalEvent.shiftKey,
				ctrlKey: originalEvent.ctrlKey,
				metaKey: originalEvent.metaKey,
				altKey: originalEvent.altKey
			};

			if (onMoveStart) {
				onMoveStart(moveStartEvent);
			} else {
				// dispatch move start event
				dispatchMoveEvent(moveStartEvent);
			}
		}
		const moveEvent = {
			type: 'move' as const,
			pointerType,
			deltaX: deltaX,
			deltaY: deltaY,
			shiftKey: originalEvent.shiftKey,
			ctrlKey: originalEvent.ctrlKey,
			metaKey: originalEvent.metaKey,
			altKey: originalEvent.altKey
		};
		if (onMove) {
			onMove(moveEvent);
		} else {
			dispatchMoveEvent(moveEvent);
		}
	}

	function end(originalEvent: EventBase, pointerType: PointerType) {
		restoreTextSelection();
		if (get(state).didMove) {
			const moveEndEvent = {
				type: 'moveend' as const,
				pointerType,
				shiftKey: originalEvent.shiftKey,
				ctrlKey: originalEvent.ctrlKey,
				metaKey: originalEvent.metaKey,
				altKey: originalEvent.altKey
			};
			if (onMoveEnd) {
				onMoveEnd(moveEndEvent);
			} else {
				dispatchMoveEvent(moveEndEvent);
			}
		}
	}

	function start() {
		disableTextSelection();
		state.update((curr) => ({ ...curr, didMove: false }));
	}

	function getMouseAndTouchHandlers() {
		function globalMouseMove(e: MouseEvent) {
			if (e.button !== 0) return;
			const $state = get(state);
			const deltaX = e.pageX - ($state.lastPosition?.pageX ?? 0);
			const deltaY = e.pageY - ($state.lastPosition?.pageY ?? 0);
			move(e, 'mouse', deltaX, deltaY);
		}

		function globalMouseUp(e: MouseEvent) {
			if (e.button !== 0) return;
			end(e, 'mouse');
			removeGlobalListener(window, 'mousemove', globalMouseMove, false);
			removeGlobalListener(window, 'mouseup', globalMouseUp, false);
		}

		function onMouseDown(e: MouseEvent) {
			if (e.button !== 0) return;
			start();
			e.stopPropagation();
			e.preventDefault();
			state.update((curr) => ({ ...curr, lastPosition: { pageX: e.pageX, pageY: e.pageY } }));
			addGlobalListener(window, 'mousemove', globalMouseMove, false);
			addGlobalListener(window, 'mouseup', globalMouseUp, false);
		}

		function globalTouchMove(e: TouchEvent) {
			const $state = get(state);
			const touch = getTouchIndex(e, $state.id);
			if (touch < 0) return;
			const { pageX, pageY } = e.changedTouches[touch];
			const deltaX = pageX - ($state.lastPosition?.pageX ?? 0);
			const deltaY = pageY - ($state.lastPosition?.pageY ?? 0);
			move(e, 'touch', deltaX, deltaY);
		}

		function globalTouchEnd(e: TouchEvent) {
			const $state = get(state);
			const touch = getTouchIndex(e, $state.id);
			if (touch < 0) return;
			end(e, 'touch');
			state.update((curr) => ({ ...curr, id: null }));
			removeGlobalListener(window, 'touchmove', globalTouchMove, false);
			removeGlobalListener(window, 'touchend', globalTouchEnd, false);
			removeGlobalListener(window, 'touchcancel', globalTouchEnd, false);
		}

		function onTouchStart(e: TouchEvent) {
			const $state = get(state);
			if (e.changedTouches.length === 0 || $state.id !== null) return;

			const { pageX, pageY, identifier } = e.changedTouches[0];
			start();
			e.stopPropagation();
			e.preventDefault();
			state.update((curr) => ({ ...curr, lastPosition: { pageX, pageY }, id: identifier }));

			addGlobalListener(window, 'touchmove', globalTouchMove, false);
			addGlobalListener(window, 'touchend', globalTouchEnd, false);
			addGlobalListener(window, 'touchcancel', globalTouchEnd, false);
		}

		return {
			onMouseDown,
			onTouchStart
		};
	}

	function getPointerHandlers() {
		function globalPointerMove(e: PointerEvent) {
			const $state = get(state);
			if (e.pointerId !== $state.id) return;
			const pointerType = (e.pointerType || 'mouse') as PointerType;

			// Problems with PointerEvent#movementX/movementY:
			// 1. it is always 0 on macOS Safari.
			// 2. On Chrome Android, it's scaled by devicePixelRatio, but not on Chrome macOS
			const deltaX = e.pageX - ($state.lastPosition?.pageX ?? 0);
			const deltaY = e.pageY - ($state.lastPosition?.pageY ?? 0);
			move(e, pointerType, deltaX, deltaY);
			state.update((curr) => ({ ...curr, lastPosition: { pageX: e.pageX, pageY: e.pageY } }));
		}

		function globalPointerUp(e: PointerEvent) {
			const $state = get(state);
			if (e.pointerId !== $state.id) return;
			const pointerType = (e.pointerType || 'mouse') as PointerType;
			end(e, pointerType);
			state.update((curr) => ({ ...curr, id: null }));
			removeGlobalListener(window, 'pointermove', globalPointerMove, false);
			removeGlobalListener(window, 'pointerup', globalPointerUp, false);
			removeGlobalListener(window, 'pointercancel', globalPointerUp, false);
		}

		function onPointerDown(e: PointerEvent) {
			const $state = get(state);
			if (e.button !== 0 || $state.id !== null) return;
			start();
			e.stopPropagation();
			e.preventDefault();
			state.update((curr) => ({
				...curr,
				lastPosition: { pageX: e.pageX, pageY: e.pageY },
				id: e.pointerId
			}));
			addGlobalListener(window, 'pointermove', globalPointerMove, false);
			addGlobalListener(window, 'pointerup', globalPointerUp, false);
			addGlobalListener(window, 'pointercancel', globalPointerUp, false);
		}

		return {
			onPointerDown
		};
	}

	function getKeyboardHandlers() {
		function triggerKeyboardMove(e: KeyboardEvent, deltaX: number, deltaY: number) {
			e.preventDefault();
			e.stopPropagation();
			start();
			move(e, 'keyboard', deltaX, deltaY);
			end(e, 'keyboard');
		}

		function onKeyDown(e: KeyboardEvent) {
			switch (e.key) {
				case 'Left':
				case 'ArrowLeft':
					triggerKeyboardMove(e, -1, 0);
					break;
				case 'Right':
				case 'ArrowRight':
					triggerKeyboardMove(e, 1, 0);
					break;
				case 'Up':
				case 'ArrowUp':
					triggerKeyboardMove(e, 0, -1);
					break;
				case 'Down':
				case 'ArrowDown':
					triggerKeyboardMove(e, 0, 1);
					break;
			}
		}

		return {
			onKeyDown
		};
	}

	function moveAction(node: HTMLElement | SVGElement) {
		nodeEl = node;
		const keyboardHandlers = getKeyboardHandlers();
		const unsubKeyboardHandlers = executeCallbacks(
			addEventListener(node, 'keydown', keyboardHandlers.onKeyDown)
		);

		let unsubHandlers = noop;

		if (typeof PointerEvent !== 'undefined') {
			const handlers = getPointerHandlers();
			unsubHandlers = executeCallbacks(
				addEventListener(node, 'pointerdown', handlers.onPointerDown)
			);
		} else {
			const handlers = getMouseAndTouchHandlers();
			unsubHandlers = executeCallbacks(
				addEventListener(node, 'mousedown', handlers.onMouseDown),
				addEventListener(node, 'touchstart', handlers.onTouchStart)
			);
		}

		return {
			destroy() {
				unsubHandlers();
				unsubKeyboardHandlers();
			}
		};
	}
	return { moveAction };
}

function getTouchIndex(e: TouchEvent, id: number | null) {
	return [...e.changedTouches].findIndex(({ identifier }) => identifier === id);
}
