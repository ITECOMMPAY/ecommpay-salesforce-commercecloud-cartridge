const { EcommpayEmbeddedIframe } = require('./ecommpay/embeddedIframeClass');
const constants = require('./ecommpay/embeddedIframeConstants');

const embeddedIframe = new EcommpayEmbeddedIframe();

window.addEventListener(
	'message',
	function (e) {
		e.preventDefault();
		const d = embeddedIframe.parsePostMessage(e.data);
		switch (d.message) {
			case constants.POST_MESSAGE_CHECK_VALIDATION_RESPONSE:
				if (Object.keys(d.data).length > 0) {
					$('html, body').animate(
						{
							scrollTop: $(embeddedIframe.iframeElementSelector).offset()
								.top,
						},
						400,
					);
				} else {
					embeddedIframe.isCardDataValid = true;
					$(
						'#checkout-main .next-step-button button[value="submit-payment"]',
					).trigger('click');
				}
				break;
			case constants.POST_MESSAGE_REDIRECT_3DS_RESPONSE:
				embeddedIframe.redirect3DS(d.data);
				break;
			case constants.POST_MESSAGE_PAYMENT_SUCCESS:
				window.location.href =
					embeddedIframe.lastPaymentPageParams.redirect_success_url;
				break;
			case constants.POST_MESSAGE_PAYMENT_FAIL:
				window.location.href =
					embeddedIframe.lastPaymentPageParams.merchant_fail_url;
				break;
			case constants.POST_MESSAGE_PAYMENT_SENT:
				$.spinner().start();
				break;
			case constants.POST_MESSAGE_PAYMENT_PAGE_LOADED:
				$(window).trigger('resize');
				break;
			case constants.POST_MESSAGE_ENTER_PRESSED:
				window.postMessage(constants.POST_MESSAGE_CHECK_VALIDATION);
				break;
			default:
				break;
		}
	},
	false,
);

$(() => {
	embeddedIframe.addButtonEvents();
	if ($('#checkout-main').data('checkout-stage') === 'payment') {
		embeddedIframe.reloadIframe();
	}
});
