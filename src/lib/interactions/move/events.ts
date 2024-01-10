import type { PointerType } from '$lib/types/events.js';

export interface BaseMoveEvent {
	/** The pointer type that triggered the move event. */
	pointerType: PointerType;

	/** Whether the shift keyboard modifier was held during the move event. */
	shiftKey: boolean;

	/** Whether the ctrl keyboard modifier was held during the move event. */
	ctrlKey: boolean;

	/** Whether the meta keyboard modifier was held during the move event. */
	metaKey: boolean;

	/** Whether the alt keyboard modifier was held during the move event. */
	altKey: boolean;
}

export interface MoveStartEvent extends BaseMoveEvent {
	/** The type of move event being fired. */
	type: 'movestart';
}

export interface MoveMoveEvent extends BaseMoveEvent {
	/** The type of move event being fired. */
	type: 'move';

	/** The amount moved in the X direction since the last event. */
	deltaX: number;

	/** The amount moved in the Y direction since the last event. */
	deltaY: number;
}

export interface MoveEndEvent extends BaseMoveEvent {
	/** The type of move event being fired. */
	type: 'moveend';
}

export type MoveEvent = MoveStartEvent | MoveMoveEvent | MoveEndEvent;

export type MoveHandlers = {
	/**
	 * Handler that is called when a move interaction starts.
	 */
	onMoveStart?: (e: MoveStartEvent) => void;

	/**
	 * Handler that is called when a move interaction ends.
	 */
	onMoveEnd?: (e: MoveEndEvent) => void;

	/**
	 * Handler that is called when the element is moved.
	 */
	onMove?: (e: MoveMoveEvent) => void;
};
