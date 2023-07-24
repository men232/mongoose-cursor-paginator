import mongoose from 'mongoose';
import { BinaryWriter, BinaryReader, createExtension } from '@andrew_l/tl-pack';
import crc32 from './utils/crc32.js';

const VERSION = 1;

const ObjectId = mongoose.Types.ObjectId;

const extensions = [
	createExtension(100, {
		encode(value) {
			if (value?._bsontype?.toLowerCase() === 'objectid') {
				this.writeBytes(value.id);
			}
		},
		decode() {
			const bytes = this.readBytes();
			return new ObjectId(bytes);
		},
	}),
];

interface Properties {
	schemaVersion: number;
	modelName?: string;
	sortDirection?: Record<string, any>;
	sortValues?: Record<string, any>;
	payload: Record<string, any> | null;
}

export default class NextToken {
	public schemaVersion: number = VERSION;
	public modelNameCRC: number = 0;
	public sortDirection: Record<string, any> = {};
	public sortValues: Record<string, any> = {};
	public payload: Record<string, any> | null = null;

	constructor(options?: Partial<Properties>) {
		if (options) {
			Object.assign(this, { ...options, modelName: undefined });

			if (options.modelName) {
				this.modelNameCRC = crc32(options.modelName);
			}
		}
	}

	public stringify() {
		return this.buffer().toString('base64url');
	}

	public buffer() {
		const writer = new BinaryWriter({
			extensions,
		});

		writer.writeInt8(this.schemaVersion, false);
		writer.writeObject(this.modelNameCRC);
		writer.writeMap(this.sortDirection || {});
		writer.writeMap(this.sortValues || {});
		writer.writeObject(this.payload || null);

		return writer.getBuffer() as Buffer;
	}

	static parse(value: string | Buffer) {
		const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64url');

		const reader = new BinaryReader(buffer, { extensions });

		const schemaVersion = reader.readInt8(false);

		if (schemaVersion !== VERSION) {
			throw new TypeError(`Unexpected schema version: ${schemaVersion}`);
		}

		const token = new NextToken();

		token.modelNameCRC = reader.readObject();
		token.sortDirection = reader.readMap(false);
		token.sortValues = reader.readMap(false);
		token.payload = reader.readObject();

		return token;
	}
}
