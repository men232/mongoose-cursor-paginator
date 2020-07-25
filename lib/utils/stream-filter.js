const through2 = require('through2');

module.exports = function streamFilter(transform, options) {
	options = Object.assign({
		objectMode: true,
		highWaterMark: 16
	}, options || {});

	const Filter = through2.ctor(options, function(chunk, encoding, callback) {
		if (this.options.wantStrings) chunk = chunk.toString();

		const next = (err, data) => {
			if (err) return callback(err);
			if (data) {
				this.push(chunk);
			}

			return callback();
		};

		try {
			const fnResult = transform.call(this, chunk, this._index++);

			// process as async function
			if (fnResult && fnResult.then) {
				return fnResult
					.then((result) => next(null, result))
					.catch((err) => next(err));
			}

			return next(null, fnResult);
		} catch (err) {
			return callback(err);
		}
	});

	Filter.prototype._index = 0;

	return Filter();
};
