const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');
const Order = require('dw/order/Order');
const PaymentTransaction = require('dw/order/PaymentTransaction');
const collections = require('*/cartridge/scripts/util/collections');
const ppURLGenerator = require('./paymentPage/paymentPageUrlGenerator');
const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const Money = require('dw/value/Money');
const PaymentMgr = require('dw/order/PaymentMgr');
const orderHelper = require('*/cartridge/scripts/ecommpay/helpers/orderHelper');
const errors = require('*/cartridge/scripts/ecommpay/classes/Errors');
const Logger = require('dw/system/Logger');

/**
 * Creates a payment transaction for the given order and payment data.
 *
 * @param {Order} order - The order object.
 * @param {Object} paymentData - The payment data object.
 * @return {dw.order.PaymentTransaction} The created payment transaction.
 */
function createPaymentTransaction(order, paymentData) {
	const currencyCode = order.getCurrencyCode();

	const lastPaymentInstrument =
		ecommpayHelper.getOrderLastPaymentInstrument(order);
	const lastPaymentMethod = lastPaymentInstrument.getPaymentMethod();
	const newAmount = new Money(
		ecommpayHelper.unFormatPrice(
			paymentData.payment.sum.amount,
			currencyCode,
		),
		currencyCode,
	);
	const newPaymentInstrument = order.createPaymentInstrument(
		lastPaymentMethod,
		newAmount,
	);
	const newPaymentTransaction = newPaymentInstrument.getPaymentTransaction();
	newPaymentTransaction.setAmount(newAmount);
	newPaymentTransaction.setPaymentProcessor(
		PaymentMgr.getPaymentMethod(lastPaymentMethod).getPaymentProcessor(),
	);
	return newPaymentTransaction;
}

/**
 * Finds a transaction based on the current order and payment data.
 *
 * @param {Order} currentOrder - The current order object.
 * @param {Object} paymentData - The payment data object.
 * @return {dw.order.PaymentTransaction|null} The found transaction object.
 */
function findOrCreateTransaction(currentOrder, paymentData) {
	const paymentInstruments = currentOrder.getPaymentInstruments();
	let currentTransaction;

	// Searching for previous transaction by transaction ID
	collections.forEach(paymentInstruments, function (paymentInstrument) {
		const paymentTransaction = paymentInstrument.getPaymentTransaction();
		if (
			paymentTransaction.transactionID === '' ||
			paymentTransaction.transactionID === paymentData.operation.id
		) {
			currentTransaction = paymentTransaction;
		}
	});

	if (!currentTransaction) {
		// Searching for previous transaction by operation type
		collections.forEach(paymentInstruments, function (paymentInstrument) {
			const paymentTransaction = paymentInstrument.getPaymentTransaction();
			if (
				paymentTransaction.custom.ecommpayOperationType ===
				paymentData.operation.type
			) {
				currentTransaction = paymentTransaction;
			}
		});
	}

	if (!currentTransaction) {
		// Create payment transaction
		currentTransaction = createPaymentTransaction(currentOrder, paymentData);
	}

	return currentTransaction;
}

/**
 * Updates the order transaction based on the payment data.
 *
 * @param {Order} currentOrder - The current order object.
 * @param {Object} paymentData - The payment data object.
 * @return {dw.order.PaymentTransaction|null} This function does not return a value.
 */
function updateOrderTransactionByPaymentData(currentOrder, paymentData) {
	const currencyCode = currentOrder.getCurrencyCode();
	const currentTransaction = findOrCreateTransaction(
		currentOrder,
		paymentData,
	);

	if (paymentData.payment.status === 'success') {
		currentTransaction.setAmount(
			new Money(
				ecommpayHelper.unFormatPrice(
					paymentData.payment.sum.amount,
					currencyCode,
				),
				currencyCode,
			),
		);
	}

	if (currentTransaction) {
		currentTransaction.setTransactionID(paymentData.operation.id);
		currentTransaction.custom.ecommpayOperationType =
			paymentData.operation.type;
		currentTransaction.custom.ecommpayOperationStatus =
			paymentData.operation.status;

		const operationTypeMap = {
			sale: PaymentTransaction.TYPE_CREDIT,
			refund: PaymentTransaction.TYPE_CREDIT,
			auth: PaymentTransaction.TYPE_AUTH,
			capture: PaymentTransaction.TYPE_CAPTURE,
			cancel: PaymentTransaction.TYPE_AUTH_REVERSAL,
		};
		const operationType = operationTypeMap[paymentData.operation.type];

		if (operationType) {
			currentTransaction.setType(operationType);
		}
	}

	return currentTransaction;
}

/**
 * Handles the payment information.
 *
 * @param {Object} callbackArray - The payment data.
 * @return {undefined}
 */
