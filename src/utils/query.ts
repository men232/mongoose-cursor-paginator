import { isEmptyObject, cloneDeep, sameKeys } from './object.js';

export function rangeFilter(sortDirection: Record<string, any>, sortValues: Record<string, any>) {
	const keys = Object.keys(sortDirection).filter((sortKey) => sortValues[sortKey] !== undefined);

	const op = (sortKey: string) => {
		const direction = sortDirection[sortKey];

		return direction === 1 ? '$gt' : '$lt';
	};

	const val = (sortKey: string) => sortValues[sortKey];

	if (keys.length === 0) {
		return {};
	} else if (keys.length === 1) {
		const sortKey = keys[0];

		return {
			[sortKey]: {
				[op(sortKey)]: val(sortKey),
			},
		};
	}

	const $or = [];
	const keysAmount = keys.length;

	for (let i = 0; i < keysAmount; i++) {
		const sortKey = keys[i];

		if (i === 0) {
			$or.push({
				[sortKey]: { [op(sortKey)]: val(sortKey) },
			});
		} else {
			const filter: Record<string, any> = {};

			keys.slice(0, i).map((sortKey) => {
				filter[sortKey] = { $eq: val(sortKey) };
			});

			const sortKey = keys[i];

			filter[sortKey] = {
				[op(sortKey)]: val(sortKey),
			};

			$or.push(filter);
		}
	}

	if ($or.length === 1) return $or[0];

	return { $or };
}

export function mergeConditions(first: Record<string, any>, second: Record<string, any>) {
	switch (true) {
		// Just return second
		case isEmptyObject(first):
			return cloneDeep(second);

		// Just return first
		case isEmptyObject(second):
			return cloneDeep(first);

		// Just assign when no conflicts
		case sameKeys(first, second).length === 0:
			return Object.assign(cloneDeep(first), cloneDeep(second));

		// Merge with $and way
		case Array.isArray(first.$and):
			first = cloneDeep(first);
			second = cloneDeep(second);

			if (Object.keys(second).length === 1 && second.$and) {
				first.$and.push(...second.$and);
			} else {
				first.$and.push(second);
			}

			return first;

		// Regular merge via $and wrapping
		default:
			return {
				$and: [cloneDeep(first), cloneDeep(second)],
			};
	}
}
