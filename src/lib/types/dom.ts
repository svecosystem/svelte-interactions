/** Any focusable element, including both HTML and SVG elements. */
export type FocusableElement = HTMLElement | SVGElement;

/**
 * A type alias for a general event listener function.
 *
 * @template E - The type of event to listen for
 * @param evt - The event object
 * @returns The return value of the event listener function
 */
export type GeneralEventListener<E = Event> = (evt: E) => unknown;
