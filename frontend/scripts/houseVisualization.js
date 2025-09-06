/** Маскирует буквы/цифры, но оставляет знаки препинания и пробелы */
function maskValue(val) {
if (!val) return '';
return String(val).replace(/[0-9A-Za-zА-Яа-яЁё]/g, '*');
}

/** Навешивает поведение на все .vis-toggle внутри modalEl */
function initVisibilityToggles(modalEl) {
modalEl.querySelectorAll('.vis-toggle').forEach(btn => {
	btn.addEventListener('click', () => {
		const pressed = btn.getAttribute('aria-pressed') === 'true';
		btn.setAttribute('aria-pressed', String(!pressed));
		const icon = btn.querySelector('i');
		if (icon) {
		icon.classList.toggle('fa-eye',  pressed);     // если было скрыто — показать глаз
		icon.classList.toggle('fa-eye-slash', !pressed); // если было видно — перечеркнуть
		}
	});
});
}

/** Считывает флаги show_* из модалки (true = показывать) */
function getPrivacyFromModal(modalEl) {
const getShow = (id) => {
	const btn = modalEl.querySelector(`.vis-toggle[data-target="${id}"]`);
	// aria-pressed=true => скрыто => show=false
	const hidden = btn ? (btn.getAttribute('aria-pressed') === 'true') : false;
	return !hidden;
};
return {
	show_full_name: getShow('residentFullName'),
	show_phone:     getShow('residentPhone'),
	show_email:     getShow('residentEmail'),
	show_telegram:  getShow('residentTelegram'),
};
}

/** Применяет флаги к модалке (true = показывать) */
function setPrivacyToModal(modalEl, privacy = {}) {
const setBtn = (id, show) => {
	const btn = modalEl.querySelector(`.vis-toggle[data-target="${id}"]`);
	if (!btn) return;
	const hidden = show === false; // если показывать=false, значит скрыто
	btn.setAttribute('aria-pressed', String(hidden));
	const icon = btn.querySelector('i');
	if (icon) {
		icon.classList.toggle('fa-eye', !hidden);
		icon.classList.toggle('fa-eye-slash', hidden);
	}
};
setBtn('residentFullName', privacy.show_full_name !== false);
setBtn('residentPhone',    privacy.show_phone     !== false);
setBtn('residentEmail',    privacy.show_email     !== false);
setBtn('residentTelegram', privacy.show_telegram  !== false);
}

