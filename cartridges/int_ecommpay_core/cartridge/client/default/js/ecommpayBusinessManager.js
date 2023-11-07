/* eslint-disable no-alert */

const $ = (window.jQuery = require('jquery'));

$(() => {
	// Modals common logic
	$('.modal-close-button').on('click', function (e) {
		e.stopImmediatePropagation();
		e.preventDefault();
		$('.custom-modal-background').hide();
		$(this).closest('.custom-modal').hide();
	});

	$('button[data-modal]').on('click', function (e) {
		e.stopImmediatePropagation();
		e.preventDefault();
		$('.custom-modal-background').show();
		$('.' + $(this).data('modal')).show();
	});

	$('.submit-button').on('click', async function (e) {
		const modal = $(this).closest('.custom-modal');

		if (modal.length === 0) {
			return;
		}

		e.stopImmediatePropagation();
		e.preventDefault();

		const modalUrl = modal.data('action');
		const modalMethod = modal.data('method') || 'POST';

		const modalData = {};

		let inputsInvalid = false;

		$(modal)
			.find('.modal-input')
			.each(function () {
				const max = $(this).attr('max');
				const min = $(this).attr('min');
				const val = $(this).val();
				if (
					(min && parseFloat(val) < parseFloat(min)) ||
					(max && parseFloat(val) > parseFloat(max))
				) {
					inputsInvalid = true;
					return;
				}
				modalData[$(this).attr('name')] = val;
			});

		if (inputsInvalid) return;

		$.ajax(modalUrl + '?' + $.param(modalData), {
			method: modalMethod,
			success: function (data) {
				if (data.result === undefined) {
					alert(
						'Access denied. Please, give access right to Ecommpay in Administration > Organization > Roles & Permissions section.',
					);
					return;
				}
				if (data.result.status === 'success') {
					window.location.reload();
				}
			},
			error: function (xhr) {
				const json = xhr.responseJSON;
				alert(json.error);
				console.error(json.status, json.error, json.trace);
			},
		});
	});

	const amountInput = $('.amount-input');

	$('.amount-all-button').on('click', function (e) {
		e.stopImmediatePropagation();
		e.preventDefault();

		amountInput.val(amountInput.attr('max'));
	});

	$(amountInput).on('input', function () {
		setTimeout(() => {
			const value = parseFloat($(this).val());
			const max = parseFloat($(this).attr('max'));
			if (value > max) {
				$(this).val(max);
			}
		}, 0);
	});

	$(amountInput).on('change', function () {
		const value = parseFloat($(this).val());
		const min = parseFloat($(this).attr('min'));
		if (value < min) {
			$(this).val(min);
		}
	});
	// End modals common logic

	// Reload order payment status on frontend
	if ($('.wait-for-response__text').length > 0) {
		const paymentStatusUrl = $('meta[name="payment-status-url"]').attr(
			'content',
		);
		const paymentStatusCurrent = $('meta[name="payment-status"]').attr(
			'content',
		);

		setInterval(() => {
			$.ajax(paymentStatusUrl, {
				method: 'GET',
				dataType: 'json',
				success: function (data) {
					if (data.payment_status === undefined) {
						alert(
							'Access denied. Please, give access right to Ecommpay in Administration > Organization > Roles & Permissions section.',
						);
						return;
					}
					if (data.payment_status !== paymentStatusCurrent) {
						window.location.reload();
					}
				},
				error: function (xhr) {
					const json = xhr.responseJSON;
					console.error(json.status, json.error, json.trace);
				},
			});
		}, 5000);
	}
});
