import { safeOnDestroy } from './lifecycle.js';

/**
 * A type alias for a general event listener function.
 *
 * @template E - The type of event to listen for
 * @param evt - The event object
 * @returns The return value of the event listener function
 */
export type GeneralEventListener<E = Event> = (evt: E) => unknown;

interface GlobalListeners {
	addGlobalListener<E extends keyof HTMLElementEventMap>(
		target: Window,
		event: E,
		handler: (this: Window, ev: HTMLElementEventMap[E]) => unknown,
		options?: boolean | AddEventListenerOptions
	): void;

	addGlobalListener<E extends keyof HTMLElementEventMap>(
		target: Document,
		event: E,
		handler: (this: Document, ev: HTMLElementEventMap[E]) => unknown,
		options?: boolean | AddEventListenerOptions
	): void;
	addGlobalListener<E extends keyof HTMLElementEventMap>(
		target: EventTarget,
		event: E,
		handler: GeneralEventListener<HTMLElementEventMap[E]>,
		options?: boolean | AddEventListenerOptions
	): void;
	removeGlobalListener<E extends keyof HTMLElementEventMap>(
		target: Window,
		event: E,
		handler: (this: Window, ev: HTMLElementEventMap[E]) => unknown,
		options?: boolean | AddEventListenerOptions
	): void;
	removeGlobalListener<E extends keyof HTMLElementEventMap>(
		target: Document,
		event: E,
		handler: (this: Document, ev: HTMLElementEventMap[E]) => unknown,
		options?: boolean | AddEventListenerOptions
	): void;
	removeGlobalListener<E extends keyof HTMLElementEventMap>(
		target: EventTarget,
		event: E,
		handler: GeneralEventListener<HTMLElementEventMap[E]>,
		options?: boolean | AddEventListenerOptions
	): void;
	removeAllGlobalListeners(): void;
}

export function createGlobalListeners(): GlobalListeners {
	let globalListeners = new Map();

	function addGlobalListener(
		target: Window | Document | EventTarget,
		event: string,
		handler: EventListener,
		options?: AddEventListenerOptions
	) {
		// Make sure we remove the listener after it is called with the `once` option.
		const fn = options?.once
			? (...args: Parameters<typeof handler>) => {
					globalListeners.delete(handler);
					handler(...args);
				}
			: handler;

		globalListeners.set(handler, { event, target, fn, options });
		target.addEventListener(event, handler, options);
	}

	function removeGlobalListener(
		target: Window | Document | EventTarget,
		event: string,
		handler: EventListener,
		options?: AddEventListenerOptions
	) {
		const fn = globalListeners.get(handler)?.fn || handler;
		target.removeEventListener(event, fn, options);
		globalListeners.delete(handler);
	}

	function removeAllGlobalListeners() {
		globalListeners.forEach((value, key) => {
			removeGlobalListener(value.target, value.event, key, value.options);
		});
		globalListeners = new Map();
	}

	safeOnDestroy(removeAllGlobalListeners);

	return { addGlobalListener, removeGlobalListener, removeAllGlobalListeners };
}