exports.handlePaymentCallback = function (callbackArray) {
	const isSignatureValid = ppURLGenerator.isRequestSignatureValid(
		callbackArray,
		ecommpayHelper.getProjectSaltToken(),
	);

	if (!isSignatureValid) {
		throw errors.SignatureIsInvalidError;
	}

	if (!callbackArray.payment || !callbackArray.operation) {
		throw errors.InvalidPaymentDataError;
	}

	Logger.debug(callbackArray);

	const currentOrder = OrderMgr.searchOrders(
		'custom.ecommpayPaymentID={0}',
		'creationDate desc',
		callbackArray.payment.id,
	).first();

	if (!currentOrder) {
		ecommpayHelper.throwError(
			`Error in handlePaymentCallback. Cannot find order with id ${callbackArray.payment.id}!`,
		);
	}

	Transaction.wrap(function () {
		// Writing ecommpay data to the order
		currentOrder.externalOrderStatus = callbackArray.payment.status;
		currentOrder.custom.ecommpayPaymentStatus = callbackArray.payment.status;
		currentOrder.custom.ecommpayOperationType = callbackArray.operation.type;
		currentOrder.custom.ecommpayPaymentMethod = callbackArray.payment.method;

		const updatedTransaction = updateOrderTransactionByPaymentData(
			currentOrder,
			callbackArray,
		);

		const currencyCode = updatedTransaction.amount.currencyCode;
		const paymentAmount = updatedTransaction.amount.value;
		const paymentString = `${currencyCode} ${paymentAmount}`;

		// Start resetting refund and capture buttons if any errors
		const reloadOperationErrorStatuses = [
			'decline',
			'external error',
			'internal error',
		];

		if (
			['refund', 'reversal'].includes(callbackArray.operation.type) &&
			reloadOperationErrorStatuses.includes(callbackArray.operation.status)
		) {
			currentOrder.custom.ecommpayActionRefund = false;
		}

		if (
			['capture', 'cancel'].includes(callbackArray.operation.type) &&
			reloadOperationErrorStatuses.includes(callbackArray.operation.status)
		) {
			currentOrder.custom.ecommpayActionCapture = false;
		}
		// End resetting refund and capture buttons if any errors

		// Start resetting refund button after partially refunded
		if (
			callbackArray.operation.type === 'refund' &&
			callbackArray.operation.status === 'success' &&
			callbackArray.payment.status === 'partially refunded'
		) {
			currentOrder.custom.ecommpayActionRefund = false;
		}
		//  Start resetting refund button after partially refunded

		if (callbackArray.operation.type === 'capture') {
			if (
				callbackArray.operation.status === 'success' &&
				callbackArray.operation.sum_initial &&
				callbackArray.payment.sum
			) {
				if (
					ecommpayHelper.formatPrice(
						parseFloat(currentOrder.getTotalGrossPrice().value),
						currentOrder.getCurrencyCode(),
					) <= parseFloat(callbackArray.payment.sum.amount)
				) {
					orderHelper.addNotification(
						currentOrder,
						'Payment captured',
						`A payment of ${paymentString} was successfully captured.`,
					);
				} else {
					orderHelper.addNotification(
						currentOrder,
						'Payment captured',
						`A payment of ${paymentString} was successfully captured. The rest is returned to the payer.`,
					);
				}
			}
		}

		switch (callbackArray.payment.status) {
			// Success statuses
			case 'success':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
				OrderMgr.placeOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Order Placed',
					'The order is finally paid and ready to delivery!',
				);
				break;
			case 'awaiting confirmation':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
				OrderMgr.placeOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Order Awaiting Confirmation',
					'The order is awaiting confirmation',
				);
				break;
			// Unsuccessful statuses
			case 'decline':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
				OrderMgr.failOrder(currentOrder, false);
				orderHelper.addNotification(
					currentOrder,
					'Payment decline',
					`Payment was decline. Message: ${callbackArray.operation.message}.`,
				);
				break;
			case 'external error':
			case 'internal error':
			case 'awaiting customer':
			case 'expired':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
				OrderMgr.failOrder(currentOrder, false);
				orderHelper.addNotification(
					currentOrder,
					'Payment failed',
					`Payment failed to be processed by ecommpay. Reason: ${callbackArray.operation.message}.`,
				);
				break;
			// Refund statuses
			case 'refunded':
				OrderMgr.cancelOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Payment Refunded',
					'The payment is refunded!',
				);
				break;
			case 'reversed':
				OrderMgr.cancelOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Payment Reversed',
					'The payment is reversed!',
				);
				break;
			case 'canceled':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
				OrderMgr.placeOrder(currentOrder);
				OrderMgr.cancelOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Payment cancelled',
					`Payment authorization of ${paymentString} was successfully cancelled.`,
				);
				break;
			case 'awaiting capture':
				orderHelper.addNotification(
					currentOrder,
					'Payment authorized',
					`A payment of ${paymentString} was authorized`,
				);
				break;
			// Not final statuses
			default:
				break;
		}
	});
};
