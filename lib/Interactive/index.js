// index.js
// Barrel export for keithbaileys' Interactive module: button builders
// (classic buttonsMessage, native-flow interactiveMessage, In-App Signup)
// and the AIRich bot-response builder. Originally developed as the
// standalone `keithbtn` package; merged directly into keithbaileys so
// there's a single package to install.

'use strict'

const { btn } = require('./btn')
const { isIOSDevice } = require('./isIOSDevice')
const { sendButtons, sendInteractiveMessage } = require('./sendButtons')
const { sendButtonsSafe } = require('./sendButtonsSafe')
const { sendInappSignup } = require('./sendInappSignup')
const { sendButtonV2, ButtonV2 } = require('./sendButtonV2')
const { sendAIRich, createAIRich } = require('./sendAIRich')
const { AIRich } = require('./ai-rich/airich')
const { Toolkit: AIRichToolkit } = require('./ai-rich/toolkit')
const { BaseBuilder: AIRichBaseBuilder } = require('./ai-rich/base-builder')
const {
	AIRichError,
	ItemNotFoundError,
	DuplicateIdError,
	InvalidTargetError,
	ContentValidationError,
} = require('./ai-rich/errors')

module.exports = {
	btn,
	isIOSDevice,
	sendButtons,
	sendInteractiveMessage,
	sendButtonsSafe,
	sendInappSignup,
	sendButtonV2,
	ButtonV2,
	sendAIRich,
	createAIRich,
	AIRich,
	AIRichToolkit,
	AIRichBaseBuilder,
	AIRichError,
	ItemNotFoundError,
	DuplicateIdError,
	InvalidTargetError,
	ContentValidationError,
}
