const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const gateService = require('*/cartridge/scripts/ecommpay/services/ecommpayService');
const ppURLGenerator = require('*/cartridge/scripts/ecommpay/helpers/paymentPage/paymentPageUrlGenerator');
const helpersBM = require('*/cartridge/scripts/ecommpay/helpers/helpersBM');

/**
 * Sends a refund request.
 *
 * @param {Object} requestArray - The data for the refund.
 * @return {Promise} - A promise that resolves with the result of the refund request.
 */
exports.sendActionRequest = function (requestArray) {
	const requestJson = {
		general: {
			project_id: ecommpayHelper.getProjectID(),
			payment_id: requestArray.payment_id,
			merchant_callback_url: helpersBM.getSelectedSiteCallbackURL(),
		},
		payment: {
			currency: requestArray.currency,
		},
		interface_type: {
			id: ecommpayHelper.getPPInterfaceTypeID(),
		},
	};

	if (requestArray.amount) {
		requestJson.payment.amount = requestArray.amount;
	}

	if (requestArray.type === 'refund') {
		requestJson.payment.description = requestArray.description;
	}

	const token = ecommpayHelper.getProjectSaltToken();
	requestJson.general.signature = ppURLGenerator.createSignature(
		requestJson,
		token,
	);

	const paymentMethod = requestArray.paymentMethod || null;

	if (
		['capture', 'cancel'].includes(requestArray.type) &&
		typeof paymentMethod !== 'string'
	) {
		ecommpayHelper.throwError('Missing payment method!');
	}

	let paymentMethodEndpoint = paymentMethod;

	const paymentMethodEndpointMap = {
		etoken: 'applepay',
		'etoken-google': 'googlepay',
	};

	if (paymentMethodEndpointMap[paymentMethod]) {
		paymentMethodEndpoint = paymentMethodEndpointMap[paymentMethod];
	}

	const actionEndpointMap = {
		refund: '/payment/refund',
		capture: `/payment/${paymentMethodEndpoint}/capture`,
		cancel: `/payment/${paymentMethodEndpoint}/cancel`,
	};

	const endpoint = actionEndpointMap[requestArray.type];

	if (!endpoint) {
		ecommpayHelper.throwError(`Invalid action type: ${requestArray.type}!`);
	}

	return gateService.callService('GATE', {
		endpoint,
		httpMethod: requestArray.method || 'POST',
		json: requestJson,
	});
};