document.addEventListener('DOMContentLoaded', async function () {
	const houseId = new URLSearchParams(window.location.search).get('id');
	const houseNameElement = document.getElementById('houseName');
	const chessboard = document.getElementById('chessboard');
	const parkingSection = document.getElementById('parking');
	const storagesSection = document.getElementById('storages');
	initVisibilityToggles(document.getElementById('addResidentModal'));
	initVisibilityToggles(document.getElementById('editResidentModal'));

	try {
		const response = await fetch(`http://localhost:5000/api/houses/${houseId}/structure`);
		const house = await response.json();

		houseNameElement.textContent = house.name;
		
		// Сортировка подъездов по возрастанию их номера
		house.Entrances.sort((a, b) => a.entrance_number - b.entrance_number);

		// Вычисляем максимальное количество этажей среди всех подъездов
		const maxFloors = Math.max(...house.Entrances.map((entrance) => entrance.floors_count));

		// Создаем контейнер для заголовка и этажей
		const floorColumnContainer = document.createElement('div');
		floorColumnContainer.classList.add('floor-column-container');

		// Добавляем заголовок "Этаж"
		const floorColumnHeader = document.createElement('div');
		floorColumnHeader.classList.add('floor-column-header'); // Новый класс для заголовка
		floorColumnHeader.textContent = 'Этаж';
		floorColumnContainer.appendChild(floorColumnHeader);

		// Генерация колонки этажей
		const floorNumbersDiv = document.createElement('div');
		floorNumbersDiv.classList.add('floor-numbers'); // Класс для оформления
		for (let floor = maxFloors; floor >= 1; floor--) {
			const floorNumberDiv = document.createElement('div');
			floorNumberDiv.classList.add('floor-number'); // Класс для каждого этажа
			floorNumberDiv.textContent = floor; // Номер этажа
			floorNumbersDiv.appendChild(floorNumberDiv);
		}

		// Добавляем колонку этажей в контейнер
		floorColumnContainer.appendChild(floorNumbersDiv);

		// Вставляем контейнер для этажей перед всеми подъездами
		chessboard.insertBefore(floorColumnContainer, chessboard.firstChild);

		// Генерация шахматки
		house.Entrances.forEach((entrance) => {
			const entranceWrapper = document.createElement('div');
			entranceWrapper.classList.add('entrance-wrapper');

			const entranceDiv = document.createElement('div');
			entranceDiv.classList.add('entrance');

			const totalFloors = entrance.floors_count;

			const floors = {};
			entrance.Apartments.forEach((apartment) => {
				if (!floors[apartment.floor_number]) {
					floors[apartment.floor_number] = [];
				}
				floors[apartment.floor_number].push(apartment);
			});

			// Генерация этажей для подъезда
			for (let floor = maxFloors; floor >= 1; floor--) {
				const floorDiv = document.createElement('div');
				floorDiv.classList.add('floor');

				if (floor > totalFloors) {
					// Пропускаем этажи, которых нет в подъезде
					continue;
				}

				if (floor === 1 && house.non_residential_first_floor) {
					for (let i = 1; i <= entrance.apartments_per_floor; i++) {
							const apartmentDiv = document.createElement('div');
							apartmentDiv.classList.add('apartment', 'non-residential');
							apartmentDiv.textContent = `—`;
							floorDiv.appendChild(apartmentDiv);
					}
				} else {
					(floors[floor] || [])
							.sort((a, b) => a.apartment_number - b.apartment_number)
							.forEach((apartment) => {
								const apartmentDiv = document.createElement('div');
								apartmentDiv.classList.add('apartment');
								apartmentDiv.textContent = apartment.apartment_number;

								if (apartment.isOccupied) {
									apartmentDiv.classList.add('occupied');
									apartmentDiv.addEventListener('click', (e) => toggleTooltip(e, apartment.ResidentApartments));
								}

								floorDiv.appendChild(apartmentDiv);
							});
				}

				entranceDiv.appendChild(floorDiv);
			}

			const entranceLabel = document.createElement('div');
			entranceLabel.classList.add('entrance-label');
			entranceLabel.textContent = `Подъезд № ${entrance.entrance_number}`;

			entranceWrapper.appendChild(entranceDiv);
			entranceWrapper.appendChild(entranceLabel);

			chessboard.appendChild(entranceWrapper);
		});

		// Генерация паркинга
		if (house.Parkings.length > 0) {
		// 1) Сортируем уровни, чтобы сверху был -1, затем -2, -3 ...
		const parkingsSorted = [...house.Parkings].sort(
			(a, b) => Number(b.level) - Number(a.level)
		);

		// 2) Сквозная нумерация мест по всем уровням
		let spotCounter = 1;

		parkingsSorted.forEach((parkingLevel) => {
			const parkingLevelDiv = document.createElement('div');
			parkingLevelDiv.classList.add('parking-level');

			const parkingTitle = document.createElement('h3');
			parkingTitle.textContent = `Уровень ${parkingLevel.level}`;
			parkingLevelDiv.appendChild(parkingTitle);

			const parkingGrid = document.createElement('div');
			parkingGrid.classList.add('parking-grid');

			for (let i = 1; i <= parkingLevel.spots_count; i++) {
				const globalSpotNumber = spotCounter; // глобальный номер по дому
				const spotDiv = document.createElement('div');
				spotDiv.classList.add('parking-spot');
				spotDiv.textContent = globalSpotNumber;

				// Проверка занятости: сравниваем с глобальным номером
				if (parkingLevel.ResidentParkings?.some((rp) => Number(rp.spot_number) === globalSpotNumber)) {
				spotDiv.classList.add('occupied');
				spotDiv.addEventListener('click', (e) => {
					const residentsHere = parkingLevel.ResidentParkings.filter(
						(rp) => Number(rp.spot_number) === globalSpotNumber
					);
					toggleTooltip(e, residentsHere);
				});
				} else {
				// Свободное место — кликом открываем модалку добавления жильца с уже подставленным номером
				spotDiv.addEventListener('click', function () {
					openAddResidentModal('parking', String(globalSpotNumber));
				});
				}

				parkingGrid.appendChild(spotDiv);
				spotCounter++; // двигаем сквозной счётчик
			}

			parkingLevelDiv.appendChild(parkingGrid);
			parkingSection.appendChild(parkingLevelDiv);
		});
		} else {
		// Если паркинга нет — убираем заголовок и секцию
		parkingSection.previousElementSibling?.remove();
		parkingSection.remove();
		}

		// Генерация кладовых
		if (house.StorageUnits.length > 0) {
		// 1) Сортируем уровни, чтобы сверху был -1, затем -2, -3 ...
		const storagesSorted = [...house.StorageUnits].sort(
			(a, b) => Number(b.level) - Number(a.level)
		);

		// 2) Сквозная нумерация кладовых по всем уровням
		let storageCounter = 1;

		storagesSorted.forEach((storageLevel) => {
			const storageLevelDiv = document.createElement('div');
			storageLevelDiv.classList.add('storage-level');

			const storageTitle = document.createElement('h3');
			storageTitle.textContent = `Уровень ${storageLevel.level}`;
			storageLevelDiv.appendChild(storageTitle);

			const storageGrid = document.createElement('div');
			storageGrid.classList.add('storage-grid');

			for (let i = 1; i <= storageLevel.units_count; i++) {
				const globalUnitNumber = storageCounter; // глобальный номер по дому
				const unitDiv = document.createElement('div');
				unitDiv.classList.add('storage-unit');
				unitDiv.textContent = globalUnitNumber;

				// Проверка занятости: сравниваем с глобальным номером
				if (storageLevel.ResidentStorages?.some((rs) => Number(rs.unit_number) === globalUnitNumber)) {
				unitDiv.classList.add('occupied');
				unitDiv.addEventListener('click', (e) => {
					const residentsHere = storageLevel.ResidentStorages.filter(
						(rs) => Number(rs.unit_number) === globalUnitNumber
					);
					toggleTooltip(e, residentsHere);
				});
				} else {
				// Свободная кладовая — открываем модалку добавления жильца с глобальным номером
				unitDiv.addEventListener('click', function () {
					openAddResidentModal('storage', String(globalUnitNumber));
				});
				}

				storageGrid.appendChild(unitDiv);
				storageCounter++; // двигаем сквозной счётчик
			}

			storageLevelDiv.appendChild(storageGrid);
			storagesSection.appendChild(storageLevelDiv);
		});
		} else {
		// Если кладовых нет — убираем заголовок и секцию
		storagesSection.previousElementSibling?.remove();
		storagesSection.remove();
		}

		document.querySelectorAll('.apartment:not(.occupied)').forEach(apartment => {
			apartment.addEventListener('click', function () {
				openAddResidentModal('apartment', this.textContent.trim());
			});
	});
	
	document.querySelectorAll('.parking-spot:not(.occupied)').forEach(spot => {
			spot.addEventListener('click', function () {
				openAddResidentModal('parking', this.textContent.trim());
			});
	});
	
	document.querySelectorAll('.storage-unit:not(.occupied)').forEach(unit => {
			unit.addEventListener('click', function () {
				openAddResidentModal('storage', this.textContent.trim());
			});
	});
	
	// Функция открытия модального окна с предварительным заполнением данных
	function openAddResidentModal(type, number) {
			const modal = document.getElementById('addResidentModal');
			modal.style.display = 'flex';
	
			const form = document.getElementById('addResidentForm');
			form.reset();
	
			const houseId = new URLSearchParams(window.location.search).get('id');
			form.dataset.houseId = houseId;
	
			if (type === 'apartment') {
				form.querySelector('input[name="apartments[]"]').value = number;
			} else if (type === 'parking') {
				form.querySelector('input[name="parking[]"]').value = number;
			} else if (type === 'storage') {
				form.querySelector('input[name="storages[]"]').value = number;
			}
	}
	} catch (error) {
		console.error('Ошибка загрузки данных дома:', error);
		chessboard.textContent = 'Ошибка загрузки данных';
	}
});

