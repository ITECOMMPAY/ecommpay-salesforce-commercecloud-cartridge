'use strict';

const server = require('server');
const gateRequestSender = require('*/cartridge/scripts/ecommpay/gate/gateRequestSender');
const OrderMgr = require('dw/order/OrderMgr');
const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const Transaction = require('dw/system/Transaction');

server.post('OrderAction', server.middleware.https, function (req, res, next) {
	try {
		const actionAmount = req.querystring.actionAmount
			? parseFloat(req.querystring.actionAmount)
			: null;
		const paymentID = req.querystring.paymentID;
		const actionType = req.querystring.actionType;
		const currentOrder = OrderMgr.searchOrders(
			'custom.ecommpayPaymentID={0}',
			'creationDate desc',
			paymentID,
		).first();

		if (!currentOrder) {
			ecommpayHelper.throwError(
				`Endpoint: OrderAction. Cannot find order with id ${paymentID}!`,
			);
		}

		const currencyCode = currentOrder.getCurrencyCode();

		const orderAmount = ecommpayHelper.formatPrice(
			currentOrder.getTotalGrossPrice().value,
			currencyCode,
		);

		const formattedActionAmount = ecommpayHelper.formatPrice(
			actionAmount,
			currencyCode,
		);

		if (
			formattedActionAmount !== null &&
			(actionAmount <= 0 || formattedActionAmount > orderAmount)
		) {
			ecommpayHelper.throwError(
				`Invalid ${actionType} amount ${actionAmount}! The ${actionType} amount cannot be more than the payment amount.`,
			);
		}

		const sendRequestArray = {
			payment_id: paymentID,
			currency: currencyCode,
			description: currentOrder.custom.ecommpayCustomerID,
			type: actionType,
			method: 'POST',
			paymentMethod: req.querystring.paymentMethod,
		};

		if (formattedActionAmount !== null) {
			sendRequestArray.amount = formattedActionAmount;
		}

		const result = gateRequestSender.sendActionRequest(sendRequestArray);

		Transaction.wrap(function () {
			if (actionType === 'capture' || actionType === 'cancel') {
				currentOrder.custom.ecommpayActionCapture = true;
			} else if (actionType === 'refund') {
				currentOrder.custom.ecommpayActionRefund = true;
			}
		});

		res.json({
			status: 'ok',
			result,
		});
		res.setStatusCode(200);
	} catch (error) {
		res.json({
			status: 'error',
			error: error.message,
			trace: error.stack,
		});
		res.setStatusCode(500);
	}

	return next();
});

server.get('PaymentStatus', server.middleware.https, function (req, res, next) {
	try {
		const paymentID = req.querystring.paymentID;

		if (!paymentID) {
			throw new Error('Missing payment ID');
		}

		const order = OrderMgr.searchOrders(
			'custom.ecommpayPaymentID={0}',
			'creationDate desc',
			paymentID,
		).first();

		if (!order) {
			ecommpayHelper.throwError(
				'Endpoint: PaymentStatus. Cannot find order with id ' + paymentID,
			);
		}

		res.json({
			status: 'success',
			payment_status: order.custom.ecommpayPaymentStatus,
		});
		res.setStatusCode(200);
	} catch (error) {
		res.json({
			status: 'error',
			error: error.message,
			trace: error.stack,
		});
		res.setStatusCode(500);
	}

	return next();
});

module.exports = server.exports();
