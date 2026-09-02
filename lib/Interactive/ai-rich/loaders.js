

'use strict'

const crypto = require('crypto')
const { generateWAMessageFromContent: _internalGenerateWAMessageFromContent, prepareWAMessageMedia: _internalPrepareWAMessageMedia } = require('../../Utils/messages')
const { generateMessageIDV2: _internalGenerateMessageIDV2 } = require('../../Utils/generics')

function getGenerateWAMessageFromContent(sock) {
	if (typeof sock?.generateWAMessageFromContent === 'function') {
		return sock.generateWAMessageFromContent
	}
	return _internalGenerateWAMessageFromContent
}

function getPrepareWAMessageMedia(sock) {
	if (typeof sock?.prepareWAMessageMedia === 'function') {
		return sock.prepareWAMessageMedia
	}
	return _internalPrepareWAMessageMedia
}

function getGenerateMessageIDV2(sock) {
	if (typeof sock?.generateMessageIDV2 === 'function') {
		return sock.generateMessageIDV2
	}
	if (typeof _internalGenerateMessageIDV2 === 'function') {
		return _internalGenerateMessageIDV2
	}
	// Fallback, only reached if this package's own generics export ever
	// changes shape. A random hex ID is an acceptable substitute --
	// WhatsApp only requires message IDs to be unique, not to follow a
	// specific format.
	return () => crypto.randomBytes(16).toString('hex').toUpperCase()
}

let _sharp = null
async function getSharp() {
	if (_sharp) return _sharp
	try {
		_sharp = (await import('sharp')).default
		return _sharp
	} catch {}
	return null
}

let _ffmpeg = null
async function getFfmpeg() {
	if (_ffmpeg) return _ffmpeg
	try {
		_ffmpeg = (await import('fluent-ffmpeg')).default
		return _ffmpeg
	} catch {}
	return null
}

module.exports = {
	getGenerateWAMessageFromContent,
	getPrepareWAMessageMedia,
	getGenerateMessageIDV2,
	getSharp,
	getFfmpeg,
}
