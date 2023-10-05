'use strict';

const Transaction = require('dw/system/Transaction');
const Logger = require('dw/system/Logger');
const ecommpayCheckoutHelper = require('*/cartridge/scripts/ecommpay/helpers/checkoutHelper');

/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createToken() {
	return Math.random().toString(36).substr(2);
}

exports.createToken = createToken;

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
	const viewData = viewFormData;

	viewData.paymentMethod = {
		value: paymentForm.paymentMethod.value,
		htmlName: paymentForm.paymentMethod.value,
	};

	return {
		error: false,
		viewData: viewData,
	};
}

exports.processForm = processForm;

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current user's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation) {
	const paramsMap = request.httpParameterMap;
	let paymentMethod = paramsMap.get('dwfrm_billing_paymentMethod').value;

	if (!paymentMethod) {
		paymentMethod = paramsMap.get(
			'dwfrm_billing_paymentMethods_selectedPaymentMethodID',
		).value;
	}

	try {
		Transaction.begin();
		ecommpayCheckoutHelper.createEcommpayPaymentInstrument(
			basket,
			paymentMethod,
		);
		Transaction.commit();
		return {
			fieldErrors: [],
			serverErrors: [],
			error: false,
			success: true,
		};
	} catch (e) {
		Transaction.rollback();
		Logger.error(e.message);
		return {
			success: false,
			error: true,
			errorMessage: e.message,
		};
	}
}

exports.Handle = Handle;

/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
	Transaction.wrap(function () {
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
	});

	return {
		fieldErrors: [],
		serverErrors: [],
		error: false,
	};
}

exports.Authorize = Authorize;

/**
 * Save the credit card information to log in an account
 * if a save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) {
	// We don't want to save payment info.
}

exports.savePaymentInformation = savePaymentInformation;
