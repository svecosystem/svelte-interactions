// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.
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

export type PressHandlers = {
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

export interface HoverEvent {
	/** The type of hover event being fired. */
	type: 'hoverstart' | 'hoverend';
	/** The pointer type that triggered the hover event. */
	pointerType: 'mouse' | 'pen';
	/** The target element of the hover event. */
	target: Element;
}

export type HoverEvents = {
	/** Handler that is called when a hover interaction starts. */
	onHoverStart?: (e: HoverEvent) => void;
	/** Handler that is called when a hover interaction ends. */
	onHoverEnd?: (e: HoverEvent) => void;
	/** Handler that is called when the hover state changes. */
	onHoverChange?: (isHovering: boolean) => void;
};
