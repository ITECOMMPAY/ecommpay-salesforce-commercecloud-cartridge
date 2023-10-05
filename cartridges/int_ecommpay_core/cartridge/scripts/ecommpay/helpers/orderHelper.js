/**
 * Adds a notification to the order
 * with checking if the notification already exists on last place.
 * Need to be wrapped into a transaction.
 *
 * @param {Object} order - The order object.
 * @param {string} subject - The subject of the notification.
 * @param {string} message - The message of the notification.
 * @return {boolean} Returns true if the notification is added successfully, false otherwise.
 */
function addNotification(order, subject, message) {
	const notes = order.getNotes();

	if (notes.length) {
		const firstNote = notes.get(0);
		if (firstNote.text === message && firstNote.subject === subject) {
			return false;
		}
	}
	order.addNote(subject, message);
	return true;
}

exports.addNotification = addNotification;
