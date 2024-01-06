// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found:
// See https://github.com/adobe/react-spectrum

export type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

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

export interface LongPressEvent extends Omit<PressEvent, 'type' | 'continuePropagation'> {
	/** The type of long press event being fired. */
	type: 'longpressstart' | 'longpressend' | 'longpress';
}

export interface HoverEvent {
	/** The type of hover event being fired. */
	type: 'hoverstart' | 'hoverend';
	/** The pointer type that triggered the hover event. */
	pointerType: 'mouse' | 'pen';
	/** The target element of the hover event. */
	target: HTMLElement;
}

export interface KeyboardEvents {
	/** Handler that is called when a key is pressed. */
	onKeyDown?: (e: KeyboardEvent) => void;
	/** Handler that is called when a key is released. */
	onKeyUp?: (e: KeyboardEvent) => void;
}

export interface FocusEvents {
	/** Handler that is called when the element receives focus. */
	onFocus?: (e: FocusEvent) => void;
	/** Handler that is called when the element loses focus. */
	onBlur?: (e: FocusEvent) => void;
	/** Handler that is called when the element's focus status changes. */
	onFocusChange?: (isFocused: boolean) => void;
}

export interface HoverEvents {
	/** Handler that is called when a hover interaction starts. */
	onHoverStart?: (e: HoverEvent) => void;
	/** Handler that is called when a hover interaction ends. */
	onHoverEnd?: (e: HoverEvent) => void;
	/** Handler that is called when the hover state changes. */
	onHoverChange?: (isHovering: boolean) => void;
}

export type PressEvents = {
	/** Handler that is called when the press is released over the target. */
	onPress?: (e: PressEvent) => void;
	/** Handler that is called when a press interaction starts. */
	onPressStart?: (e: PressEvent) => void;
	/**
	 * Handler that is called when a press interaction ends, either
	 * over the target or when the pointer leaves the target.
	 */
	onPressEnd?: (e: PressEvent) => void;
	/** Handler that is called when the press state changes. */
	onPressChange?: (isPressed: boolean) => void;
	/**
	 * Handler that is called when a press is released over the target, regardless of
	 * whether it started on the target or not.
	 */
	onPressUp?: (e: PressEvent) => void;
};

export interface FocusableProps extends FocusEvents, KeyboardEvents {
	/** Whether the element should receive focus on render. */
	autoFocus?: boolean;
}

interface BaseMoveEvent {
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

export interface MoveEvents {
	/** Handler that is called when a move interaction starts. */
	onMoveStart?: (e: MoveStartEvent) => void;
	/** Handler that is called when the element is moved. */
	onMove?: (e: MoveMoveEvent) => void;
	/** Handler that is called when a move interaction ends. */
	onMoveEnd?: (e: MoveEndEvent) => void;
}

export interface ScrollEvent {
	/** The amount moved in the X direction since the last event. */
	deltaX: number;
	/** The amount moved in the Y direction since the last event. */
	deltaY: number;
}

export interface ScrollEvents {
	/** Handler that is called when the scroll wheel moves. */
	onScroll?: (e: ScrollEvent) => void;
}
