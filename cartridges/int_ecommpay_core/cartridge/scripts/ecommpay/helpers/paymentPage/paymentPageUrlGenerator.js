const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const Mac = require('dw/crypto/Mac');
const Encoding = require('dw/crypto/Encoding');
const StringUtils = require('dw/util/StringUtils');
const Logger = require('dw/system/Logger');

/**
 * Reduces an input object to a string with a specific format.
 *
 * @param {Object} inputObj - The input object to be reduced.
 * @param {string} prefix - The prefix string to be added to each property.
 * @param {array} ignored -
 * An array of properties to be ignored during reduction.
 * @return {string} The reduced string.
 */
function reducer(inputObj, prefix, ignored) {
	prefix = prefix || '';
	ignored = ignored || [];

	const ordered = {};

	Object.keys(inputObj)
		.sort()
		.forEach((key) => {
			if (ignored.indexOf(key) === -1) {
				ordered[key] = inputObj[key];
			}
		});

	return Object.entries(ordered).reduce((acc, [prop, value]) => {
		if (value === null) {
			value = '';
		}
		if (typeof value === 'object') {
			return (
				acc + reducer(value, prefix ? `${prefix}:${prop}` : prop, ignored)
			);
		}
		if (typeof value === typeof true) value = value ? 1 : 0;
		return (
			acc + (prefix ? `${prefix}:${prop}:${value};` : `${prop}:${value};`)
		);
	}, '');
}

/**
 * Converts an object into a string representation by applying a reducer function.
 *
 * @param {Object} obj - The object to be converted.
 * @param {Array} ignored - An optional array of properties to be ignored during conversion.
 * @return {string} The converted string representation of the object.
 */
function converter(obj, ignored) {
	ignored = ignored || [];
	const reducerRes = reducer(obj, '', ignored);
	return reducerRes.slice(0, -1);
}

const ignored = ['frame_mode'];

/**
 * Generates a signed string using the provided object and salt.
 *
 * @param {Object} obj - The object to be signed.
 * @param {string} salt - The salt to be used for signing.
 * @return {string} The signed string in Base64 encoding.
 */
const signer = (obj, salt) => {
	const macObj = new Mac(Mac.HMAC_SHA_512);
	const bytes = macObj.digest(converter(obj, ignored), salt);
	return Encoding.toBase64(bytes);
};

/**
 * Creates a signature using the given parameters and salt.
 *
 * @param {Object} params - The parameters to create the signature with.
 * @param {string} salt - The salt to use for the signature.
 * @return {string} The created signature.
 */
function createSignature(params, salt) {
	const toSignParams = ecommpayHelper.excludeUnderscoreKeys(params);
	return signer(toSignParams, salt);
}

exports.createSignature = createSignature;

/**
 * Generates a URL with parameters for the payment page.
 *
 * @param {string} projectId - The ID of the project.
 * @param {string} salt - The salt used for creating the signature.
 * @param {Object} additionalParams - Additional parameters to include in the URL.
 * @return {string} The generated URL with parameters.
 */
exports.generate = (projectId, salt, additionalParams) => {
	let myUrlWithParams = ecommpayHelper.getPaymentPageHost() + '/payment';

	const startParams = { project_id: projectId };

	startParams.interface_type = JSON.stringify({
		id: ecommpayHelper.getPPInterfaceTypeID(),
	});

	const params = Object.assign({}, startParams, additionalParams);
	const queryString = ecommpayHelper.objectToQueryString(params);
	myUrlWithParams += '?' + queryString;
	const signature = encodeURIComponent(createSignature(params, salt));
	myUrlWithParams += '&signature=' + signature;

	return myUrlWithParams;
};

/**
 * Generates base64 encoded receipt data from the given order.
 *
 * @param {Object} order - The order object containing product line items and currency information.
 * @return {string} The base64 encoded receipt data.
 */
exports.createEncodedReceiptDataFromOrder = function (order) {
	const productLineItems = order.getProductLineItems();
	const positions = [];

	let orderTaxPercent = 0;
	let orderTaxValue = 0;
	let orderTotalAmount = 0;
	const currency = order.getCurrencyCode();

	// Iterate through the product line items to extract product information
	for (let i = 0; i < productLineItems.length; i++) {
		const productLineItem = productLineItems[i];
		const taxValue = Number(productLineItem.getTax().getValue());
		const priceValue = Number(productLineItem.adjustedGrossPrice.value);
		const product = {
			quantity: Number(productLineItem.quantity.value.toFixed(6)), // 3 items
			amount: ecommpayHelper.formatPrice(priceValue, currency), // $10000
			tax: Number(((taxValue / priceValue) * 100).toFixed(2)), // 18%
			tax_amount: ecommpayHelper.formatPrice(taxValue, currency), // $1800
			description: productLineItem.productName.slice(0, 254).trim(),
		};
		orderTaxPercent += product.tax;
		orderTaxValue += product.tax_amount;
		orderTotalAmount += product.amount;
		positions.push(product);
		if (i >= 254) break;
	}

	const receiptData = {
		positions,
		total_tax_amount: Number(orderTaxValue), // $1800
		common_tax: Number(((orderTaxValue / orderTotalAmount) * 100).toFixed(2)), // 18%
	};

	return StringUtils.encodeBase64(JSON.stringify(receiptData));
};

/**
 * Checks if the request signature is valid.
 *
 * @param {Object} requestBody - The request body object.
 * @param {string} salt - The salt used for signing the request.
 * @return {boolean} Returns true if the request signature is valid, otherwise false.
 */
exports.isRequestSignatureValid = function (requestBody, salt) {
	let isValid = false;

	try {
		const signature = requestBody.signature;
		delete requestBody.signature;
		isValid = signer(requestBody, salt) === signature;
	} catch (error) {
		Logger.error('Validating signature error: ' + error.message);
	}

	return isValid;
};
