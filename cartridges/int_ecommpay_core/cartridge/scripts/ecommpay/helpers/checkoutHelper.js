'use strict';

const BasketMgr = require('dw/order/BasketMgr');
const OrderMgr = require('dw/order/OrderMgr');
const Transaction = require('dw/system/Transaction');
const PaymentMgr = require('dw/order/PaymentMgr');
const ecommpayHelper = require('*/cartridge/scripts/ecommpay/helpers/ecommpayHelper');
const PaymentTransaction = require('dw/order/PaymentTransaction');
const collections = require('*/cartridge/scripts/util/collections');
const Resource = require('dw/web/Resource');
const URLUtils = require('dw/web/URLUtils');
const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
const paymentPageHelper = require('*/cartridge/scripts/ecommpay/helpers/paymentPageHelper');
const ppURLGenerator = require('*/cartridge/scripts/ecommpay/helpers/paymentPage/paymentPageUrlGenerator');
const orderHelper = require('*/cartridge/scripts/ecommpay/helpers/orderHelper');
const Logger = require('dw/system/Logger');
/**
 * Creates an Ecommpay payment instrument for the given basket and payment method ID.
 *
 * @param {Object} basket - The basket object representing the current shopping basket.
 * @param {string} paymentMethodId - The ID of the payment method to be used for the payment instrument.
 * @return {undefined} This function does not return anything.
 */
exports.createEcommpayPaymentInstrument = function (basket, paymentMethodId) {
	const paymentInstrument = basket.createPaymentInstrument(
		paymentMethodId,
		basket.getTotalGrossPrice(),
	);

	const paymentTransaction = paymentInstrument.paymentTransaction;
	let processor;
	if (!paymentTransaction.getPaymentProcessor()) {
		processor =
			PaymentMgr.getPaymentMethod(paymentMethodId).getPaymentProcessor();
		if (processor) {
			paymentTransaction.setPaymentProcessor(processor);
		}
	}

	const ecommpayProjectId = String(ecommpayHelper.getProjectID());

	if (ecommpayProjectId) {
		paymentTransaction.custom.ecommpayProjectId = ecommpayProjectId;
	}
};

/**
 * Attempts to create an order from the current basket
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {dw.order.Order} The order object created from the current basket
 */
function createOrder(currentBasket) {
	let order;
	try {
		order = Transaction.wrap(function () {
			return OrderMgr.createOrder(currentBasket);
		});
	} catch (error) {
		if (order) {
			Transaction.wrap(function () {
				order.addNote('Error Create Order', error.message);
			});
		}
	}

	return order;
}

exports.createOrder = createOrder;

/**
 * Updates the payment transaction with the current order
 * @param {dw.order.Order} currentOrder Order object
 */
function updatePaymentTransaction(currentOrder) {
	const paymentInstruments = currentOrder.getPaymentInstruments();

	collections.forEach(paymentInstruments,
		function (paymentInstrument) {
			const paymentTransaction = paymentInstrument.getPaymentTransaction();
			const purchaseTypeMap = {
				ECOMMPAY_SALE: {
					pp_type: 'sale',
					sf_type: PaymentTransaction.TYPE_CREDIT
				},
				ECOMMPAY_AUTH: {
					pp_type: 'auth',
					sf_type: PaymentTransaction.TYPE_AUTH
				},
			};
			paymentTransaction.custom.ecommpayOperationType = purchaseTypeMap[ecommpayHelper.getEcommpayPurchaseType()].pp_type;
			paymentTransaction.type = purchaseTypeMap[ecommpayHelper.getEcommpayPurchaseType()].sf_type;
		});
	const customer = currentOrder.getCustomer();
	if (customer) {
		currentOrder.custom.ecommpayCustomerID = customer.getID();
	}
}

exports.updatePaymentTransaction = updatePaymentTransaction;

/**
 * Submits the order (EMBEDDED and REDIRECT modes both).
 * @param {sfra.Request} req Request
 * @param {sfra.Response} res Response
 * @param {function} next Do next action on prepend method
 * @returns {*|null} Redirect URL in redirect mode, postMessageParams in Embedded mode
 */
