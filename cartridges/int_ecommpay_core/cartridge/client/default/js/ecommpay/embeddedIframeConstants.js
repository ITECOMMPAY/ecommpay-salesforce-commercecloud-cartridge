const constants = {
	POST_MESSAGE_CHECK_VALIDATION:
		'{"message":"epframe.embedded_mode.check_validation","from_another_domain":true}',
	POST_MESSAGE_PAYMENT_SUCCESS: 'epframe.payment.success',
	POST_MESSAGE_PAYMENT_FAIL: 'epframe.payment.fail',
	POST_MESSAGE_PAYMENT_SENT: 'epframe.payment.sent',
	POST_MESSAGE_REDIRECT_3DS_RESPONSE:
		'epframe.embedded_mode.redirect_3ds_parent_page',
	POST_MESSAGE_CHECK_VALIDATION_RESPONSE:
		'epframe.embedded_mode.check_validation_response',
	POST_MESSAGE_PAYMENT_PAGE_LOADED: 'epframe.loaded',
	POST_MESSAGE_ENTER_PRESSED: 'epframe.enter_key_pressed',
};

module.exports = constants;
