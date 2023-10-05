'use strict';

const Site = require('dw/system/Site');
const Locale = require('dw/util/Locale');
const PaymentMgr = require('dw/order/PaymentMgr');
const UrlUtils = require('dw/web/URLUtils');
const Logger = require('dw/system/Logger');

const NON_DECIMAL_CURRENCIES = [
	'BIF',
	'CLP',
	'DJF',
	'GNF',
	'ISK',
	'JPY',
	'KMF',
	'KRW',
	'PYG',
	'RWF',
	'UGX',
	'UYI',
	'VND',
	'VUV',
	'XAF',
	'XOF',
	'XPF',
];

/**
 * Retrieves the custom site preference object for the given name.
 * @param {string} name - The name of the custom site preference.
 * @return {*} returns ANY FORMAT of preferences, can be different from each other.
 * Depends on a type of preference.
 */
function getCustomSitePreference(name) {
	return Site.getCurrent().getCustomPreferenceValue(name);
}

/**
 * Checks if Ecommpay integration is enabled.
 * @return {boolean} - True if site preference is set to true.
 */
function isEcommpayEnabled() {
	return getCustomSitePreference('isEcommpayEnabled');
}

exports.isEcommpayEnabled = isEcommpayEnabled;

/**
 * Returns Ecommpay plugin version
 * @returns {string} Version
 */
exports.getPluginVersion = function () {
	return '1.0';
};

/**
 * Return interface type ID.
 * @returns {number} ID of internal Ecommpay interface.
 */
exports.getPPInterfaceTypeID = function () {
	return 32;
};

/**
 * Get Ecommpay Payment Window type
 *
 * @return {Object} - PM Window type
 */
exports.getEcommpayCardDisplayMode = function () {
	return getCustomSitePreference('ecommpayСardDisplayMode').value;
};

exports.getPaymentPageHost = function () {
	return 'https://paymentpage.ecommpay.com';
};

exports.getProjectID = function () {
	return Number(getCustomSitePreference('ecommpayProjectId'));
};

exports.getProjectSaltToken = function () {
	return getCustomSitePreference('ecommpaySecretKey');
};

/**
 * Converts an object into a query string.
 *
 * @param {Object} obj - The object to convert.
 * @return {string} The generated query string.
 */
exports.objectToQueryString = function (obj) {
	return Object.keys(obj)
		.map(
			(key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`,
		)
		.join('&');
};

/**
 * Filters out keys in an object that start with an underscore
 * and returns a new object.
 *
 * @param {Object} obj - The input object.
 * @return {Object} The new object with the filtered keys.
 */
exports.excludeUnderscoreKeys = function (obj) {
	return Object.keys(obj).reduce((newObj, key) => {
		if (!key.startsWith('_')) {
			newObj[key] = obj[key];
		}
		return newObj;
	}, {});
};

/**
 * Filters out empty values from an object.
 *
 * @param {Object} obj - The object to filter.
 * @return {Object} The filtered object.
 */
exports.excludeEmptyValues = function (obj) {
	return Object.keys(obj).reduce((filteredObj, key) => {
		const value = obj[key];
		if (value !== undefined && value !== '' && value !== null) {
			filteredObj[key] = value;
		}
		return filteredObj;
	}, {});
};

/**
 * Formats the price based on the specified currency.
 *
 * @param {number} price - The price to be formatted.
 * @param {string} [currency='EUR'] - The currency to be used for formatting the price. Defaults to 'EUR'.
 * @return {number} The formatted price.
 */
exports.formatPrice = function (price, currency) {
	currency = currency || 'EUR';

	if (NON_DECIMAL_CURRENCIES.includes(currency)) {
		return Math.round(price);
	} else {
		return Math.round(price * 100);
	}
};

/**
 * Un-formats the given price based on the currency.
 *
 * @param {number} price - The price to be unformatted.
 * @param {string} [currency='EUR'] - The currency used for unformatting. Defaults to 'EUR'.
 * @return {number} The unformatted price.
 */
exports.unFormatPrice = function (price, currency) {
	currency = currency || 'EUR';
	return NON_DECIMAL_CURRENCIES.includes(currency) ? price : price / 100;
};

/**
 * Get locale from request
 * @param {sfra.Request} req Request
 * @returns {Locale} Locale
 */
exports.getLocaleFromRequest = function (req) {
	if (req.locale.id === 'default') {
		return Locale.getLocale(Site.getCurrent().getDefaultLocale());
	}

	return Locale.getLocale(req.locale.id);
};

/**
 * Get payment processor from payment method ID
 * @param {string} methodID Payment method ID
 * @returns {dw.order.PaymentProcessor} Payment processor
 */
function getPaymentProcessorFromPaymentMethodID(methodID) {
	const method = PaymentMgr.getPaymentMethod(methodID);
	return method.getPaymentProcessor();
}

exports.getPaymentProcessorFromPaymentMethodID =
	getPaymentProcessorFromPaymentMethodID;

/**
 * Retrieves the last payment instrument used for a given order.
 *
 * @param {dw.order.Order} order - The order object.
 * @return {dw.order.PaymentInstrument} The last payment instrument used for the order.
 */
function getOrderLastPaymentInstrument(order) {
	const instruments = order.getPaymentInstruments();
	if (instruments.length > 0) {
		return instruments[instruments.length - 1];
	} else {
		return null;
	}
}

exports.getOrderLastPaymentInstrument = getOrderLastPaymentInstrument;

/**
 * Returns the icon for a given payment method.
 *
 * @param {string} pmName - The name of the payment method.
 * @return {string} The icon for the payment method.
 */
exports.getPaymentMethodIcon = function (pmName) {
	let url;
	switch (pmName) {
		case 'CREDIT_CARD':
			url = '/images/credit.png';
			break;
		default:
			url = '/images/ecommpay/payment_methods/' + pmName + '.svg';
			break;
	}
	return UrlUtils.staticURL(url).toString();
};

/**
 * Determines if the payment method should be shown.
 *
 * @param {string} paymentMethodID - The ID of the payment method.
 * @return {boolean} Returns true if the payment method should be shown, false otherwise.
 */
function shouldShowPaymentMethod(paymentMethodID) {
	const paymentProcessor =
		getPaymentProcessorFromPaymentMethodID(paymentMethodID);
	return !(
		!isEcommpayEnabled() &&
		['ECOMMPAY_CREDIT', 'ECOMMPAY_APM'].includes(paymentProcessor.getID())
	);
}

exports.shouldShowPaymentMethod = shouldShowPaymentMethod;

/**
 * Throws an error.
 * Logs a custom error message.
 * @param {string} message - The error message to be logged and thrown.
 * @return {void} This function does not return a value.
 */
function throwError(message) {
	Logger.error(message);
	throw new Error(message);
}

exports.throwError = throwError;
