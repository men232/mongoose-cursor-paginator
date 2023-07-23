import type { Mongoose } from 'mongoose';
import mongoose from 'mongoose';
import { cloneDeep } from './utils/object.js';
import { QueryPaginator, type MongooseQuery } from './QueryPaginator.js';

const DEF_OPTIONS: mongoose.PaginatorOptions = {
	paginationFields: [],
};

export default function setupPlugin(mongoose: Mongoose) {
	const { Query } = mongoose;

	Query.prototype.paginator = paginator;
	Query.prototype.paginatorNext = paginatorNext;
}

function paginator(this: MongooseQuery, opts: Partial<mongoose.PaginatorOptions> = {}) {
	const query = this;

	if (arguments.length === 0 && query._paginator) {
		return query._paginator;
	}

	const options = cloneDeep(DEF_OPTIONS);

	if (opts) {
		Object.assign(options, opts);
	}

	query._paginator = new QueryPaginator(query, options);

	return query._paginator;
}

function paginatorNext(this: MongooseQuery, nextToken: string) {
	const query = this;

	if (arguments.length === 0 && query._paginator) {
		return query._paginator;
	}

	const options = cloneDeep(DEF_OPTIONS);

	options.next = nextToken;

	query._paginator = new QueryPaginator(query, options);

	return query._paginator;
}
