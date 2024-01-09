export function isElement(value: unknown): value is Element {
	return value instanceof Element;
}

export function isHTMLorSVGElement(el: unknown): el is HTMLElement | SVGElement {
	return el instanceof HTMLElement || el instanceof SVGElement;
}
