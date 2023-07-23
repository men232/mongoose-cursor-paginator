import type { QueryPaginator } from './QueryPaginator.js';

declare module 'mongoose' {
	interface PaginatorOptions {
		paginationFields: string[];
		next?: string;
		preQuery?: (this: QueryPaginator) => void;
		postQuery?: (this: QueryPaginator) => void;
	}

	interface PaginatorResult<T = any> {
		items: T[];
		metadata: {
			hasNext: boolean;
			next: string | null;
		};
	}

	/**
	 * Patch original mongoose types
	 */
	interface Query<ResultType, DocType, THelpers = {}, RawDocType = DocType> {
		paginator(opts?: Partial<PaginatorOptions>): QueryPaginator<ResultType>;
		paginatorNext(nextToken: string): QueryPaginator<ResultType>;
	}
}

export { default as MongoosePaginatorError } from './MongoosePaginatorError.js';
export { default as NextToken } from './NextToken.js';
export { default as setupPlugin } from './setupPlugin.js';