// Переменная для отслеживания состояния окна
let isTooltipOpen = false;

// Закрытие всплывающего окна при клике вне него
document.addEventListener('click', (event) => {
	const tooltip = document.getElementById('tooltip');
	const isTargetInsideTooltip = tooltip.contains(event.target);
	const isTargetInteractive = event.target.classList.contains('apartment') ||
										event.target.classList.contains('parking-spot') ||
										event.target.classList.contains('storage-unit');

	if (isTooltipOpen && !isTargetInsideTooltip && !isTargetInteractive) {
		tooltip.classList.remove('visible');
		tooltip.classList.add('hidden');
		isTooltipOpen = false;
	}
});

// Функция для отображения/скрытия всплывающего окна
function toggleTooltip(event, residents) {
const tooltip = document.getElementById('tooltip');

// Локальная маска: буквы/цифры -> '*', пунктуация/пробелы остаются
const mask = (v) => String(v || '').replace(/[0-9A-Za-zА-Яа-яЁё]/g, '*');

// Рендер одного жильца с учётом privacy
function renderResidentBlock(link, privacy) {
	if (!link || !link.Resident) return '<p>Данные о жильце отсутствуют</p>';

	const residentId = link.Resident.id ?? null;
	const relationType =
		('spot_number' in link) ? 'parking' :
		('unit_number' in link) ? 'storage' : 'apartment';
	const relationId = link.id;

	const showFullName = privacy?.show_full_name !== false;
	const showPhone    = privacy?.show_phone     !== false;
	const showEmail    = privacy?.show_email     !== false;
	const showTelegram = privacy?.show_telegram  !== false;

	const fullName = link.Resident.full_name || '';
	const phone    = link.Resident.phone     || '';
	const email    = link.Resident.email     || '';
	const telegram = link.Resident.telegram  || '';

	const fullNameOut = showFullName ? fullName : mask(fullName);
	const phoneOut    = showPhone    ? phone    : mask(phone);
	const emailOut    = showEmail    ? email    : mask(email);
	const telegramOut = showTelegram ? telegram : mask(telegram);

	return `
		<div class="resident-block" data-resident-id="${residentId}">
		<p><strong>Имя:</strong> ${fullNameOut || 'Не указано'}</p>

		<div class="resident-actions">
			<button class="edit-resident" data-id="${residentId}" title="Редактировать">✏️</button>
			<button class="delete-resident"
						data-id="${residentId}"
						data-relation="${relationType}"
						data-relation-id="${relationId}"
						title="Отвязать жильца от этого объекта">Отвязать</button>
		</div>

		${phone    ? `<p><strong>Телефон:</strong> ${phoneOut}</p>`     : ''}
		${email    ? `<p><strong>Email:</strong> ${emailOut}</p>`       : ''}
		${telegram ? `<p><strong>Telegram:</strong> ${telegramOut}</p>` : ''}
		</div>
	`;
}

// Если уже открыто — закрываем
if (isTooltipOpen) {
	tooltip.classList.remove('visible');
	tooltip.classList.add('hidden');
	isTooltipOpen = false;
	return;
}

tooltip.classList.remove('hidden');

if (!Array.isArray(residents) || residents.length === 0) {
	tooltip.innerHTML = '<p>Нет данных о жильцах</p>';
} else {
	// 1) Сначала рендерим по тем данным, что уже пришли из /structure
	tooltip.innerHTML = residents.map((link) => {
		const p = (link?.Resident && link.Resident.privacy) || null;
		return renderResidentBlock(link, p);
	}).join('');

	// 2) Для тех, у кого privacy нет или он пустой — дотягиваем и точечно перерисовываем
	residents.forEach(async (link) => {
		const residentId = link?.Resident?.id;
		if (!residentId) return;

		const p = link?.Resident?.privacy;
		const hasPrivacy = p && Object.keys(p).length > 0;

		if (!hasPrivacy) {
		try {
			const resp = await fetch(`http://localhost:5000/api/residents/${residentId}`);
			if (!resp.ok) return;
			const data = await resp.json();
			const fresh = data?.privacy;
			if (fresh) {
				const block = tooltip.querySelector(`.resident-block[data-resident-id="${residentId}"]`);
				if (block) block.outerHTML = renderResidentBlock(link, fresh);
			}
		} catch (e) {
			// молча игнорируем сетевые ошибки — просто оставим как есть
			console.warn('Не удалось дотянуть privacy для жильца', residentId, e);
		}
		}
	});
}

// Позиция и показ
tooltip.style.left = `${event.pageX + 10}px`;
tooltip.style.top  = `${event.pageY + 10}px`;
tooltip.classList.add('visible');
isTooltipOpen = true;
}

