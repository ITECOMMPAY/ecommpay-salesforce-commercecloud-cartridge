/* global $ */

'use strict';

const base = require('base/checkout/billing');
const addressHelpers = require('base/checkout/address');

/**
 * updates the billing address form values within payment forms
 * @param {Object} order - the order model
 */
function updateBillingAddressFormValues(order) {
	base.methods.updateBillingAddress(order);
}

/**
 * updates the billing address selector within billing forms
 * @param {Object} order - the order model
 * @param {Object} customer - the customer model
 */
function updateBillingAddressSelector(order, customer) {
	const shipping = order.shipping;

	const form = $('form[name$=billing]')[0];
	const $billingAddressSelector = $('.addressSelector', form);
	let hasSelectedAddress = false;

	if ($billingAddressSelector && $billingAddressSelector.length === 1) {
		$billingAddressSelector.empty();
		// Add New Address option
		$billingAddressSelector.append(
			addressHelpers.methods.optionValueForAddress(null, false, order, {
				type: 'billing',
			}),
		);

		// Separator -
		$billingAddressSelector.append(
			addressHelpers.methods.optionValueForAddress(
				order.resources.shippingAddresses,
				false,
				order,
				{
					// className: 'multi-shipping',
					type: 'billing',
				},
			),
		);

		shipping.forEach(function (aShipping) {
			const isSelected = order.billing.matchingAddressId === aShipping.UUID;
			hasSelectedAddress = hasSelectedAddress || isSelected;
			// Shipping Address option
			$billingAddressSelector.append(
				addressHelpers.methods.optionValueForAddress(
					aShipping,
					isSelected,
					order,
					{
						// className: 'multi-shipping',
						type: 'billing',
					},
				),
			);
		});

		if (customer.addresses && customer.addresses.length > 0) {
			$billingAddressSelector.append(
				addressHelpers.methods.optionValueForAddress(
					order.resources.accountAddresses,
					false,
					order,
				),
			);
			customer.addresses.forEach(function (address) {
				const isSelected = order.billing.matchingAddressId === address.ID;
				hasSelectedAddress = hasSelectedAddress || isSelected;
				// Customer Address option
				$billingAddressSelector.append(
					addressHelpers.methods.optionValueForAddress(
						{
							UUID: address.ID,
							shippingAddress: address,
						},
						isSelected,
						order,
						{
							type: 'billing',
							className: 'isBillingAddress',
						},
					),
				);
			});
		}
	}

	if (
		hasSelectedAddress ||
		(!order.billing.matchingAddressId && order.billing.billingAddress.address)
	) {
		// show
		$(form).attr('data-address-mode', 'edit');
	} else {
		$(form).attr('data-address-mode', 'new');
	}

	$billingAddressSelector.show();
}

/**
 * Updates the billing information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 * @param {Object} customer - customer model to use as basis of new truth
 */
function updateBillingInformation(order, customer) {
	updateBillingAddressSelector(order, customer);
	// update billing address form
	updateBillingAddressFormValues(order);

	// update billing address summary
	addressHelpers.methods.populateAddressSummary(
		'.billing .address-summary',
		order.billing.billingAddress.address,
	);

	// update billing parts of order summary
	$('.order-summary-email').text(order.orderEmail);

	if (order.billing.billingAddress.address) {
		$('.order-summary-phone').text(
			order.billing.billingAddress.address.phone,
		);
	}
}

base.methods.updateBillingAddressFormValues = updateBillingAddressFormValues;
base.methods.updateBillingInformation = updateBillingInformation;

// Function to clear billing form
base.clearBillingForm = function () {
	// Attach event listener to body element
	$('body').on('checkout:clearBillingForm', function () {
		// Call method to clear billing address form values
		base.methods.clearBillingAddressFormValues();
	});
};

/**
 * Checks if all the provided arguments have data.
 * @param {...*} args - The arguments to check.
 * @returns {boolean} - True if all arguments have data, false otherwise.
 */
function hasData(...args) {
	// Check if all arguments have data
	return args.every((arg) => !!arg);
}
/**
 * Appends the provided HTML to the payment summary in the document.
 *
 * @param {string} html - The HTML string to be appended.
 * @return {undefined} This function does not return a value.
 */
