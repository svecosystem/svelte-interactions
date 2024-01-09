import type { PressEvent } from '$lib/interactions/press/events.js';

export interface LongPressEvent extends Omit<PressEvent, 'type' | 'continuePropagation'> {
	/** The type of long press event being fired. */
	type: 'longpressstart' | 'longpressend' | 'longpress';
}

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
