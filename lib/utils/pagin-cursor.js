const base64url = require('./base64url');

module.exports.encode = function(obj) {
	const result = base64url.encode([
		obj.lastItemId,
		obj.modelName,
		obj.sortDirection,
		obj.sortValues,
		obj.payload
	]);

	return result;
};

module.exports.decode = function(str) {
	const [
		lastItemId,
		modelName,
		sortDirection,
		sortValues,
		payload
	] = base64url.decode(str);

	return {
		lastItemId,
		modelName,
		sortDirection,
		sortValues,
		payload
	};
};
