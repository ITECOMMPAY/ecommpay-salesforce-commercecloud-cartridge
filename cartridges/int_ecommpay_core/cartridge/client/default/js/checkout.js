/* global $ */

'use strict';

const processInclude = require('base/util');

$(document).ready(function () {
	processInclude(require('./checkout/checkout'));
	processInclude(require('./ecommpay/ecommpayCheckout'));
});
