// @ts-ignore
import Kareem from 'kareem';
import type internal from 'node:stream';
import d from 'debug';
import mongoose from 'mongoose';

import NextToken from './NextToken.js';
import MongoosePaginatorError from './MongoosePaginatorError.js';

import streamFilter from './utils/streamFilter.js';
import { isEmptyObject, cloneDeep, pick, defineGetter, isLastKeys } from './utils/object.js';
import { rangeFilter, mergeConditions } from './utils/query.js';
import crc32 from './utils/crc32.js';

const debug = {
	init: d('mongoose-paginator:init'),
	tweak: d('mongoose-paginator:tweak'),
	exec: d('mongoose-paginator:exec'),
	stream: d('mongoose-paginator:query:stream'),
};

export interface MongooseQuery extends mongoose.Query<any, any> {
	// @internal
	op?: string;

	// @internal
	options: mongoose.QueryOptions<any>;

	// @internal
	_paginator?: QueryPaginator;
}

export class QueryPaginator<ResultType = any> {
	private _hooks = new Kareem();
	private next: NextToken;
	private previous?: NextToken;
	private resHasNext = false;
	private resLastItem: any = null;
	private paginationFields: string[];
	private tweaked = false;

	public getMetadata = () => this.metadata;

	constructor(
		private query: MongooseQuery,
		options: mongoose.PaginatorOptions,
	) {
		if (query.op) {
			if (query.op !== 'find') {
				throw new TypeError('.paginator only support .find method');
			}
		} else {
			query.find();
		}

		this.paginationFields = options.paginationFields;

		this.next = new NextToken({
			modelName: query.model.modelName,
			sortDirection: {},
			sortValues: {},
			payload: {},
		});

		if (options.next) {
			try {
				this.previous = NextToken.parse(options.next);
				this.paginationFields = Object.keys(this.previous.sortValues);

				debug.init('parse previous = %o', this.previous);
				debug.init('set from previous [paginationFields] = %o', this.paginationFields);
			} catch (orignErr) {
				const err = new MongoosePaginatorError('Failed to parse next pagination cursor.', 3000);

				err.cause = orignErr;

				throw err;
			}

			// Compare the model name of next cursor
			const modelNameCRC = crc32(query.model.modelName);

			debug.init(
				'compare model name: previous = %d, query = %d',
				this.previous.modelNameCRC,
				modelNameCRC,
			);

			if (modelNameCRC !== this.previous.modelNameCRC) {
				throw new MongoosePaginatorError(
					'The model name of next cursor token is not equal with query model name.',
					4000,
				);
			}
		}

		options.preQuery && this.pre('query', options.preQuery);
		options.postQuery && this.post('query', options.postQuery);

		defineGetter(this.next, 'sortDirection', () => {
			return cloneDeep(this.query.options.sort || {});
		});

		defineGetter(this.next, 'sortValues', () => {
			if (!this.resLastItem) {
				return {};
			}

			return pick(this.resLastItem, this.paginationFields);
		});

		debug.init('with options = %o', options);
	}

	get metadata(): mongoose.PaginatorResult['metadata'] {
		return {
			hasNext: this.hasNext,
			next: this.nextString,
		};
	}

	get hasNext() {
		return this.resHasNext;
	}

	get nextString() {
		if (!this.resHasNext) {
			return null;
		}

		return this.next.stringify();
	}

	get nextToken() {
		return this.next;
	}

	get previousString() {
		return this.previous ? this.previous.stringify() : null;
	}

	get previousToken() {
		return this.previous || null;
	}

	getQuery() {
		return this.query;
	}

	pre(hookName: string, fn: Function) {
		this._hooks.pre(hookName, fn);

		return this;
	}

	post(hookName: string, fn: Function) {
		this._hooks.post(hookName, fn);

		return this;
	}

	get(key: string): any {
		let value = null;

		switch (key) {
			case 'next':
				value = this.next;
				break;

			case 'lastItem':
				value = this.resLastItem;
				break;

			default:
				value = (this as any)[key];
		}

		return cloneDeep(value);
	}

	set(key: string, value: any) {
		if (typeof key === 'object') {
			const obj = key;

			for (let key of Object.keys(obj)) {
				this.set(key, obj[key]);
			}

			return this;
		}

		switch (key) {
			case 'next':
				Object.assign(this.next, value);
				break;

			case 'lastItem':
				this.resLastItem = value;
				break;

			default:
				(this as any)[key] = value;
		}

		return this;
	}

