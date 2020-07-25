const msgpack   = require('msgpack-lite');
const base64url = require('base64url');

module.exports = {
	encode,
	decode
};

function encode(obj) {
	const buf = msgpack.encode(obj);

	return base64url.encode(buf);
}

function decode(str) {
	const buf = base64url.toBuffer(str);

	return msgpack.decode(buf);
}
