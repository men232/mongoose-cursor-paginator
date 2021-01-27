const { isEmptyObject, cloneDeep, sameKeys } = require('./object');

module.exports = {
	rangeFilter,
	mergeConditions
};

function rangeFilter(sortDirection, sortValues) {
	const keys = Object.keys(sortDirection)
		.filter(sortKey => sortValues[sortKey] !== undefined);

	const op = (sortKey) => {
		const direction = sortDirection[sortKey];

		return direction === 1 ? '$gt' : '$lt';
	};

	const val = (sortKey) => sortValues[sortKey];

	if (keys.length === 0) {
		return {};
	} else if (keys.length === 1) {
		const sortKey = keys[0];

		return {
			[sortKey]: {
				[op(sortKey)]: val(sortKey)
			}
		};
	}

	const $or = [{}];

	for(let sortKey of keys) {
		$or[0][sortKey] = {
			[op(sortKey)]: val(sortKey)
		};
	}

	for (let i = 0; i < (keys.length - 1); i++) {
		const sortKey = keys[i];
		const nextKey = keys[i + 1];

		$or.push({
			[sortKey]: { $eq: val(sortKey) },
			[nextKey]: { [op(nextKey)]: val(nextKey) }
		});
	}

	return { $or };
}

function mergeConditions(first, second) {
	switch(true) {
		// Just return second
		case isEmptyObject(first):
			return cloneDeep(second);

		// Just return first
		case isEmptyObject(second):
			return cloneDeep(first);

		// Just assign when no conflicts
		case sameKeys(first, second).length === 0:
			return Object.assign(
				cloneDeep(first),
				cloneDeep(second)
			);

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
				$and: [cloneDeep(first), cloneDeep(second)]
			};
	}
}
