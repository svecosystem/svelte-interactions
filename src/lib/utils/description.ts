// Portions of the code in this file are based on code from Adobe.
// Original licensing for the following can be found in the NOTICE.txt
// file in the root directory of this source tree.

import { derived, writable, type Writable } from 'svelte/store';
import { effect, isBrowser } from '$lib/utils/index.js';

let descriptionId = 0;

type DescriptionNode = { nodeCount: number; element: Element };
const descriptionNodes = new Map<string, DescriptionNode>();

export function createDescription(description: Writable<string>) {
	const id = writable<string | undefined>(undefined);

	effect([description], ([$description]) => {
		if (!$description || !isBrowser) return;

		let desc = descriptionNodes.get($description);
		if (!desc) {
			const newId = `si-description-${descriptionId++}`;
			id.set(newId);

			const node = document.createElement('div');
			node.id = newId;
			node.style.display = 'none';
			node.textContent = $description;
			document.body.appendChild(node);
			desc = { nodeCount: 0, element: node };
			descriptionNodes.set($description, desc);
		} else {
			id.set(desc.element.id);
		}

		desc.nodeCount++;
		return () => {
			if (!desc) return;

			if (--desc.nodeCount === 0) {
				desc.element.remove();
				descriptionNodes.delete($description);
			}
		};
	});

	const ariaDescribedBy = derived([id, description], ([$id, $description]) => {
		return $description ? $id : undefined;
	});

	return ariaDescribedBy;
}
