/**
 * Creates an error notification with the given message.
 *
 * @param {string} message - The error message.
 */
exports.createErrorNotification = function (message) {
	if (!message) {
		console.error('Error message is empty!');
		message = 'Unknown error';
	} else {
		console.error(message);
	}
	$('.error-message').show();
	$('.error-message .error-message-text').html(message);
};
