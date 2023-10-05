const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const URLUtils = require('dw/web/URLUtils');
const ppURLGenerator = require('./paymentPageUrlGenerator');
const stringsHelper = require('*/cartridge/scripts/ecommpay/helpers/stringsHelper');

/**
 * Generates the parameters required for an iframe request.
 *
 * @param {Object} currentBasket - The current basket object.
 * @param {Object} req - The request object.
 * @return {Object} - The parameters for the iframe request.
 */
exports.getIframeParams = function (currentBasket, req) {
	// Parameters block
	const requiredParams = {
		project_id: ecommpayHelper.getProjectID(),
		payment_id: 'sfcc_' + stringsHelper.generateRandomString(43),
		payment_currency: currentBasket.getCurrencyCode(),
		payment_amount: ecommpayHelper.formatPrice(
			currentBasket.getTotalGrossPrice().value,
			currentBasket.getCurrencyCode(),
		),
		merchant_callback_url: URLUtils.abs('Gate-Receive').toString(),
		mode: 'purchase',
		card_operation_type: 'sale',
		force_payment_method: 'card',
		payment_methods_options: JSON.stringify({
			additional_data: {
				embedded_mode: true,
			},
		}),
		_plugin_version: ecommpayHelper.getPluginVersion(),
		target_element: 'ecommpay-embedded-iframe',
	};

	requiredParams.interface_type = JSON.stringify({
		id: ecommpayHelper.getPPInterfaceTypeID(),
	});

	let unRequiredParams = {};

	unRequiredParams.language_code = ecommpayHelper
		.getLocaleFromRequest(req)
		.getLanguage();
	if (!currentBasket.customer.anonymous) {
		unRequiredParams.customer_id = currentBasket.getCustomerNo();
	}
	unRequiredParams = ecommpayHelper.excludeEmptyValues(unRequiredParams);

	const paymentPageParams = Object.assign(requiredParams, unRequiredParams);

	const signature = ppURLGenerator.createSignature(
		paymentPageParams,
		ecommpayHelper.getProjectSaltToken(),
	);

	return Object.assign({ signature }, paymentPageParams);
};
