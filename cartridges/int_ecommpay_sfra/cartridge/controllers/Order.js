/**
 * @namespace Order
 */
const server = require('server');
const Resource = require('dw/web/Resource');

server.extend(module.superModule);
server.post('Reject', server.middleware.https, function (req, res, next) {
	res.render('/ecommpay/failOrder', {
		message: Resource.msg('error.confirmation.error', 'confirmation', null),
		error_message: ' Your payment was declined, please try again.',
	});
	return next();
});

module.exports = server.exports();