	stream(): Promise<internal.Transform> {
		return new Promise((resolve, reject) => {
			this._hooks.execPre('query', this, [], (error: Error | null) => {
				if (error) return reject(error);

				this.maybeTweak();

				const limit = this.query.getOptions().limit;

				const filter = streamFilter<ResultType>((item, index) => {
					// Remove the extra element that we added to 'peek' to see
					// if there were more entries.
					if (index + 1 === limit) {
						this.resHasNext = true;

						debug.stream('has next:\n\tcutoff_idx = %d\n\tnext = %j', index, this.next);

						return false;
					} else {
						this.resLastItem = item;
					}

					return true;
				});

				const stream = this.query.cursor().pipe(filter);

				// stream.on('end', () => {
				// 	debug.stream('end event');
				// 	this._hooks.execPost('query', this, []);
				// });

				resolve(stream);
			});
		});
	}

	maybeTweak() {
		if (!this.tweaked) {
			this.tweak();
		}

		return this;
	}

	tweak() {
		const { previous } = this;

		let queryOptions = cloneDeep(this.query.getOptions());
		let queryFilter = cloneDeep(this.query.getFilter());

		if (previous) {
			// Reaplce sort way with previous options
			if (!isEmptyObject(previous.sortDirection)) {
				debug.tweak('set from previous [queryOptions.sort] = %o', previous.sortDirection);

				queryOptions.sort = previous.sortDirection;
			}

			// Mix range conditions into query
			if (!isEmptyObject(previous.sortValues)) {
				const rangeConditions = rangeFilter(queryOptions.sort, previous.sortValues);

				debug.tweak(
					'range conditions:\n\tsortDirection = %o\n\tsortValues = %o\n\tresult = %o',
					queryOptions.sort,
					previous.sortValues,
					rangeConditions,
				);

				queryFilter = mergeConditions(queryFilter, rangeConditions);
			}
		}

		// Set default sort
		if (isEmptyObject(queryOptions.sort)) {
			queryOptions.sort = { _id: -1 };

			debug.tweak('set default [queryOptions.sort] = %o', queryOptions.sort);
		}

		// Set default pagination fields from query sort options
		if (!Array.isArray(this.paginationFields) || !this.paginationFields.length) {
			this.paginationFields = Object.keys(queryOptions.sort);

			debug.tweak('set default [paginationFields] = %o', this.paginationFields);
		}

		// Pagination fields validation
		if (!isLastKeys(queryOptions.sort, this.paginationFields)) {
			const expectedKeys = this.paginationFields.join(', ');

			throw new MongoosePaginatorError(
				`The query sort keys must ends with "${expectedKeys}".`,
				2000,
			);
		}

		// Set default limit
		if (!queryOptions.limit) {
			queryOptions.limit = 11;

			debug.tweak('set default [queryOptions.limit] = %d', queryOptions.limit);
		} else {
			// Query one more element to see if there's another page
			queryOptions.limit = Math.max(queryOptions.limit || 10, 1) + 1;
		}

		// Apply changes on query
		this.query.setOptions(queryOptions);
		this.query.setQuery(queryFilter);

		debug.tweak('set queryOptions = %o', queryOptions);
		debug.tweak('set queryFilter = %o', queryFilter);

		this.tweaked = true;

		return this;
	}

	private _handleResult(items: any[]): mongoose.PaginatorResult {
		const limit = this.query.getOptions().limit!;

		if (items.length === limit) {
			// Remove the extra element that we added to 'peek' to see
			// if there were more entries.
			items.pop();

			this.resHasNext = true;
		}

		this.resLastItem = items[items.length - 1];

		if (this.resHasNext) {
			debug.exec('has next:\n\tcutoff_idx = %d\n\tnext = %j', limit - 1, this.next);
		}

		const metadata = this.getMetadata();

		return { metadata, items };
	}

	exec(): Promise<mongoose.PaginatorResult<ResultType>> {
		return new Promise((resolve, reject) => {
			this._hooks.execPre('query', this, [], (preHookErr: any) => {
				if (preHookErr) {
					return reject(preHookErr);
				}

				this.maybeTweak();

				this.query
					.exec()
					.then((items) => {
						const result = this._handleResult(items);

						this._hooks.execPost('query', this, [], (postHookErr: any) => {
							if (postHookErr) {
								return reject(postHookErr);
							}

							return resolve(result);
						});
					})
					.catch(reject);
			});
		});
	}

	then = ((onfulfilled, onrejected) =>
		this.exec().then(onfulfilled, onrejected)) as Promise<mongoose.PaginatorResult>['then'];

	cath = ((onrejected) =>
		this.exec().catch(onrejected)) as Promise<mongoose.PaginatorResult>['catch'];

	finally = ((onfinally) =>
		this.exec().finally(onfinally)) as Promise<mongoose.PaginatorResult>['finally'];
}
