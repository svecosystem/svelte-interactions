// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.

export interface HoverEvent {
	/** The type of hover event being fired. */
	type: 'hoverstart' | 'hoverend';
	/** The pointer type that triggered the hover event. */
	pointerType: 'mouse' | 'pen';
	/** The target element of the hover event. */
	target: Element;
}

export type HoverHandlers = {
	/** Handler that is called when a hover interaction starts. */
	onHoverStart?: (e: HoverEvent) => void;
	/** Handler that is called when a hover interaction ends. */
	onHoverEnd?: (e: HoverEvent) => void;
	/** Handler that is called when the hover state changes. */
	onHoverChange?: (isHovering: boolean) => void;
};
