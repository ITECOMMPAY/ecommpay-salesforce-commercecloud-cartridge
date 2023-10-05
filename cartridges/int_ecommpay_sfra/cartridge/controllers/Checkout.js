/**
 * @namespace Checkout
 */
const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const URLUtils = require('dw/web/URLUtils');
const server = require('server');

server.extend(module.superModule);

server.prepend('Begin', server.middleware.https, function (req, res, next) {
	if (
		ecommpayHelper.getEcommpayCardDisplayMode() === 'ECOMMPAY_EMBEDDED' &&
		req.querystring.stage === 'placeOrder'
	) {
		res.redirect(
			URLUtils.url('Checkout-Begin', 'stage', 'payment').toString(),
		);
	}
	next();
});

module.exports = server.exports();