function appendToPaymentSummary(html) {
	// Find the payment details element in the document
	const paymentSummary = document.querySelector('.payment-details');

	// Append the provided HTML to the payment summary element
	paymentSummary.innerHTML += html;
}

/**
 * Appends the selected payment method to the payment summary.
 *
 * @param {Object} selectedPaymentInstrument - The selected payment instrument.
 * @param {string} selectedPaymentInstrument.selectedPM - The selected payment method.
 *
 * @returns {boolean} - Returns true if the payment method was successfully appended, false otherwise.
 */
function appendPaymentMethod(selectedPaymentInstrument) {
	// Extract the selected payment method
	const selectedPM = selectedPaymentInstrument.selectedPM;

	// Create the HTML string to be appended
	const innerHTML = '<div><span>' + selectedPM + '</span></div>';

	// Append the HTML string to the payment summary
	return selectedPM && appendToPaymentSummary(innerHTML);
}

/**
 * Appends the issuer name to the payment summary.
 *
 * @param {Object} selectedPaymentInstrument - The selected payment instrument object.
 * @param {string} selectedPaymentInstrument.selectedIssuerName - The name of the selected issuer.
 * @returns {boolean} - Whether the issuer name was successfully appended to the payment summary.
 */
function appendIssuerName(selectedPaymentInstrument) {
	// Extract the selected issuer name from the payment instrument object
	const selectedIssuerName = selectedPaymentInstrument.selectedIssuerName;

	// Construct the HTML string to be appended to the payment summary
	const innerHTML = '<div><span>'.concat(selectedIssuerName, '</span></div>');

	// Check if the selected issuer name exists and append it to the payment summary
	return selectedIssuerName && appendToPaymentSummary(innerHTML);
}

/**
 * Appends the masked credit card number to the payment summary.
 *
 * @param {Object} selectedPaymentInstrument - The selected payment instrument object.
 * @returns {boolean} - True if the masked credit card number is appended successfully, false otherwise.
 */
function appendMaskedCC(selectedPaymentInstrument) {
	// Get the masked credit card number from the selected payment instrument
	const maskedCreditCardNumber =
		selectedPaymentInstrument.maskedCreditCardNumber;

	// Create the HTML string with the masked credit card number
	const innerHTML = '<div>'.concat(maskedCreditCardNumber, '</div>');

	// Append the HTML string to the payment summary if the masked credit card number exists
	return maskedCreditCardNumber && appendToPaymentSummary(innerHTML);
}

/**
 * Appends the expiration date of the selected payment instrument to the payment summary.
 *
 * @param {Object} selectedPaymentInstrument - The selected payment instrument.
 * @param {Object} order - The order object.
 * @returns {boolean} - True if the expiration date was appended successfully, false otherwise.
 */
function appendExpiration(selectedPaymentInstrument, order) {
	// Extract the expiration month and year from the selected payment instrument
	const expirationMonth = selectedPaymentInstrument.expirationMonth;
	const expirationYear = selectedPaymentInstrument.expirationYear;

	// Create the innerHTML string with the card ending, expiration month, and expiration year
	const innerHTML =
		'<div><span>' +
		order.resources.cardEnding +
		' ' +
		expirationMonth +
		'/' +
		expirationYear +
		'</span></div>';

	// Check if the expiration month and year have data and append the innerHTML to the payment summary
	return (
		hasData(expirationMonth, expirationYear) &&
		appendToPaymentSummary(innerHTML)
	);
}

/**
 * Update the payment information for an order
 * @param {Object} order - The order object
 */
function updatePaymentInformation(order) {
	// Check if there is a selected payment instrument
	if (
		order.billing.payment.selectedPaymentInstruments &&
		order.billing.payment.selectedPaymentInstruments.length
	) {
		const selectedPaymentInstrument =
			order.billing.payment.selectedPaymentInstruments[0];

		// Clear the payment details element
		document.querySelector('.payment-details').innerHTML = '';

		// Append the payment method
		appendPaymentMethod(selectedPaymentInstrument);

		// Append the issuer name
		appendIssuerName(selectedPaymentInstrument);

		// Append the masked credit card number
		appendMaskedCC(selectedPaymentInstrument);

		// Append the expiration date
		appendExpiration(selectedPaymentInstrument, order);
	}
}

module.exports.updatePaymentInformation = updatePaymentInformation;

module.exports = base;
