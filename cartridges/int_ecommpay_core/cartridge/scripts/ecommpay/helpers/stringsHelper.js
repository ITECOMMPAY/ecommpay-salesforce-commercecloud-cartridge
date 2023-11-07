/**
 * Generates a random string of the specified length.
 *
 * @param {number} length - The length of the random string to generate.
 * @return {string} The randomly generated string.
 */
exports.generateRandomString = function (length) {
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	let result = '';
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
};

/**
 * Generates a random version number between 0 and 999999.
 *
 * @returns {number} A random version number.
 */
exports.generateRandomVersion = function () {
	return Math.floor(Math.random() * 1000000);
};