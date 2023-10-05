/* global $ ApplePaySession */

/**
 * Active payment method was changed
 */
function activePaymentMethodChanged() {
	const activeTabName = $('.payment-options .nav-link.active').data(
		'payment-method-name',
	);
	$('.ecommpay-payment-method-summary').html(activeTabName);
	$(window).trigger('resize');
}

/**
 * Checks if Apple Pay is allowed.
 *
 * @return {boolean} true if Apple Pay is allowed, otherwise false
 */
function isApplePayAllowed() {
	return (
		Object.prototype.hasOwnProperty.call(window, 'ApplePaySession') &&
		ApplePaySession.canMakePayments()
	);
}

$(() => {
	setTimeout(activePaymentMethodChanged, 0);

	const applePayButton = $('.nav-item[data-method-id=ECOMMPAY_APPLEPAY]');

	if (!isApplePayAllowed() && applePayButton.length > 0) {
		applePayButton.hide();
	}
});

$('.payment-options .nav-item').on('click', () => {
	setTimeout(activePaymentMethodChanged, 0);
});
