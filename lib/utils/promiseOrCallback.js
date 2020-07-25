module.exports = function promiseOrCallback(callback, fn) {
	if (typeof callback === 'function') {
		return fn(function(error) {
			if (error != null) {
				try {
					callback(error);
				} catch (error) {
					return process.nextTick(() => {
						throw error;
					});
				}
				return;
			}
			callback.apply(this, arguments);
		});
	}

	return new Promise((resolve, reject) => {
		fn(function(error, res) {
			if (error !== null) {
				return reject(error);
			}
			if (arguments.length > 2) {
				return resolve(Array.prototype.slice.call(arguments, 1));
			}
			resolve(res);
		});
	});
};
