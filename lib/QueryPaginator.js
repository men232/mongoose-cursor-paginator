const Kareem = require('kareem');
const d = require('debug');

const streamFilter      = require('./utils/stream-filter');
const promiseOrCallback = require('./utils/promiseOrCallback');
const paginCursor       = require('./utils/pagin-cursor');

const debug = {
	init: d('mongoose-paginator:init'),
	tweak: d('mongoose-paginator:tweak'),
	exec: d('mongoose-paginator:exec'),
	stream: d('mongoose-paginator:query:stream')
};

const {
	isEmptyObject,
	cloneDeep,
	pick,
	defineGetter
} = require('./utils/object');

const { rangeFilter, mergeConditions } = require('./utils/query');

const DEF_OPTIONS = {
	defLimit: 10,
	defSort: { _id: -1 }
};

module.exports = QueryPaginator;

function QueryPaginator(query, options) {
	if (query.op) {
		if (query.op !== 'find') {
			throw new TypeError('.paginator only support .find method');
		}
	} else {
		query.find();
	}

	options = options || {};

	this.options = Object.assign(options, cloneDeep(DEF_OPTIONS));

	this._hooks = new Kareem();

	this.query = query;

	this.next = {
		lastItemId: null,
		modelName: query.model.modelName,
		sortDirection: {},
		sortValues: {},
		payload: {}
	};

	this._resHasNext = false;
	this._resLastItem = null;

	defineGetter(this.next, 'lastItemId', () => {
		if (!this._resLastItem) {
			return null;
		}

		return this._resLastItem._id;
	});

	defineGetter(this.next, 'sortDirection', () => {
		return cloneDeep(this.query.options.sort || {});
	});

	defineGetter(this.next, 'sortValues', () => {
		if (!this._resLastItem) {
			return {};
		}

		const sortKeys = this.options.paginationFields;

		return pick(this._resLastItem, sortKeys);
	});

	// Wrap function to call without this context
	this.getMetadata = this.getMetadata.bind(this);

	debug.init('with options = %o', options);
}

QueryPaginator.prototype.pre = function(hookName, fn) {
	this._hooks.pre(hookName, fn);

	return this;
};

QueryPaginator.prototype.post = function(hookName, fn) {
	this._hooks.post(hookName, fn);

	return this;
};

QueryPaginator.prototype.getMetadata = function() {
	const result = {
		hasNext: !!this._resHasNext,
		next: this._resHasNext ? this.nextString() : null
	};

	return result;
};

QueryPaginator.prototype.get = function(key) {
	let value = null;

	switch (key) {
		case 'next':
			value = this.next;
			break;

		case 'lastItem':
			value = cloneDeep(this._resLastItem);
			break;

		default:
			value = this.options[key];
	}

	return cloneDeep(value);
};

QueryPaginator.prototype.set = function(key, value) {
	if (typeof key === 'object') {
		const obj = key;

		for(let key of Object.keys(obj)) {
			this.set(key, obj[key]);
		}

		return this;
	}

	switch (key) {
		case 'next':
			this.next = value;
			break;

		case 'lastItem':
			this._resLastItem = cloneDeep(value);
			break;

		default:
			this.options[key] = value;
	}

	return this;
};

QueryPaginator.prototype.getOptions = function() {
	return this.options;
};

QueryPaginator.prototype.getQuery = function() {
	return this.query;
};

QueryPaginator.prototype.stream = function(callback) {
	return promiseOrCallback(callback, cb => {
		this._hooks.execPre('query', this, [], (error) => {
			if (error !== null) {
				return cb(error);
			}

			this._tweekQuery();

			const limit = this.query.getOptions().limit;

			const filter = streamFilter((item, index) => {
				// Remove the extra element that we added to 'peek' to see
				// if there were more entries.
				if ((index + 1) === limit) {
					this._resHasNext = true;

					debug.stream('has next:\n\tcutoff_idx = %d\n\tnext = %j',
						index,
						this.next
					);

					return false;
				} else {
					this._resLastItem = cloneDeep(item);
				}

				return true;
			});

			const dbStream = this.query.cursor();

			dbStream.on('error', filter.emit.bind(filter, 'error'));

			const stream = dbStream.pipe(filter);

			// stream.on('end', () => {
			// 	debug.stream('end event');
			// 	this._hooks.execPost('query', this, []);
			// });

			cb(null, stream);
		});
	});
};

QueryPaginator.prototype.exec = function(callback) {
	const parseResult = (items) => {
		const limit = this.query.getOptions().limit;

		if (items.length === limit) {
			// Remove the extra element that we added to 'peek' to see
			// if there were more entries.
			items.pop();

			this._resHasNext = true;
		}

		this._resLastItem = cloneDeep(items[items.length - 1]);

		if (this._resHasNext) {
			debug.exec('has next:\n\tcutoff_idx = %d\n\tnext = %j',
				limit - 1,
				this.next
			);
		}

		const metadata = this.getMetadata();

		return { metadata, items };
	};

	return promiseOrCallback(callback, cb => {
		this._hooks.execPre('query', this, [], (preHookErr) => {
			if (preHookErr !== null) {
				return cb(preHookErr);
			}

			this._tweekQuery();

			this.query.exec((queryErr, items) => {
				if (queryErr !== null) {
					return cb(queryErr);
				}

				const result = parseResult(items);

				this._hooks.execPost('query', this, [], postHookErr => {
					if (postHookErr !== null) {
						return cb(postHookErr);
					}

					return cb(null, result);
				});
			});
		});
	});
};

QueryPaginator.prototype.then = function(resolve, reject) {
	return this.exec().then(resolve, reject);
};

QueryPaginator.prototype.catch = function(reject) {
	return this.exec().then(null, reject);
};

QueryPaginator.prototype.nextString = function() {
	if (!this._resHasNext) {
		return null;
	}

	return paginCursor.encode(this.next);
};

QueryPaginator.prototype._tweekQuery = function() {
	const paginOptions = this.options;

	let queryOptions = cloneDeep(paginOptions.queryOptions);
	let queryFilter  = cloneDeep(paginOptions.queryFilter);

	if (this.options.previous) {
		const previous = this.options.previous;

		// Reaplce sort way with previous options
		if (previous.sortDirection && !isEmptyObject(previous.sortDirection)) {
			debug.tweak('set from previous [queryOptions.sort] = %o',
				previous.sortDirection);

			queryOptions.sort = previous.sortDirection;
		}

		// Mix range conditions into query
		if (previous.sortValues && !isEmptyObject(previous.sortValues)) {
			const rangeConditions = rangeFilter(
				queryOptions.sort,
				previous.sortValues
			);

			debug.tweak(
				'range conditions:\n\tsortDirection = %o\n\tsortValues = %o\n\tresult = %o',
				queryOptions.sort,
				previous.sortValues,
				rangeConditions
			);

			queryFilter = mergeConditions(
				queryFilter,
				rangeConditions
			);
		}
	}

	// Mix with base filter
	// This data should not includes in next cursor
	if (paginOptions.baseFilter) {
		queryFilter = mergeConditions(
			paginOptions.baseFilter,
			queryFilter
		);
	}

	// Query one more element to see if there's another page
	queryOptions.limit
		= Math.max(queryOptions.limit || paginOptions.defLimit, 1) + 1;

	// Apply changes on query
	this.query.options = queryOptions;
	this.query.setQuery(queryFilter);

	debug.tweak('set queryOptions = %o', queryOptions);
	debug.tweak('set queryFilter = %o', queryFilter);
};
