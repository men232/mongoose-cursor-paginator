import mongoose from 'mongoose';
import { setupPlugin } from '../dist/mongoose-cursor-paginator.mjs';

setupPlugin(mongoose);

export const User = mongoose.model(
	'User',
	new mongoose.Schema({
		name: String,
		email: String,
		createdAt: Date,
	}),
);

export { mongoose };

export async function setupConnection() {
	const url = 'mongodb://localhost/test-paginator';

	console.info('Connect to', url);

	await mongoose.connect(url);

	console.info('Connected!');
}

export async function setupSeeds(amount = 1000) {
	await User.deleteMany();

	const now = Date.now();

	for (let ittr = 0; ittr < amount; ittr++) {
		await User.create({
			name: `User ${ittr + 1}`,
			email: `user${ittr + 1}@test.com`,
			createdAt: new Date(now - ittr * 1000 * 60 * 60 * 24),
		});
	}
}
