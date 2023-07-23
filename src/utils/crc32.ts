import _crc32 from 'crc/crc32';

const CACHE = new Map<string, number>();

export default function crc32(value: string) {
	if (CACHE.has(value)) {
		return CACHE.get(value)!;
	}

	const result = _crc32(value);

	CACHE.set(value, result);

	return result;
}
