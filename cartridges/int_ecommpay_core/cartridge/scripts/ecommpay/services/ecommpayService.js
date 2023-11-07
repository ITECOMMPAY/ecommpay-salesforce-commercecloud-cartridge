const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
/**
 * Traverses a payload object to collect parameters and values to be passed
 * as key/value pairs either as query string or application/x-www-form-urlencoded
 * body.
 *
 * @param {Object} collector - An object to collect key/value pairs. Must provide
 *   addParam(name, value) method. Could be dw.svc.Service.
 * @param {Object} payload - Payload to collect parameters from. Can be acutal
 *   payload or an object containing query string parameters.
 * @param {string} prefix - Prefix to append to parameter names. Used recursively,
 *   not needed for the intial call.
 */
function collectParams(collector, payload, prefix) {
	if (payload && typeof payload === 'object') {
		Object.keys(payload).forEach(function (key) {
			const paramName =
				prefix && prefix.length
					? prefix + '[' + (Array.isArray(payload) ? '' : key) + ']'
					: key;
			let paramValue = payload[key];

			if (paramValue === null || typeof paramValue === 'undefined') {
				paramValue = '';
			}

			if (paramValue && typeof paramValue === 'object') {
				collectParams(collector, paramValue, paramName);
			} else {
				collector.addParam(paramName, paramValue);
			}
		});
	}
}

/**
 * Converts a payload object into a application/x-www-form-urlencoded string
 *
 * @param {type} payload - Payload object
 * @return {string|null} - URL encoded string for that payload
 */
function payloadToBody(payload) {
	if (payload) {
		const payloadParamsCollector = {
			params: [],
			addParam: function (name, value) {
				this.params.push(
					encodeURIComponent(name) + '=' + encodeURIComponent(value),
				);
			},
		};

		collectParams(payloadParamsCollector, payload, null);

		if (payloadParamsCollector.params.length) {
			return payloadParamsCollector.params.join('&');
		}
	}

	return null;
}

/**
 * Creates an Ecommpay service based on the specified service type.
 *
 * @param {string} serviceType - The type of service to create (gate or payment_page).
 * @return {dw.svc.Service} The Ecommpay service instance.
 */
function createEcommpayService(serviceType) {
	const serviceMap = {
		GATE: 'ecommpay.gate.http.service',
		PAYMENT_PAGE: 'ecommpay.pp.http.service',
	};

	serviceType = serviceMap[serviceType];

	if (!serviceType) throw new Error('Unknown service type: ' + serviceType);

	return LocalServiceRegistry.createService(serviceType, {
		/**
		 * A callback function to configure HTTP request parameters before
		 * a call is made to Ecommpay web service
		 *
		 * @param {dw.svc.Service} svc Service instance
		 * @param {string} requestObject - Request object, containing the end point, query string params, payload etc.
		 * @returns {string|null} - The body of HTTP request
		 */
		createRequest: function (svc, requestObject) {
			let URL = svc.configuration.credential.URL;
			URL += requestObject.endpoint;
			svc.setURL(URL);

			if (requestObject.httpMethod) {
				svc.setRequestMethod(requestObject.httpMethod);
			}

			if (requestObject.queryString) {
				collectParams(svc, requestObject.queryString, null);
			}

			if (requestObject.payload) {
				return payloadToBody(requestObject.payload);
			}

			if (requestObject.json) {
				svc.addHeader('Content-Type', 'application/json');
				return JSON.stringify(requestObject.json);
			}

			return null;
		},

		/**
		 * A callback function to parse Ecommpay web service response
		 *
		 * @param {dw.svc.Service} svc - Service instance
		 * @param {dw.net.HTTPClient} httpClient - HTTP client instance
		 * @returns {string} - Response body in case of a successful request or null
		 */
		parseResponse: function (svc, httpClient) {
			return JSON.parse(httpClient.text);
		},
	});
}

/**
 * Creates an Error and appends web service call result as callResult
 *
 * @param {dw.svc.Result} callResult - Web service call result
 * @return {Error} - Error created
 */
function EcommpayServiceError(callResult) {
	let message = 'Ecommpay service call failed';
	if (callResult && callResult.errorMessage) {
		message += ': ' + callResult.errorMessage;
	}

	const err = new Error(message);
	err.callResult = callResult;
	err.name = 'EcommpayServiceError';

	return err;
}

/**
 * Calls a service with the specified name and request object.
 *
 * @param {string} name - The name of the service to call.
 * @param {Object} requestObject - The request object to send to the service.
 * @throws {Error} If the requestObject parameter is missing.
 * @throws {EcommpayServiceError} If the call to the service is not successful.
 * @return {Object} The object returned by the service call.
 */
function callService(name, requestObject) {
	if (!requestObject) throw new Error('Missing RequestObject parameter');

	const callResult = createEcommpayService(name).call(requestObject);

	if (!callResult.ok) {
		throw new EcommpayServiceError(callResult);
	}

	return callResult.object;
}

exports.callService = callService;
