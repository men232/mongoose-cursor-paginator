import { User, setupConnection, setupSeeds } from './mongoose.js';
import { MongoosePaginatorError, NextToken } from '../dist/mongoose-cursor-paginator.mjs';

const tryFirstPage = async (sort) => {
	const nativeResult = await User.find().lean().sort(sort).limit(10);

	const paignResult = await User.find().lean().sort(sort).paginator();

	expect(paignResult.items.length).toEqual(nativeResult.length);

	expect(paignResult.items[0]._id.toString()).toEqual(nativeResult[0]._id.toString());

	expect(paignResult.items.at(-1)._id.toString()).toEqual(nativeResult.at(-1)._id.toString());
};

const trySecondPage = async (sort) => {
	const nativeResult = await User.find().lean().sort(sort).skip(10).limit(10);

	const firstPage = await User.find().lean().sort(sort).paginator();

	const secondPage = await User.find()
		.lean()
		.sort(sort)
		.paginator({ next: firstPage.metadata.next });

	expect(secondPage.items.length).toEqual(nativeResult.length);

	expect(secondPage.items[0]._id.toString()).toEqual(nativeResult[0]._id.toString());

	expect(secondPage.items.at(-1)._id.toString()).toEqual(nativeResult.at(-1)._id.toString());
};

const tryLastPage = async (sortDirection) => {
	const reverstedSort = (() => {
		const result = {};

		for (const [key, value] of Object.entries(sortDirection)) {
			result[key] = value === 1 ? -1 : 1;
		}

		return result;
	})();

	const nativeResult = await User.find().lean().sort(reverstedSort).limit(11);

	const lastItem = nativeResult.pop();

	const sortValues = {};

	for (const [key, value] of Object.entries(sortDirection)) {
		sortValues[key] = lastItem[key];
	}

	nativeResult.reverse();

	const paignResult = await User.find()
		.lean()
		.paginator({
			next: new NextToken({
				schemaVersion: 1,
				modelName: 'User',
				sortDirection,
				sortValues,
			}).stringify(),
		});

	expect(paignResult.items.length).toEqual(nativeResult.length);

	expect(paignResult.items[0]._id.toString()).toEqual(nativeResult[0]._id.toString());

	expect(paignResult.items.at(-1)._id.toString()).toEqual(nativeResult.at(-1)._id.toString());

	expect(paignResult.metadata.hasNext).toEqual(false);

	expect(paignResult.metadata.next).toEqual(null);
};

beforeAll(async () => {
	await setupConnection();
	// await setupSeeds();
});

test('tweak query without options', () => {
	const queryOptions = User.find().paginator().tweak().getQuery().getOptions();

	expect(queryOptions).toEqual({ limit: 11, sort: { _id: -1 } });
});

test('tweak query with options', () => {
	const queryOptions = User.find()
		.limit(15)
		.sort({ createdAt: -1 })
		.paginator()
		.tweak()
		.getQuery()
		.getOptions();

	expect(queryOptions).toEqual({ limit: 16, sort: { createdAt: -1 } });
});

test('paginationFields validation', async () => {
	try {
		User.find()
			.lean()
			.sort({ createdAt: -1, _id: -1 })
			.paginator({ paginationFields: ['status'] })
			.tweak();
	} catch (err) {
		expect(MongoosePaginatorError.is(err)).toEqual(true);
		expect(err.code).toEqual(2000);

		return;
	}

	expect('passed').toEqual('MongoosePaginatorError');
});

test('first page { _id: -1 }', async () => {
	await tryFirstPage({ _id: -1 });
});

test('second page { _id: -1 }', async () => {
	await trySecondPage({ _id: -1 });
});

test('last page { _id: -1 }', async () => {
	await tryLastPage({ _id: -1 });
});

test('first page { createdAt: -1 }', async () => {
	await tryFirstPage({ createdAt: -1 });
});

test('second page { createdAt: -1 }', async () => {
	await trySecondPage({ createdAt: -1 });
});

test('last page { createdAt: -1 }', async () => {
	await tryLastPage({ createdAt: -1 });
});

test('first page { createdAt: -1, _id: -1 }', async () => {
	await tryFirstPage({ createdAt: -1, _id: -1 });
});

test('second page { createdAt: -1, _id: -1 }', async () => {
	await trySecondPage({ createdAt: -1, _id: -1 });
});

test('last page { createdAt: -1, _id: -1 }', async () => {
	await tryLastPage({ createdAt: -1, _id: -1 });
});

test('stream first page { createdAt: -1, _id: -1 }', async () => {
	const sort = { createdAt: -1, _id: -1 };

	const nativeResult = await User.find().lean().sort(sort).limit(10);

	const dbStream = await User.find().lean().sort(sort).paginator().stream();

	const paignItems = await toArray(dbStream);

	expect(paignItems.length).toEqual(nativeResult.length);

	expect(paignItems[0]._id.toString()).toEqual(nativeResult[0]._id.toString());

	expect(paignItems.at(-1)._id.toString()).toEqual(nativeResult.at(-1)._id.toString());
});

test('stream second page { createdAt: -1, _id: -1 }', async () => {
	const sort = { createdAt: -1, _id: -1 };

	const nativeResult = await User.find().lean().sort(sort).skip(10).limit(10);

	const firstPage = await User.find().lean().sort(sort).paginator();

	const dbStream = await User.find()
		.lean()
		.sort(sort)
		.paginator({ next: firstPage.metadata.next })
		.stream();

	const paignItems = await toArray(dbStream);

	expect(paignItems.length).toEqual(nativeResult.length);

	expect(paignItems[0]._id.toString()).toEqual(nativeResult[0]._id.toString());

	expect(paignItems.at(-1)._id.toString()).toEqual(nativeResult.at(-1)._id.toString());
});

function toArray(stream) {
	return new Promise((resolve, reject) => {
		let arr = [];

		stream.on('data', onData);
		stream.on('end', onEnd);
		stream.on('error', onError);
		stream.on('close', onClose);

		function onData(doc) {
			arr.push(doc);
		}

		function onEnd() {
			resolve(arr);
			cleanup();
		}

		function onError(err) {
			reject(err);
			cleanup();
		}

		function onClose() {
			resolve(arr);
			cleanup();
		}

		function cleanup() {
			arr = null;
			stream.removeListener('data', onData);
			stream.removeListener('end', onEnd);
			stream.removeListener('error', onEnd);
			stream.removeListener('close', onClose);
		}
	});
}
