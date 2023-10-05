/**
 * @namespace CheckoutServices
 */

const checkoutHelper = require('*/cartridge/scripts/ecommpay/helpers/checkoutHelper');
const server = require('server');

server.extend(module.superModule);

server.prepend(
	'PlaceOrder',
	server.middleware.https,
	checkoutHelper.placeOrder,
);

module.exports = server.exports();
