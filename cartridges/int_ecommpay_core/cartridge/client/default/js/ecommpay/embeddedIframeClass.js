/* globals EPayWidget */

const { createErrorNotification } = require('../ecommpay/ecommpayCustomErrors');
const embeddedConstants = require('./embeddedIframeConstants');

class EcommpayEmbeddedIframe {
	constructor() {
		// Dynamic variable
		this.iframeElementSelector = null;
		this.lastPaymentPageParams = null;
		this.isCardDataValid = false;
	}

	/**
	 * Adds event listeners to the buttons in the checkout page.
	 *
	 * @return {undefined} This function does not return a value.
	 */
	addButtonEvents() {
		const iframe = this;

		$('.next-step-button button').on('click', function (e) {
			const stage = $(this).val();
			switch (stage) {
				case 'submit-shipping':
					// Wait until shipping data is become valid before reloading iframe
					setTimeout(function () {
						iframe.reloadIframe();
					}, 400);
					break;
				case 'submit-payment':
					iframe.checkValidation(e);
					break;
				case 'place-order':
					iframe.placeOrderClick(e);
					break;
				default:
					break;
			}
		});

		// Resizing iframe when moving on previous step
		$('.edit-button').on('click', function () {
			$(window).trigger('resize');
		});
	}

	/**
	 * Reloads the iframe by making an AJAX request to the 'Ecommpay-StartPayment' endpoint.
	 *
	 * @return {Promise} A Promise that resolves when the iframe is reloaded successfully, and rejects if there is an error.
	 */
	reloadIframe() {
		const iframe = this;
		return new Promise((resolve, reject) => {
			$.ajax('Ecommpay-StartPayment', {
				success: function (data) {
					const paramsToSend = data.iframeParams;
					iframe.iframeElementSelector = '#' + paramsToSend.target_element;
					EPayWidget.run(paramsToSend, 'GET');
					resolve();
				},
				error: function (data) {
					if (data.error) {
						createErrorNotification(data.errorMessage);
					}
					reject();
				},
			});
		});
	}

	/**
	 * Returns true if payment method is embedded
	 * @returns {boolean} Is payment method embedded
	 */
	isEmbeddedPaymentMethod() {
		const cardDisplayMode = $('meta[name=ecommpayCardDisplayMode]').attr(
			'content',
		);
		const selectedPaymentProcessor = $(
			'.payment-options a.nav-link.active',
		).data('payment-processor-id');
		return (
			cardDisplayMode === 'ECOMMPAY_EMBEDDED' &&
			selectedPaymentProcessor === 'ECOMMPAY_CREDIT'
		);
	}

	/**
	 * Handles the click event when the user places an order.
	 *
	 * @param {Event} e - The click event object.
	 * @return {void} This function does not return a value.
	 */
	placeOrderClick(e) {
		const iframe = this;
		if (iframe.isEmbeddedPaymentMethod()) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			$.ajax('Ecommpay-EmbeddedSubmit', {
				method: 'POST',
				success: function (data) {
					if (data.error || data.cartError) {
						createErrorNotification(data.errorMessage);
						if (data.redirectUrl) {
							window.location.href = data.redirectUrl;
						}
					} else {
						iframe.lastPaymentPageParams = data.paymentPageParameters;
						window.postMessage(
							'{"message":"epframe.embedded_mode.submit","fields":' +
								JSON.stringify(data.paymentPageParameters) +
								',"from_another_domain":true}',
						);
					}
				},
				error: function (data) {
					createErrorNotification(data.errorMessage);
				},
			});
		}
	}

	/**
	 * Checks validation
	 * @param {Event} e Js event
	 */
	checkValidation(e) {
		if (this.isEmbeddedPaymentMethod()) {
			if (!this.isCardDataValid) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				window.postMessage(embeddedConstants.POST_MESSAGE_CHECK_VALIDATION);
			}
		}
	}

	/**
	 * Parses postMessage
	 * @param {string} message Message
	 * @returns {{data}|{message}|any|boolean} Parsed message or false
	 */
	parsePostMessage(message) {
		try {
			const parsed = JSON.parse(message);
			if (parsed.message) {
				return parsed;
			}
		} catch (e) {
			console.error('Parse postMessage error!', e);
		}
		return false;
	}

	/**
	 * Redirects to 3DS page
	 * @param {Object} data Data
	 */
	redirect3DS(data) {
		const form = document.createElement('form');
		form.setAttribute('method', data.method);
		form.setAttribute('action', data.url);
		form.setAttribute('style', 'display:none;');
		form.setAttribute('name', '3dsForm');

		for (const k of Object.keys(data.body)) {
			const input = document.createElement('input');
			input.name = k;
			input.value = data.body[k];
			form.appendChild(input);
		}
		document.body.appendChild(form);
		form.submit();
	}
}

module.exports = { EcommpayEmbeddedIframe };
