'use strict';

const ISML = require('dw/template/ISML');

/**
 * Load Ecommpay js lib
 */
function htmlHead() {
	ISML.renderTemplate('ecommpay/loadEcommpayHead');
}

exports.htmlHead = htmlHead;
