// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found:
// See https://github.com/adobe/react-spectrum/blob/main/LICENSE

import type { FocusableElement } from '../types/dom.js';

// This is a polyfill for element.focus({preventScroll: true});
// Currently necessary for Safari and old Edge:
// https://caniuse.com/#feat=mdn-api_htmlelement_focus_preventscroll_option
// See https://bugs.webkit.org/show_bug.cgi?id=178583
//

interface ScrollableElement {
	element: HTMLElement;
	scrollTop: number;
	scrollLeft: number;
}

export function focusWithoutScrolling(element: FocusableElement) {
	if (supportsPreventScroll()) {
		element.focus({ preventScroll: true });
	} else {
		const scrollableElements = getScrollableElements(element);
		element.focus();
		restoreScrollPosition(scrollableElements);
	}
}

let supportsPreventScrollCached: boolean | null = null;

function supportsPreventScroll() {
	if (supportsPreventScrollCached == null) {
		supportsPreventScrollCached = false;
		try {
			const focusElem = document.createElement('div');
			focusElem.focus({
				get preventScroll() {
					supportsPreventScrollCached = true;
					return true;
				}
			});
		} catch (e) {
			// Ignore
		}
	}

	return supportsPreventScrollCached;
}

function getScrollableElements(element: FocusableElement): ScrollableElement[] {
	let parent = element.parentNode;
	const scrollableElements: ScrollableElement[] = [];
	const rootScrollingElement = document.scrollingElement || document.documentElement;

	while (parent instanceof HTMLElement && parent !== rootScrollingElement) {
		if (parent.offsetHeight < parent.scrollHeight || parent.offsetWidth < parent.scrollWidth) {
			scrollableElements.push({
				element: parent,
				scrollTop: parent.scrollTop,
				scrollLeft: parent.scrollLeft
			});
		}
		parent = parent.parentNode;
	}

	if (rootScrollingElement instanceof HTMLElement) {
		scrollableElements.push({
			element: rootScrollingElement,
			scrollTop: rootScrollingElement.scrollTop,
			scrollLeft: rootScrollingElement.scrollLeft
		});
	}

	return scrollableElements;
}

function restoreScrollPosition(scrollableElements: ScrollableElement[]) {
	for (const { element, scrollTop, scrollLeft } of scrollableElements) {
		element.scrollTop = scrollTop;
		element.scrollLeft = scrollLeft;
	}
}
