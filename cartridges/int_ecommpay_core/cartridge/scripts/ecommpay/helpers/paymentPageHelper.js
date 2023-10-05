const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper.js');
const collections = require('*/cartridge/scripts/util/collections');
const URLUtils = require('dw/web/URLUtils');
const ppURLGenerator = require('./paymentPage/paymentPageUrlGenerator');
const PaymentMgr = require('dw/order/PaymentMgr');

/**
 * Create redirect mode parameters
 * @param {dw.order.Order} currentOrder Current order
 * @param {sfra.Request} req Request
 * @param {string} mode PP Mode redirect|embedded
 * @returns {Object} Parameters
 */
function createPaymentPageParameters(currentOrder, req, mode) {
	const requiredParams = {
		payment_id: currentOrder.custom.ecommpayPaymentID,
		payment_currency: currentOrder.getCurrencyCode(),
		payment_amount: ecommpayHelper.formatPrice(
			currentOrder.getTotalGrossPrice().value,
			currentOrder.getCurrencyCode(),
		),
		merchant_callback_url: URLUtils.abs('Gate-Receive').toString(),
		redirect_success_url: URLUtils.abs(
			'Ecommpay-PaymentSuccessRedirect',
			'orderID',
			currentOrder.orderNo,
			'orderToken',
			currentOrder.orderToken,
		).toString(),
		merchant_fail_url: URLUtils.abs(
			'Ecommpay-PaymentRejectRedirect',
			'orderID',
			currentOrder.orderNo,
			'orderToken',
			currentOrder.orderToken,
		).toString(),
	};
	if (mode === 'embedded') {
		requiredParams.redirect_success_enabled = 2;
		requiredParams.redirect_success_mode = 'parent_page';
		requiredParams.redirect_fail_enabled = 2;
		requiredParams.redirect_fail_mode = 'parent_page';
	}

	let unRequiredParams = {};
	unRequiredParams.mode = 'purchase';
	unRequiredParams.language_code = ecommpayHelper
		.getLocaleFromRequest(req)
		.getLanguage();
	if (!currentOrder.customer.anonymous) {
		unRequiredParams.customer_id = currentOrder.custom.ecommpayCustomerID;
	}
	unRequiredParams.receipt_data =
		ppURLGenerator.createEncodedReceiptDataFromOrder(currentOrder);
	unRequiredParams.payment_description = currentOrder.orderNo;
	unRequiredParams._plugin_version = ecommpayHelper.getPluginVersion();
	unRequiredParams._referrer = URLUtils.abs(
		'CheckoutServices-PlaceOrder',
	).toString();

	const addressString = [
		currentOrder.billingAddress.getAddress1(),
		currentOrder.billingAddress.getAddress2(),
	].join(' ');

	if (currentOrder.billingAddress) {
		if (mode === 'embedded') {
			unRequiredParams['AVS[avs_post_code]'] =
				currentOrder.billingAddress.postalCode;
			unRequiredParams['AVS[avs_street_address]'] = addressString;
			unRequiredParams['BillingInfo[customer_first_name]'] =
				currentOrder.billingAddress.firstName;
			unRequiredParams['BillingInfo[customer_last_name]'] =
				currentOrder.billingAddress.lastName;
			unRequiredParams['BillingInfo[customer_phone]'] =
				currentOrder.billingAddress.phone;
			unRequiredParams['BillingInfo[billing_postal]'] =
				currentOrder.billingAddress.postalCode;
			unRequiredParams['BillingInfo[customer_email]'] =
				currentOrder.customerEmail;
			unRequiredParams['BillingInfo[billing_address]'] = addressString;
			unRequiredParams['BillingInfo[billing_city]'] =
				currentOrder.billingAddress.city;
			unRequiredParams['BillingInfo[billing_country]'] =
				currentOrder.billingAddress.countryCode.getValue();
			unRequiredParams['BillingInfo[billing_region]'] =
				currentOrder.billingAddress.stateCode;
		} else if (mode === 'redirect') {
			unRequiredParams.avs_post_code =
				currentOrder.billingAddress.postalCode;
			unRequiredParams.avs_street_address = addressString;
			unRequiredParams.customer_first_name =
				currentOrder.billingAddress.firstName;
			unRequiredParams.customer_last_name =
				currentOrder.billingAddress.lastName;
			unRequiredParams.customer_phone = currentOrder.billingAddress.phone;
			unRequiredParams.billing_postal =
				currentOrder.billingAddress.postalCode;
			unRequiredParams.customer_email = currentOrder.customerEmail;
			unRequiredParams.billing_address = addressString;
			unRequiredParams.billing_city = currentOrder.billingAddress.city;
			unRequiredParams.billing_country =
				currentOrder.billingAddress.countryCode.getValue();
			unRequiredParams.billing_region =
				currentOrder.billingAddress.stateCode;
		}
	}

	unRequiredParams = ecommpayHelper.excludeEmptyValues(unRequiredParams);

	const paymentPageParameters = Object.assign(
		requiredParams,
		unRequiredParams,
	);

	const paymentInstruments = currentOrder.getPaymentInstruments();

	collections.forEach(paymentInstruments, function (paymentInstrument) {
		const paymentMethodID = paymentInstrument.getPaymentMethod();
		const paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodID);
		if (!paymentMethod) return;

		const paymentProcessor = paymentMethod.getPaymentProcessor();
		const paymentProcessorID = paymentProcessor.getID();

		if (paymentProcessorID === 'ECOMMPAY_CREDIT') {
			paymentPageParameters.force_payment_method = 'card';
		}

		switch (paymentMethodID) {
			case 'ECOMMPAY_GOOGLEPAY': {
				paymentPageParameters.force_payment_method = 'google_pay_host';
				break;
			}
			case 'ECOMMPAY_APPLEPAY': {
				paymentPageParameters.force_payment_method = 'apple_pay_core';
				break;
			}
			case 'ECOMMPAY_OPEN_BANKING': {
				paymentPageParameters.force_payment_group = 'openbanking';
				break;
			}
			default:
				break;
		}
	});

	return paymentPageParameters;
}

exports.createPaymentPageParameters = createPaymentPageParameters;
