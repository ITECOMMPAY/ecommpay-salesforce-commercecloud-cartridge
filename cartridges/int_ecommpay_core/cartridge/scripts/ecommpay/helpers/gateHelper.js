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

/**
 * Creates a payment transaction for the given order and payment data.
 *
 * @param {Order} order - The order object.
 * @param {Object} paymentData - The payment data object.
 * @return {PaymentTransaction} The created payment transaction.
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
 * @param {Object} currentOrder - The current order object.
 * @param {Object} paymentData - The payment data object.
 * @return {Object} The found transaction object.
 */
function findTransaction(currentOrder, paymentData) {
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
		currentTransaction = paymentInstruments[0].getPaymentTransaction();
	}

	return currentTransaction;
}

/**
 * Updates the order transaction based on the payment data.
 *
 * @param {Order} currentOrder - The current order object.
 * @param {Object} paymentData - The payment data object.
 * @return {undefined} This function does not return a value.
 */
function updateOrderTransactionByPaymentData(currentOrder, paymentData) {
	const currencyCode = currentOrder.getCurrencyCode();
	let currentTransaction = findTransaction(currentOrder, paymentData);
	switch (paymentData.payment.status) {
		case 'success':
			currentTransaction.setAmount(
				new Money(
					ecommpayHelper.unFormatPrice(
						paymentData.payment.sum.amount,
						currencyCode,
					),
					currencyCode,
				),
			);
			break;
		case 'refunded':
		case 'partially refunded':
		case 'partially reversed':
		case 'partially paid':
			currentTransaction = createPaymentTransaction(
				currentOrder,
				paymentData,
			);
			break;
		default:
			break;
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
}

/**
 * Handles the payment information.
 *
 * @param {Object} paymentData - The payment data.
 * @return {undefined}
 */
exports.handlePaymentInfo = function (paymentData) {
	const isSignatureValid = ppURLGenerator.isRequestSignatureValid(
		paymentData,
		ecommpayHelper.getProjectSaltToken(),
	);

	if (!isSignatureValid) {
		throw errors.SignatureIsInvalidError;
	}

	if (!paymentData.payment || !paymentData.operation) {
		throw errors.InvalidPaymentDataError;
	}

	const currentOrder = OrderMgr.searchOrders(
		'custom.ecommpayPaymentID={0}',
		'creationDate desc',
		paymentData.payment.id,
	).first();

	if (!currentOrder) {
		throw new Error(`Cannot find order with id ${paymentData.payment.id}!`);
	}

	Transaction.wrap(function () {
		// Writing ecommpay data to the order
		currentOrder.externalOrderStatus = paymentData.payment.status;
		currentOrder.custom.ecommpayPaymentStatus = paymentData.payment.status;
		currentOrder.custom.ecommpayOperationType = paymentData.operation.type;
		currentOrder.custom.ecommpayPaymentMethod = paymentData.payment.method;

		updateOrderTransactionByPaymentData(currentOrder, paymentData);

		switch (paymentData.payment.status) {
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
			case 'external error':
			case 'internal error':
			case 'awaiting customer':
			case 'expired':
				currentOrder.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
				OrderMgr.failOrder(currentOrder, false);
				orderHelper.addNotification(
					currentOrder,
					'Order Failed',
					'Failed status: ' + paymentData.payment.status,
				);
				break;
			// Refund statuses
			case 'refunded':
				OrderMgr.cancelOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Order Refunded',
					'The order is refunded!',
				);
				break;
			case 'reversed':
				OrderMgr.cancelOrder(currentOrder);
				orderHelper.addNotification(
					currentOrder,
					'Order Reversed',
					'The order is reversed!',
				);
				break;
			// Not final statuses
			default:
				break;
		}
	});
};