// Вызов toggleTooltip для квартир, парковки и кладовых
document.querySelectorAll('.occupied').forEach(element => {
	element.addEventListener('click', (event) => {
		const residents = element.dataset.residents ? JSON.parse(element.dataset.residents) : [];
		toggleTooltip(event, residents);
	});
});

//обработчик на кнопку "Редактировать жильца"
document.addEventListener('click', (e) => {
if (e.target.classList.contains('edit-resident')) {
	e.stopPropagation();
	const residentId = e.target.dataset.id;
	openEditResidentModal(residentId); // ✅ setPrivacyToModal вызовем внутри самой функции после загрузки данных
}
});

document.addEventListener('click', async (e) => {
if (!e.target.classList.contains('delete-resident')) return;

const residentId  = e.target.dataset.id;           // id жильца
const relation    = e.target.dataset.relation;     // 'apartment' | 'parking' | 'storage'
const relationId  = e.target.dataset.relationId;   // id строки связи (Resident* id)

if (!residentId || !relation || !relationId) {
	alert('Не удалось определить связь для отвязки (нет необходимых параметров).');
	console.error('delete-resident click -> missing data:', { residentId, relation, relationId });
	return;
}

if (!confirm('Отвязать жильца от этого объекта?')) return;

try {
	const response = await fetch(`http://localhost:5000/api/residents/${residentId}/link`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ relation, relation_id: Number(relationId) })
	});

	if (response.ok) {
		alert('Жилец отвязан от объекта.');
		location.reload();
	} else {
		const error = await response.json().catch(() => ({}));
		alert(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
	}
} catch (err) {
	console.error('Ошибка отвязки жильца:', err);
	alert('Ошибка подключения к серверу.');
}
});

