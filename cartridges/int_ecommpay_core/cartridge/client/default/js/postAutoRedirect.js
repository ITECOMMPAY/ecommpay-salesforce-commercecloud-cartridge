window.jQuery = window.$ = require('jquery');
/* global $,redirectUrl,paramsJson */

$(() => {
	// Used for POST redirects, because we cannot do this on backend.
	const redirect = $('<form>').appendTo(document.body).attr({
		method: 'POST',
		action: redirectUrl,
	});

	if (paramsJson) {
		const params = JSON.parse(decodeURIComponent(paramsJson));

		Object.keys(params).forEach(function (key) {
			const value = params[key];
			$('<input type="hidden">').appendTo(redirect).attr({
				name: key,
				value: value,
			});
		});
	}
	redirect.submit();
});
