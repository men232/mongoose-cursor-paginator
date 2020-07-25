const { isEmptyObject, cloneDeep, sameKeys } = require('./object');

module.exports = {
	rangeFilter,
	mergeConditions
};

function rangeFilter(sortDirection, sortValues) {
	const result = {};

	for(let sortKey of Object.keys(sortDirection)) {
		const direction = sortDirection[sortKey];
		const rangeValue = sortValues[sortKey];

		if (rangeValue === undefined) {
			continue;
		}

		const comparisonOp = direction === 1 ? '$gt' : '$lt';

		result[sortKey] = {
			[comparisonOp]: rangeValue
		};
	}

	return result;
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

			first.$and.push(second);

			return first;

		// Regular merge via $and wrapping
		default:
			return {
				$and: [cloneDeep(first), cloneDeep(second)]
			};
	}
}
