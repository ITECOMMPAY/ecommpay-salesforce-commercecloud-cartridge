const server = require('server');
const URLUtils = require('dw/web/URLUtils');
const BasketMgr = require('dw/order/BasketMgr');
const Transaction = require('dw/system/Transaction');
const embeddedModeHelper = require('*/cartridge/scripts/ecommpay/helpers/paymentPage/embeddedModeHelper');
const checkoutHelper = require('*/cartridge/scripts/ecommpay/helpers/checkoutHelper');

server.post(
	'RedirectToPaymentPage',
	server.middleware.https,
	function (req, res, next) {
		res.redirect(req.querystring.payment_page_url, 200);
		return next();
	},
);

server.get(
	'PaymentSuccessRedirect',
	server.middleware.https,
	function (req, res, next) {
		res.render('ecommpay/postAutoRedirect', {
			redirectUrl: URLUtils.url('Order-Confirm').toString(),
			paramsJson: encodeURIComponent(JSON.stringify(req.querystring)),
		});
		return next();
	},
);

server.get(
	'PaymentRejectRedirect',
	server.middleware.https,
	function (req, res, next) {
		let query = req.querystring;
		query += '&error=1';
		res.render('ecommpay/postAutoRedirect', {
			redirectUrl: URLUtils.url('Order-Confirm').toString(),
			paramsJson: encodeURIComponent(JSON.stringify(query)),
		});
		return next();
	},
);

// Embedded mode
server.get('StartPayment', server.middleware.https, function (req, res, next) {
	const currentBasket = BasketMgr.getCurrentBasket();

	if (!currentBasket) {
		res.json({ status: 'error', errors: ['Basket is undefined'] });
		return next();
	}

	const iframeParams = embeddedModeHelper.getIframeParams(currentBasket, req);

	if (!iframeParams.payment_id) {
		res.json({ status: 'error', errors: ['Payment id is undefined'] });
		return next();
	}

	Transaction.wrap(function () {
		currentBasket.custom.ecommpayPaymentID = iframeParams.payment_id;
		currentBasket.custom.ecommpayPaymentAmount =
			currentBasket.getTotalGrossPrice().value;
		currentBasket.custom.ecommpayPaymentCurrency =
			currentBasket.getCurrencyCode();
	});

	res.json({
		status: 'success',
		iframeParams,
	});

	return next();
});

server.post(
	'EmbeddedSubmit',
	server.middleware.https,
	checkoutHelper.placeOrder,
);

module.exports = server.exports();
