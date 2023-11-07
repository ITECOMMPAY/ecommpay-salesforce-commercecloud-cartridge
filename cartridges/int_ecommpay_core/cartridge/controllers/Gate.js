const server = require('server');
const Logger = require('dw/system/Logger');
const gateHelper = require('*/cartridge/scripts/ecommpay/helpers/gateHelper');
const errors = require('*/cartridge/scripts/ecommpay/classes/Errors');

server.post('Receive', server.middleware.https, function (req, res, next) {
	Logger.debug('Received Ecommpay Payment:');

	const paymentDataJson = req.httpParameterMap.requestBodyAsString;
	Logger.debug(paymentDataJson);

	let callbackArray;

	try {
		callbackArray = JSON.parse(paymentDataJson);
	} catch (e) {
		res.json({
			message: "Couldn't prepare body (Bad json). " + e.message,
		});
		res.setStatusCode(400);
		return next();
	}

	try {
		gateHelper.handlePaymentCallback(callbackArray);
	} catch (error) {
		Logger.error(error.message);
		res.json({
			message: "Couldn't handle payment. " + error.message,
		});
		if (error === errors.SignatureIsInvalidError) {
			res.setStatusCode(403);
		} else if (error === errors.InvalidPaymentDataError) {
			res.setStatusCode(400);
		} else {
			res.setStatusCode(500);
		}
		return next();
	}

	res.json({
		message: 'Ok',
	});
	res.setStatusCode(200);
	return next();
});

module.exports = server.exports();
