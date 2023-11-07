const Site = require('dw/system/Site');
const URLUtils = require('dw/web/URLUtils');
const URLAction = require('dw/web/URLAction');

/**
 * Generates the callback URL for the selected site in Business Manager.
 *
 * @return {string} The callback URL for the selected site.
 */
exports.getSelectedSiteCallbackURL = function () {
	const site = Site.getCurrent();
	const urlAction = new URLAction(
		'Gate-Receive',
		site.getID(),
		site.getDefaultLocale(),
		site.getHttpsHostName(),
	);

	return URLUtils.abs(false, urlAction).toString();
};
