const cloneDeep = require('clone-deep');

module.exports = {
	defineGetter,
	sameKeys,
	isEmptyObject,
	isLastKeys,
	cloneDeep,
	pick
};

function isEmptyObject(obj) {
	return Object.keys(obj).length === 0;
}

function pick(obj, list) {
	const result = {};

	for(const key of list) {
		result[key] = obj[key];
	}

	return result;
}

function sameKeys(...args) {
	const ittrs = {};

	for(let obj of args) {
		const keys = Object.keys(obj);

		for(let key of keys) {
			if (!ittrs[key]) ittrs[key] = 0;
			ittrs[key]++;
		}
	}

	return Object.keys(ittrs).filter(key => ittrs[key] > 1);
}

function defineGetter(obj, key, getterFn) {
	delete obj[key];

	Object.defineProperty(obj, key, {
		get: getterFn,
		enumerable: true,
		configurable: true
	});
}

function isLastKeys(obj, keys, strictOrder) {
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
			if (lastKeys.indexOf(keys[idx]) < 0) {
				return false;
			}
		}
	}

	return true;
}
