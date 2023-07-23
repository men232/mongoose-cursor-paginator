import { Transform, type TransformCallback, type TransformOptions } from 'node:stream';

type FilterFn<T> = (item: T, index: number) => boolean | Promise<boolean>;

class Filter<T = any> extends Transform {
	private _count = 0;

	constructor(
		private has: FilterFn<T>,
		options?: TransformOptions,
	) {
		super({
			autoDestroy: true,
			objectMode: true,
			...options,
			readableObjectMode: true,
			writableObjectMode: true,
			highWaterMark: 16,
		});

		this._count = -1;
	}

	_transform(chunk: T, encoding: BufferEncoding, next: TransformCallback) {
		const result = this.has(chunk, ++this._count);

		if (typeof result === 'boolean') {
			if (result) {
				return next(null, chunk);
			} else {
				return next();
			}
		}

		if ('then' in result) {
			return void result
				.then((r) => {
					if (r) next(null, chunk);
				})
				.catch(next);
		}

		next();
	}
}

export default function streamFilter<T = any>(fn: FilterFn<T>, options?: TransformOptions) {
	return new Filter(fn, options);
}
