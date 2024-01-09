export type GeneralEventListener<E = Event> = (evt: E) => unknown;

export type EventBase = {
	currentTarget: EventTarget | null;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
};

export type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';
