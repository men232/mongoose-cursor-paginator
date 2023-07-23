export default class MongoosePaginatorError extends Error {
	public readonly name = 'MongoosePaginatorError';

	constructor(
		message: string,
		public code: number = -1,
	) {
		super(message);
	}

	toString() {
		return `${this.name} (${this.code}): ${this.message}`;
	}

	toJSON() {
		return Object.assign({}, this, { message: this.message, code: this.code });
	}

	inspect() {
		return Object.assign(new Error(this.message), this);
	}

	static is(error: any): error is MongoosePaginatorError {
		return error && 'name' in error && error.name === 'MongoosePaginatorError';
	}
}