exports.placeOrder = function (req, res, next) {
	if (!ecommpayHelper.isEcommpayEnabled()) {
		return next();
	}
	const currentBasket = BasketMgr.getCurrentBasket();

	if (!currentBasket) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.abs(
				'Checkout-Begin',
				'stage',
				'shipping',
				'errorMessage',
				'Error: Basket is undefined. Please contact support.',
			).toString(),
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	const paymentInstruments = currentBasket.getPaymentInstruments();

	let isEcommpay = false;
	let selectedPaymentProcessorID;

	collections.forEach(paymentInstruments, function (paymentInstrument) {
		const paymentMethodID = paymentInstrument.getPaymentMethod();
		const paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodID);
		if (paymentMethod) {
			const paymentProcessor = paymentMethod.getPaymentProcessor();

			selectedPaymentProcessorID = paymentProcessor.ID;

			if (
				paymentProcessor.ID === 'ECOMMPAY_APM' ||
				paymentProcessor.ID === 'ECOMMPAY_CREDIT'
			) {
				isEcommpay = true;
			}
		}
	});

	if (!isEcommpay) {
		return next();
	}

	const isEmbeddedPP =
		ecommpayHelper.getEcommpayCardDisplayMode() === 'ECOMMPAY_EMBEDDED' &&
		selectedPaymentProcessorID === 'ECOMMPAY_CREDIT';

	const validatedProducts = validationHelpers.validateProducts(currentBasket);

	if (validatedProducts.error) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.abs(
				'Checkout-Begin',
				'stage',
				'payment',
				'errorMessage',
				'Validating products error. Please contact support.',
			).toString(),
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	if (req.session.privacyCache.get('fraudDetectionStatus')) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.abs('Error-ErrorCode', 'err', '01').toString(),
			errorMessage: Resource.msg('error.technical', 'checkout', null),
		});

		this.emit('route:Complete', req, res);
		return null;
	}

	const validationOrderStatus = hooksHelper(
		'app.validate.order',
		'validateOrder',
		currentBasket,
		require('*/cartridge/scripts/hooks/validateOrder').validateOrder,
	);
	if (validationOrderStatus.error) {
		res.json({
			error: true,
			errorStage: {
				stage: 'payment',
			},
			errorMessage:
				validationOrderStatus.message || 'Failed to validate order',
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	// Check to make sure there is a shipping address
	if (currentBasket.defaultShipment.shippingAddress === null) {
		res.json({
			error: true,
			errorStage: {
				stage: 'shipping',
				step: 'address',
			},
			errorMessage: Resource.msg(
				'error.no.shipping.address',
				'checkout',
				null,
			),
		});
		this.emit('route:Complete', req, res);
		return null;
	}
	// Check to make sure the billing address exists
	if (!currentBasket.billingAddress) {
		res.json({
			error: true,
			errorStage: {
				stage: 'payment',
				step: 'billingAddress',
			},
			errorMessage: Resource.msg(
				'error.no.billing.address',
				'checkout',
				null,
			),
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	// Calculate the basket
	Transaction.wrap(function () {
		basketCalculationHelpers.calculateTotals(currentBasket);
	});

	let calculatedPaymentTransactionTotal;

	Transaction.wrap(function () {
		// Calculate the payment transaction total amount
		calculatedPaymentTransactionTotal =
			COHelpers.calculatePaymentTransaction(currentBasket);
	});

	if (
		!calculatedPaymentTransactionTotal ||
		calculatedPaymentTransactionTotal.error
	) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.abs(
				'Checkout-Begin',
				'stage',
				'payment',
				'errorMessage',
				'Payment transaction error. Please contact support.',
			).toString(),
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	//  Checking for amount and currencies in embedded mode PE-664
	if (isEmbeddedPP) {
		const storedCurrency = currentBasket.custom.ecommpayPaymentCurrency;
		const currentCurrency = currentBasket.getCurrencyCode();
		const currencyCheckPassed = storedCurrency === currentCurrency;
		const storedAmount = Number(currentBasket.custom.ecommpayPaymentAmount);
		const currentAmount = Number(currentBasket.getTotalGrossPrice().value);
		const amountCheckPassed = storedAmount === currentAmount;
		if (!currencyCheckPassed || !amountCheckPassed) {
			const errorMessage =
				'Payment amounts does not match. Please contact support.';
			res.json({
				error: true,
				cartError: true,
				redirectUrl: URLUtils.abs(
					'Checkout-Begin',
					'stage',
					'payment',
					'errorMessage',
					errorMessage,
				).toString(),
			});
			Logger.debug(
				JSON.stringify({
					errorMessage,
					currentAmount,
					currentCurrency,
					storedAmount,
					storedCurrency,
				}),
			);
			this.emit('route:Complete', req, res);
			return null;
		}
	}

	const currentOrder = createOrder(currentBasket);
	if (!currentOrder) {
		res.json({
			error: true,
			cartError: true,
			redirectUrl: URLUtils.abs(
				'Checkout-Begin',
				'stage',
				'shipping',
				'errorMessage',
				'Order creation error. Please contact support.',
			).toString(),
		});
		this.emit('route:Complete', req, res);
		return null;
	}

	Transaction.wrap(function () {
		updatePaymentTransaction(currentOrder);
		// session.privacy.ecommpayOrderNumber = currentOrder.ecommpayOrderNumber
		if (isEmbeddedPP) {
			currentOrder.custom.ecommpayPaymentID =
				currentBasket.custom.ecommpayPaymentID;
		} else {
			currentOrder.custom.ecommpayPaymentID =
				'sfcc_' + currentOrder.orderToken;
		}
		currentOrder.externalOrderStatus = 'Processing';
		currentOrder.custom.ecommpayPaymentStatus =
			currentOrder.externalOrderStatus;
		orderHelper.addNotification(
			currentOrder,
			'Order Created',
			'Order is just created and waiting for payment',
		);
	});

	const paymentPageParameters = paymentPageHelper.createPaymentPageParameters(
		currentOrder,
		req,
		isEmbeddedPP ? 'embedded' : 'redirect',
	);
	if (isEmbeddedPP) {
		res.json({
			error: false,
			paymentPageParameters: paymentPageParameters,
		});
		res.setStatusCode(200);
		return next();
	} else {
		res.json({
			error: false,
			continueUrl: URLUtils.url(
				'Ecommpay-RedirectToPaymentPage',
				'payment_page_url',
				ppURLGenerator.generate(
					ecommpayHelper.getProjectID(),
					ecommpayHelper.getProjectSaltToken(),
					paymentPageParameters,
				),
			).toString(),
		});
		this.emit('route:Complete', req, res);
	}

	return null;
};
