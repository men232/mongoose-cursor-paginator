// @ts-ignore
import _cloneDeep from 'clone-deep';

export const cloneDeep = <T extends object>(obj: T): T => {
	return _cloneDeep(obj);
};

export function isEmptyObject(obj: object) {
	if (!obj || typeof obj !== 'object') {
		return true;
	}

	for (const key in obj) {
		return false;
	}

	return true;
}

function getNestedValue(obj: any, path: string): any {
	return path.split('.').reduce((current, key) => {
		return current && current[key] !== undefined ? current[key] : undefined;
	}, obj);
}

export function pick(obj: Record<string, any>, list: string[]) {
	const result: Record<string, any> = {};

	for (const path of list) {
		const value = getNestedValue(obj, path as string);
		result[path] = value;
	}

	return result;
}

export function sameKeys(...args: object[]) {
	const ittrs: Record<string, number> = {};

	for (let obj of args) {
		const keys = Object.keys(obj);

		for (let key of keys) {
			if (!ittrs[key]) ittrs[key] = 0;
			ittrs[key]++;
		}
	}

	return Object.keys(ittrs).filter((key) => ittrs[key] > 1);
}

export function defineGetter(obj: object, key: string, getterFn: () => any) {
	// @ts-ignore
	delete obj[key];

	Object.defineProperty(obj, key, {
		get: getterFn,
		enumerable: true,
		configurable: true,
	});
}

export function isLastKeys(obj: object, keys: string[], strictOrder?: boolean) {
	const objKeys = Object.keys(obj);

	const lastKeys = objKeys.slice(-keys.length);

	if (lastKeys.length !== keys.length) {
		return false;
	}

	for (let idx = 0; idx < keys.length; idx++) {
		if (strictOrder) {
			if (lastKeys[idx] !== keys[idx]) {
				return false;
			}
		} else {
			if (!lastKeys.includes(keys[idx])) {
				return false;
			}
		}
	}

	return true;
}
