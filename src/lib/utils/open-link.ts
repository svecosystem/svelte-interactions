import { focusWithoutScrolling } from './focus-without-scroll.js';
import { isFirefox, isIPad, isMac, isWebKit } from './platform.js';

interface Modifiers {
	metaKey?: boolean;
	ctrlKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
}

export function openLink(target: HTMLAnchorElement, modifiers: Modifiers, setOpening = true) {
	let { metaKey, ctrlKey } = modifiers;
	const { altKey, shiftKey } = modifiers;

	// Firefox does not recognize keyboard events as a user action by default, and the popup blocker
	// will prevent links with target="_blank" from opening. However, it does allow the event if the
	// Command/Control key is held, which opens the link in a background tab. This seems like the best we can do.
	// See https://bugzilla.mozilla.org/show_bug.cgi?id=257870 and https://bugzilla.mozilla.org/show_bug.cgi?id=746640.
	if (isFirefox() && window.event?.type?.startsWith('key') && target.target === '_blank') {
		if (isMac()) {
			metaKey = true;
		} else {
			ctrlKey = true;
		}
	}

	// WebKit does not support firing click events with modifier keys, but does support keyboard events.
	// https://github.com/WebKit/WebKit/blob/c03d0ac6e6db178f90923a0a63080b5ca210d25f/Source/WebCore/html/HTMLAnchorElement.cpp#L184
	const event =
		isWebKit() && isMac() && !isIPad() && process.env.NODE_ENV !== 'test'
			? // @ts-expect-error - keyIdentifier is a non-standard property, but it's what webkit expects
				new KeyboardEvent('keydown', { keyIdentifier: 'Enter', metaKey, ctrlKey, altKey, shiftKey })
			: new MouseEvent('click', {
					metaKey,
					ctrlKey,
					altKey,
					shiftKey,
					bubbles: true,
					cancelable: true
				});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(openLink as any).isOpening = setOpening;
	focusWithoutScrolling(target);
	target.dispatchEvent(event);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(openLink as any).isOpening = false;
}