const openEditResidentModal = async (residentId) => {
	try {
		const response = await fetch(`http://localhost:5000/api/residents/${residentId}`);
		if (!response.ok) {
			throw new Error('Ошибка загрузки данных жильца.');
		}

		const residentData = await response.json();
		// Проверка наличия house_id
		if (!residentData.house_id) {
			console.error('house_id отсутствует в данных жильца:', residentData);
			alert('Ошибка: Идентификатор дома отсутствует у жильца.');
			return;
	}
		const form = document.getElementById('editResidentForm');
		if (!form) {
			console.error('Форма для редактирования жильца не найдена.');
			return;
		}

		// Заполняем форму данными жильца
		form.dataset.residentId = residentId;
		form.dataset.houseId = residentData.house_id;
		document.getElementById('residentFullName').value = residentData.full_name || '';
		document.getElementById('residentTelegram').value = residentData.telegram || '';
		document.getElementById('residentPhone').value = residentData.phone || '';
		document.getElementById('residentEmail').value = residentData.email || '';

		setPrivacyToModal(document.getElementById('editResidentModal'), residentData.privacy || {});

		// Берём контейнеры ИМЕННО из модалки редактирования
		const editResidentModalEl = document.getElementById('editResidentModal');
		const apartmentContainer = editResidentModalEl.querySelector('#apartmentContainer');
		const parkingContainer   = editResidentModalEl.querySelector('#parkingContainer');
		const storageContainer   = editResidentModalEl.querySelector('#storageContainer');


		const resetContainer = (container, labelText) => {
		// Страховка: корректный элемент?
		if (!container || !(container instanceof HTMLElement)) {
			console.error('❌ Некорректный контейнер для resetContainer:', container);
			return;
		}

		// Полная очистка
		container.innerHTML = '';

		// Лейбл сверху
		const label = document.createElement('label');
		label.textContent = labelText;
		container.appendChild(label);

		// Кнопка "Добавить" в зависимости от контейнера
		if (container.id === 'apartmentContainer') {
			const addButton = document.createElement('button');
			addButton.type = 'button';
			addButton.id = 'addApartmentField';
			addButton.textContent = 'Добавить квартиру';
			container.appendChild(addButton);

			addButton.onclick = function () {
				const newField = document.createElement('div');
				newField.classList.add('apartment-input');
				newField.innerHTML = `
				<input type="text" name="apartments[]" placeholder="Введите номер квартиры">
				<label><input type="checkbox" name="tenant[]"> Арендатор</label>
				<button type="button" class="remove-field">Удалить</button>
				`;
				container.appendChild(newField);
			};
		}

		if (container.id === 'parkingContainer') {
			const addButton = document.createElement('button');
			addButton.type = 'button';
			addButton.id = 'addParkingField';
			addButton.textContent = 'Добавить парковочное место';
			container.appendChild(addButton);

			addButton.onclick = function () {
				const newField = document.createElement('div');
				newField.classList.add('parking-input');
				newField.innerHTML = `
				<input type="text" name="parking[]" placeholder="Введите номер парковки">
				<label><input type="checkbox" name="parkingTenant[]"> Арендатор</label>
				<button type="button" class="remove-field">Удалить</button>
				`;
				container.appendChild(newField);
			};
		}

		if (container.id === 'storageContainer') {
			const addButton = document.createElement('button');
			addButton.type = 'button';
			addButton.id = 'addStorageField';
			addButton.textContent = 'Добавить кладовую';
			container.appendChild(addButton);

			addButton.onclick = function () {
				const newField = document.createElement('div');
				newField.classList.add('storage-input');
				newField.innerHTML = `
				<input type="text" name="storages[]" placeholder="Введите номер кладовой">
				<label><input type="checkbox" name="storageTenant[]"> Арендатор</label>
				<button type="button" class="remove-field">Удалить</button>
				`;
				container.appendChild(newField);
			};
		}
		};

		// Сбрасываем контейнеры с сохранением лейблов
		resetContainer(apartmentContainer, 'Квартиры');
		resetContainer(parkingContainer, 'Парковочные места');
		resetContainer(storageContainer, 'Кладовые');

		// Добавляем квартиры
		residentData.apartments.forEach((apartment) => {
			const newField = document.createElement('div');
			newField.classList.add('apartment-input');
			newField.innerHTML = `
					<input type="text" name="apartments[]" value="${apartment.number}" placeholder="Введите номер квартиры">
					<label>
						<input type="checkbox" name="tenant[]" ${apartment.tenant ? 'checked' : ''}> Арендатор
					</label>
					<button type="button" class="remove-field">Удалить</button>
			`;
			apartmentContainer.appendChild(newField);
		});

		// Добавляем парковки
		residentData.parking.forEach((spot) => {
			const newField = document.createElement('div');
			newField.classList.add('parking-input');
			newField.innerHTML = `
					<input type="text" name="parking[]" value="${spot.number}" placeholder="Введите номер парковки">
					<label>
						<input type="checkbox" name="parkingTenant[]" ${spot.tenant ? 'checked' : ''}> Арендатор
					</label>
					<button type="button" class="remove-field">Удалить</button>
			`;
			parkingContainer.appendChild(newField);
		});

		// Добавляем кладовые
		residentData.storages.forEach((unit) => {
			const newField = document.createElement('div');
			newField.classList.add('storage-input');
			newField.innerHTML = `
					<input type="text" name="storages[]" value="${unit.number}" placeholder="Введите номер кладовой">
					<label>
						<input type="checkbox" name="storageTenant[]" ${unit.tenant ? 'checked' : ''}> Арендатор
					</label>
					<button type="button" class="remove-field">Удалить</button>
			`;
			storageContainer.appendChild(newField);
		});

		// Показ модального окна
		document.getElementById('editResidentModal').style.display = 'flex';
		document.querySelector('#editResidentModal h2').textContent = 'Редактировать жильца';
	} catch (error) {
		console.error(error);
		alert('Ошибка загрузки данных жильца.');
	}
};

