const debug = require('debug')('mongoose-paginator');

const QueryPaginator         = require('./QueryPaginator');
const MongoosePaginatorError = require('./error/MongoosePaginatorError');
const paginCursor            = require('./utils/pagin-cursor');

const { isLastKeys, isEmptyObject, cloneDeep } = require('./utils/object');

module.exports = function(mongoose) {
	const { Query } = mongoose;

	Query.prototype.paginator = function(options) {
		const query = this;

		if (arguments.length === 0 && query._paginator) {
			return query._paginator;
		}

		options = cloneDeep(options || {});

		const { preQuery, postQuery } = options;

		delete options.preQuery;
		delete options.postQuery;

		// Set default queryOptions from query object
		if (!options.queryOptions) {
			options.queryOptions = cloneDeep(query.getOptions());

			debug('set default from query [queryOptions] = %o', options.queryOptions);
		}

		// Set default sort
		if (
			!options.queryOptions.sort ||
			isEmptyObject(options.queryOptions.sort)
		) {
			options.queryOptions.sort = { _id: -1 };

			debug('set default from query [queryOptions.sort] = %o', options.queryOptions.sort);
		}

		// Set default queryFilter from query object
		const queryFilter = cloneDeep(query.getFilter());

		if (!options.queryFilter) {
			options.queryFilter = queryFilter;

			debug('set default from query [queryFilter] = %o', queryFilter);
		} else if (!isEmptyObject(queryFilter)) {
			throw new TypeError(
				'.paginator queryFilter make attempt to overwrite the query conditions.'
			);
		}

		// Set default pagination fields from query sort options
		if (
			!Array.isArray(options.paginationFields) ||
			!options.paginationFields.length
		) {
			options.paginationFields = Object.keys(options.queryOptions.sort);

			debug('set default from query [paginationFields] = %o', options.paginationFields);
		}

		// Pagination fields validation
		if (
			!isLastKeys(options.queryOptions.sort, options.paginationFields)
		) {
			const expectedKeys = options.paginationFields.join(', ');

			throw new MongoosePaginatorError(
				`The query sort keys must ends with "${expectedKeys}".`, 2000);
		}

		// Parse previous cursor
		if (options.next) {
			try {
				options.previous = typeof options.next === 'string'
					? paginCursor.decode(options.next)
					: options.next

				delete options.next;

				options.paginationFields = Object.keys(options.previous.sortValues);

				debug('parse previous = %o', options.previous);
				debug('set from previous [paginationFields] = %o', options.paginationFields);

			} catch (orignErr) {
				const err = new MongoosePaginatorError(
					'Failed to parse next pagination cursor.', 1000);

				err.orignErr = orignErr;

				throw err;
			}

			// Compare the model name of next cursor
			debug('compare model name: previous = %s, query = %s',
				options.previous.modelName,
				query.model.modelName
			);

			if (query.model.modelName !== options.previous.modelName) {
				throw new MongoosePaginatorError(
					'The model name of next cursor token is not equal with query model name.', 1000);
			}
		}

		const pagin = new QueryPaginator(query, options);

		// Add hooks
		preQuery && pagin.pre('query', preQuery);
		postQuery && pagin.post('query', postQuery);

		query._paginator = pagin;

		return pagin;
	};

	Query.prototype.paginatorNext = function(nextString) {
		const query = this;

		if (arguments.length === 0 && query._paginator) {
			return query._paginator;
		}

		let previous;

		if (nextString) {
			if (typeof nextString !== 'string') {
				throw new TypeError('.paginatorNext required first argument a string.');
			}

			try {
				previous = paginCursor.decode(nextString);

				debug('parse previous = %o', previous);
			} catch (orignErr) {
				const err = new MongoosePaginatorError(
					'Failed to parse next pagination cursor.', 1000);

				err.orignErr = orignErr;

				throw err;
			}
		}

		const queryOptions = cloneDeep(query.getOptions());
		const queryFilter  = cloneDeep(query.getFilter());

		const options = {
			queryOptions,
			queryFilter,
			paginationFields: Object.keys(queryOptions.sort),
			previous: previous
				? Object.assign(previous, { lastItemId: null, sortDirection: null })
				: null
		}

		const pagin = new QueryPaginator(query, options);

		delete pagin.next.lastItemId;
		delete pagin.next.sortDirection;

		query._paginator = pagin;

		return pagin;
	};
}

module.exports.paginCursor = paginCursor;

