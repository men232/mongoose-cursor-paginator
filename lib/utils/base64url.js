const msgpack   = require('msgpack-lite');
const base64url = require('base64url');
const mongoose  = require('mongoose');

const ObjectId = mongoose.Types.ObjectId;

const codec = msgpack.createCodec({ preset: true });

// Encode ObjectId
codec.addExtPacker(0x3F, ObjectId, (value) => {
	return msgpack.encode(value.toString());
});

// Decode ObjectId
codec.addExtUnpacker(0x3F, (value) => {
	const id = msgpack.decode(value);
	return new ObjectId(id);
});

module.exports = {
	encode,
	decode
};

function encode(obj) {
	const buf = msgpack.encode(obj, { codec });

	return base64url.encode(buf);
}

function decode(str) {
	const buf = base64url.toBuffer(str);

	return msgpack.decode(buf, { codec });
}