document.addEventListener('click', function (e) {
	if (e.target && e.target.classList.contains('remove-field')) {
		e.target.parentElement.remove(); // Удаляем родительский div
	}
});

// Обработка сохранения изменений жильца
document.getElementById('editResidentForm').addEventListener('submit', async function (e) {
	e.preventDefault(); // Предотвращает стандартное поведение формы

	const form = e.target;
	const residentId = form.dataset.residentId; // Получаем ID жильца
	const houseId = form.dataset.houseId; // Получаем ID дома (добавлено!)

	if (!houseId) {
		alert('Идентификатор дома отсутствует.');
		return;
	}

	const formData = new FormData(form); // Собираем данные формы
	const data = {
		full_name: formData.get('full_name'),
		telegram: formData.get('telegram') || null,
		phone: formData.get('phone') || null,
		email: formData.get('email') || null,
		house_id: houseId, // Добавляем house_id (добавлено!)
		apartments: [],
		parking: [],
		storages: [],
		privacy: getPrivacyFromModal(document.getElementById('editResidentModal'))
	};

	// Собираем квартиры
	form.querySelectorAll('input[name="apartments[]"]').forEach((input, index) => {
		const tenantCheckbox = form.querySelectorAll('input[name="tenant[]"]')[index];
		data.apartments.push({
			number: input.value,
			tenant: tenantCheckbox.checked,
		});
	});

	// Собираем парковки
	form.querySelectorAll('input[name="parking[]"]').forEach((input, index) => {
		const tenantCheckbox = form.querySelectorAll('input[name="parkingTenant[]"]')[index];
		data.parking.push({
			number: input.value,
			tenant: tenantCheckbox.checked,
		});
	});

	// Собираем кладовые
	form.querySelectorAll('input[name="storages[]"]').forEach((input, index) => {
		const tenantCheckbox = form.querySelectorAll('input[name="storageTenant[]"]')[index];
		data.storages.push({
			number: input.value,
			tenant: tenantCheckbox.checked,
		});
	});

	console.log('Данные перед отправкой:', JSON.stringify(data, null, 2)); // Лог перед отправкой

	try {
		const response = await fetch(`http://localhost:5000/api/residents/${residentId}`, {
			method: 'PUT',
			headers: {
					'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});

		if (response.ok) {
			alert('Жилец успешно обновлён.');
			form.reset();
			document.getElementById('editResidentModal').style.display = 'none';
			location.reload(); // Перезагружаем страницу для обновления данных
		} else {
			const error = await response.json();
			alert(`Ошибка: ${error.message}`);
		}
	} catch (error) {
		console.error('Ошибка сохранения изменений:', error);
		alert('Ошибка подключения к серверу.');
	}
});

// Закрытие модального окна
document.querySelector('#editResidentModal .close').addEventListener('click', () => {
	document.getElementById('editResidentModal').style.display = 'none';
});

// Функция добавления нового поля (апартаменты, парковка, кладовая) НАД кнопкой
function addField(containerId, inputName, checkboxName, placeholder) {
	const container = document.querySelector(`#addResidentModal #${containerId}`);
	if (!container) {
		console.error(`❌ Ошибка: Контейнер ${containerId} не найден.`);
		return;
	}

	const newField = document.createElement('div');
	newField.classList.add('dynamic-field'); // Добавляем класс, чтобы было удобнее искать
	newField.innerHTML = `
		<input type="text" name="${inputName}[]" placeholder="${placeholder}">
		<label>
			<input type="checkbox" name="${checkboxName}[]"> Арендатор
		</label>
		<button type="button" class="remove-field">Удалить</button>
	`;

	// Теперь находим кнопку "Добавить" ВНУТРИ ЭТОГО КОНТЕЙНЕРА
	const addButton = container.querySelector(`button[id^="add"]`);

	// Проверяем, что кнопка найдена и находится внутри текущего контейнера
	if (addButton && container.contains(addButton)) {
		container.insertBefore(newField, addButton); // Вставляем перед кнопкой
	} else {
		container.appendChild(newField); // Если кнопка не найдена, добавляем поле в конец контейнера
		console.warn(`⚠️ Внимание: Кнопка 'Добавить' не найдена в ${containerId}, поле добавлено в конец`);
	}
}

// Обработчик кликов на кнопки "Добавить"
document.getElementById('addResidentModal').addEventListener('click', function (event) {
	if (event.target.id === 'addApartmentField') {
		addField('apartmentContainer', 'apartments', 'tenant', 'Введите номер квартиры');
	}
	if (event.target.id === 'addParkingField') {
		addField('parkingContainer', 'parking', 'parkingTenant', 'Введите номер парковки');
	}
	if (event.target.id === 'addStorageField') {
		addField('storageContainer', 'storages', 'storageTenant', 'Введите номер кладовой');
	}
});

// Функция открытия модального окна добавления жильца
function openAddResidentModal(type, number) {
	const modal = document.getElementById('addResidentModal');
	modal.style.display = 'flex';

	const form = document.getElementById('addResidentForm');
	form.reset();

	const houseId = new URLSearchParams(window.location.search).get('id');
	form.dataset.houseId = houseId;

	if (type === 'apartment') {
		form.querySelector('input[name="apartments[]"]').value = number;
	} else if (type === 'parking') {
		form.querySelector('input[name="parking[]"]').value = number;
	} else if (type === 'storage') {
		form.querySelector('input[name="storages[]"]').value = number;
	}
}

// Обработчик для отправки формы "Добавить жильца"
document.getElementById('addResidentForm').onsubmit = async function (e) {
	e.preventDefault();

	const formData = new FormData(this);
	const houseId = this.dataset.houseId;

	const data = {
		full_name: formData.get('full_name'),
		telegram: formData.get('telegram') || null,
		phone: formData.get('phone') || null,
		email: formData.get('email') || null,
		apartments: [],
		parking: [],
		storages: [],
		privacy: getPrivacyFromModal(document.getElementById('addResidentModal'))
	};

	// **Фильтруем пустые значения перед отправкой**
	document.querySelectorAll('input[name="apartments[]"]').forEach((input, index) => {
		const value = input.value.trim();
		if (value && !isNaN(value)) { // Если значение не пустое и это число
			data.apartments.push({
					number: parseInt(value, 10), // Преобразуем в число
					tenant: document.querySelectorAll('input[name="tenant[]"]')[index].checked
			});
		}
	});

	document.querySelectorAll('input[name="parking[]"]').forEach((input, index) => {
		const value = input.value.trim();
		if (value && !isNaN(value)) {
			data.parking.push({
					number: parseInt(value, 10),
					tenant: document.querySelectorAll('input[name="parkingTenant[]"]')[index].checked
			});
		}
	});

	document.querySelectorAll('input[name="storages[]"]').forEach((input, index) => {
		const value = input.value.trim();
		if (value && !isNaN(value)) {
			data.storages.push({
					number: parseInt(value, 10),
					tenant: document.querySelectorAll('input[name="storageTenant[]"]')[index].checked
			});
		}
	});

	console.log("📤 Отправляем данные:", JSON.stringify(data, null, 2));

	try {
		const response = await fetch(`http://localhost:5000/api/houses/${houseId}/residents`, {
			method: 'POST',
			headers: {
					'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (response.ok) {
			alert('Жилец успешно добавлен!');
			this.reset();
			document.getElementById('addResidentModal').style.display = 'none';
			location.reload(); // Перезагрузка страницы для обновления данных
		} else {
			const error = await response.json();
			alert(`Ошибка: ${error.message}`);
		}
	} catch (error) {
		console.error('Ошибка сети:', error);
		alert('Ошибка подключения к серверу.');
	}
};

// Обработчик для удаления динамических полей
document.addEventListener('click', function (event) {
	if (event.target.classList.contains('remove-field')) {
		event.target.parentElement.remove();
	}
});

// Функция сброса формы перед закрытием модального окна
function resetAddResidentForm() {
	const form = document.getElementById('addResidentForm');
	form.reset(); // Очищаем стандартные поля

	// Удаляем все динамически добавленные поля (квартиры, парковки, кладовые)
	document.querySelectorAll('#apartmentContainer .dynamic-field').forEach(field => field.remove());
	document.querySelectorAll('#parkingContainer .dynamic-field').forEach(field => field.remove());
	document.querySelectorAll('#storageContainer .dynamic-field').forEach(field => field.remove());

	console.log('🔄 Форма сброшена и очищены динамические поля.');
}

// Закрытие модального окна + сброс формы
document.querySelector('#addResidentModal .close').addEventListener('click', () => {
	document.getElementById('addResidentModal').style.display = 'none';
	resetAddResidentForm();
});

// Закрытие модального окна при клике вне него + сброс формы
window.addEventListener('click', (event) => {
	const modal = document.getElementById('addResidentModal');
	if (event.target === modal) {
		modal.style.display = 'none';
		resetAddResidentForm();
	}
});
