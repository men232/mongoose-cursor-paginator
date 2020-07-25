class MongoosePaginatorError extends Error {
	constructor(message, code) {
		super(message);

		this.code = code || -1;
	}

	/**
	 * Console.log helper
	 */
	toString() {
		return `${this.name} (${this.code}): ${this.message}`;
	}

	/*!
	 * inspect helper
	 */
	inspect() {
		return Object.assign(new Error(this.message), this);
	}
}

/*!
 * Helper for JSON.stringify
 */
Object.defineProperty(MongoosePaginatorError.prototype, 'toJSON', {
	enumerable: false,
	writable: false,
	configurable: true,
	value: function() {
		return Object.assign({}, this, { message: this.message, code: this.code });
	}
});

Object.defineProperty(MongoosePaginatorError.prototype, 'name', {
	value: 'MongoosePaginatorError'
});

module.exports = MongoosePaginatorError;
