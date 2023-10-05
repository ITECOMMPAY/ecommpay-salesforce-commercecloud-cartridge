window.jQuery = window.$ = require('jquery');
const processInclude = require('base/util');
const { createErrorNotification } = require('./ecommpay/ecommpayCustomErrors');

$(document).ready(function () {
	// processInclude(require('./ecommpayEmbeddedIframe'));
});

// Show error and div notification when page loaded
const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

$(function () {
	if (params.errorMessage) {
		createErrorNotification(params.errorMessage);
	}
});
