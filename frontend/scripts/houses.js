	/**
	 * Domus — Страница Домов (Tabler).
	 * - Карточки с футером (экшены) и бейджем "Жильцов" поверх фото.
	 * - Прогрессы заселённости по уникальным помещениям (апартаменты/парковка/кладовые).
	 * - Модалки: bootstrap.Modal (Tabler JS уже подключён).
	 */

	const n0 = (v) => Number.isFinite(+v) ? +v : 0;
	const pct = (num, den) => {
	const d = n0(den);
	if (d <= 0) return 0;
	const p = Math.round(n0(num) * 100 / d);
	return Math.max(0, Math.min(100, p));
	};
	const fmt = (x, y) => `${n0(x)}/${n0(y)} (${pct(x, y)}%)`;

	/**
	 * Инициализирует иконки-переключатели приватности в модалке.
	 * При нажатии меняет aria-pressed и иконку (eye <-> eye-off).
	 * @param {HTMLElement} modalEl - корневой элемент модалки
	 */
	function initPrivacyIconToggles(modalEl) {
	if (!modalEl) return;
	modalEl.querySelectorAll('.privacy-toggle').forEach(btn => {
		/** Переключить состояние и обновить иконку/подсказку */
		const updateIcon = (on) => {
			btn.setAttribute('aria-pressed', String(on));
			btn.innerHTML = `<i class="ti ${on ? 'ti-eye' : 'ti-eye-off'}"></i>`;
			btn.title = on ? 'Показывать в шахматке' : 'Скрывать в шахматке';
		};
		// начальное состояние уже стоит aria-pressed="true"
		btn.addEventListener('click', () => {
			const isOn = btn.getAttribute('aria-pressed') === 'true';
			updateIcon(!isOn);
		});
	});
	}

	/**
	 * Возвращает, включён ли показ поля в шахматке по ключу ('name'|'phone'|'email'|'telegram').
	 * @param {string} key
	 * @returns {boolean}
	 */
	function isPrivacyOn(key) {
	const btn = document.querySelector(`#addResidentModal .privacy-toggle[data-target="${key}"]`);
	return btn ? (btn.getAttribute('aria-pressed') === 'true') : true;
	}


		/**
	 * Считает количество уникальных значений в МАССИВЕ ОБЪЕКТОВ по одному из указанных свойств.
	 * Подходит для паркинга/кладовых: { spot_number }, { unit_number } и т.п.
	 * @param {object} obj       - объект-источник (дом)
	 * @param {string[]} srcKeys - возможные имена полей-источников (массивы объектов)
	 * @param {string[]} propKeys- возможные имена свойства внутри элемента массива
	 * @returns {number|null}    - размер множества или null, если источник не найден
	 */
	function uniqueObjectSetCount(obj, srcKeys, propKeys) {
	for (const sk of srcKeys) {
		const arr = obj?.[sk];
		if (Array.isArray(arr) && arr.length) {
			const set = new Set();
			for (const it of arr) {
			if (it && typeof it === 'object') {
				for (const pk of propKeys) {
					const val = it[pk];
					if (val !== undefined && val !== null && String(val).trim() !== '') {
					set.add(String(val).trim());
					break; // взяли первое подходящее свойство
					}
				}
			}
			}
			return set.size;
		}
	}
	return null;
	}

	/**
	 * Считает количество уникальных значений в МАССИВЕ ПРИМИТИВОВ или СТРОКЕ с разделителями.
	 * Подходит для квартир, если приходит список номеров типа [ '12', '15', ... ] или "12, 15, ...".
	 * @param {object} obj
	 * @param {string[]} keys
	 * @returns {number|null}
	 */
	function uniquePrimitiveSetCount(obj, keys) {
	for (const k of keys) {
		const v = obj?.[k];
		if (Array.isArray(v) && v.length) {
			return new Set(v.map(x => String(x).trim()).filter(Boolean)).size;
		}
		if (typeof v === 'string' && v.trim()) {
			return new Set(v.split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean)).size;
		}
	}
	return null;
	}


	const HOUSE_BY_ID = new Map();

	/** Рендер одной карточки Tabler */
	function renderHouseCard(h) {
	const id = h.id;
	HOUSE_BY_ID.set(String(id), h);

	// Фото или плейсхолдер
	const img = (h.photo_url || h.photoUrl || '').trim() || '/assets/house-placeholder.svg';

	// Жильцы — только общий бейдж (перенесено с тела)
	const residents = n0(h.totalResidents);

	// --- Квартиры
	const totalA = n0(h.totalApartments);
	const occAUnique = uniquePrimitiveSetCount(h, [
	'occupiedApartmentNumbers', 'apartmentOccupiedNumbers', 'apartments_occupied_numbers'
	]);
	const occA = occAUnique ?? n0(h.occupiedApartments);
	const pA = pct(occA, totalA);

	// --- Паркинг: считаем УНИКАЛЬНЫЕ места (spot_number)
	const totalP = n0(h.totalParkingSpots);
	// Сначала пробуем массивы ОБЪЕКТОВ с полями места:
	// пример ожидаемых полей-источников: parkingAssignments, parking, parking_places, parkingPlaces
	// внутри элемента ищем одно из свойств: spot_number / spotNumber / number / place_number
	const occPUnique =
	uniqueObjectSetCount(h, ['parkingAssignments','parking','parking_places','parkingPlaces'], ['spot_number','spotNumber','number','place_number'])
	// если сервер отдаёт примитивные списки номеров — считаем по ним
	?? uniquePrimitiveSetCount(h, ['occupiedParkingSpotNumbers','parkingOccupiedNumbers','parking_spots_occupied']);

	const occP = occPUnique ?? n0(h.occupiedParking); // Fallback на агрегат, если ничего не нашли
	const pP = pct(occP, totalP);

	// --- Кладовые: считаем УНИКАЛЬНЫЕ помещения (unit_number)
	const totalS = n0(h.totalStorages);
	// ожидаемые поля-источники: storageAssignments, storages, storage_units, storageUnits
	// внутри элемента: unit_number / unitNumber / number
	const occSUnique =
	uniqueObjectSetCount(h, ['storageAssignments','storages','storage_units','storageUnits'], ['unit_number','unitNumber','number'])
	?? uniquePrimitiveSetCount(h, ['occupiedStorageUnitNumbers','storageOccupiedNumbers','storage_units_occupied']);

	const occS = occSUnique ?? n0(h.occupiedStorages);
	const pS = pct(occS, totalS);

	const col = document.createElement('div');
	col.className = 'col-12 col-md-6 col-lg-4 house-card';

	col.innerHTML = `
		<div class="card" data-id="${id}">
			<!-- Фото -->
			<div class="card-img-top">
			<div class="ratio ratio-16x9 bg-muted">
				<img class="img-cover" src="${img}" alt="Фото дома" onerror="this.src='/assets/house-placeholder.svg'" />
			</div>
			</div>

			<div class="card-body">
			<!-- Новая верхняя строка: слева — жильцы, справа — действия -->
			<div class="d-flex justify-content-between align-items-center">
				<span class="badge bg-azure text-blue-fg"><i class="ti ti-users me-1"></i>${residents}</span>
				<div class="btn-list">
					<button class="btn btn-outline-primary btn-sm add-resident" data-id="${id}" title="Добавить жильца">
					<i class="ti ti-user-plus"></i>
					</button>
					<button class="btn btn-outline-secondary btn-sm edit-house" data-id="${id}" title="Редактировать дом">
					<i class="ti ti-edit"></i>
					</button>
					<button class="btn btn-outline-danger btn-sm delete-house" data-id="${id}" title="Удалить дом">
					<i class="ti ti-trash"></i>
					</button>
				</div>
			</div>

			<!-- Адрес и название ниже, как просили -->
			<div class="mt-2 mb-1 text-secondary">${h.address || '—'}</div>
			<h3 class="card-title">${h.name || ('Дом #' + id)}</h3>

			<!-- Метрики -->
			<div class="mt-3">
				<div class="d-block mb-1 small text-secondary">Квартиры: ${fmt(occA, totalA)}</div>
				<div class="progress">
					<div class="progress-bar" style="width:${pA}%;" aria-valuenow="${pA}" aria-valuemin="0" aria-valuemax="100"></div>
				</div>

				${totalP > 0 ? `
				<div class="d-block mt-2 mb-1 small text-secondary">Паркинг: ${fmt(occP, totalP)}</div>
				<div class="progress progress-sm">
					<div class="progress-bar bg-green" style="width:${pP}%;" aria-valuenow="${pP}" aria-valuemin="0" aria-valuemax="100"></div>
				</div>` : ''}

				${totalS > 0 ? `
				<div class="d-block mt-2 mb-1 small text-secondary">Кладовые: ${fmt(occS, totalS)}</div>
				<div class="progress progress-sm">
					<div class="progress-bar bg-yellow" style="width:${pS}%;" aria-valuenow="${pS}" aria-valuemin="0" aria-valuemax="100"></div>
				</div>` : ''}
			</div>
			</div>

			<!-- Футер — только кнопка "Открыть" -->
			<div class="card-footer d-flex align-items-center justify-content-end">
			<a class="btn btn-primary btn-sm open-visual" data-id="${id}" title="Визуализация">
				Открыть <i class="ti ti-login-2 ms-1"></i>
			</a>
			</div>
		</div>
	`;
	return col;
	}

	/** Поиск по карточкам */
	function initHouseSearch(input) {
	if (!input) return;
	input.addEventListener('input', () => {
		const q = input.value.trim().toLowerCase();
		document.querySelectorAll('.house-card').forEach(card => {
			const text = (card.innerText || card.textContent || '').toLowerCase();
			card.style.display = text.includes(q) ? '' : 'none';
		});
	});
	}

	/** Bootstrap modal helpers */
	function getModal(el) {
	const M = window.bootstrap?.Modal || bootstrap.Modal;
	return new M(el);
	}

	document.addEventListener('DOMContentLoaded', async () => {
	const container = document.getElementById('housesContainer');

	// Поиск
	initHouseSearch(document.getElementById('searchHouse'));

	// Модалки
	const houseModalEl = document.getElementById('houseModal');
	const editModalEl = document.getElementById('editModal');
	const addResidentModalEl = document.getElementById('addResidentModal');
	const houseModal = houseModalEl ? getModal(houseModalEl) : null;
	const editModal = editModalEl ? getModal(editModalEl) : null;
	const addResidentModal = addResidentModalEl ? getModal(addResidentModalEl) : null;
	initPrivacyIconToggles(addResidentModalEl);

	// Кнопка "Добавить дом"
	document.getElementById('openModal')?.addEventListener('click', (e) => {
		e.preventDefault(); houseModal?.show();
	});

	try {
		const r = await fetch(`${window.DOMUS_API_BASE_URL}/houses`);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		const houses = await r.json();

		if (!houses?.length) {
			container.innerHTML = `<div class="empty">
			<div class="empty-icon"><i class="ti ti-building-skyscraper"></i></div>
			<p class="empty-title">Дома не найдены</p>
			<p class="empty-subtitle text-secondary">Добавьте первый дом — это займёт минуту.</p>
			<div class="empty-action">
				<a href="#" class="btn btn-primary" id="openModalEmpty"><i class="ti ti-plus"></i> Добавить дом</a>
			</div>
			</div>`;
			document.getElementById('openModalEmpty')?.addEventListener('click', (e) => {
			e.preventDefault(); houseModal?.show();
			});
			return;
		}

		const frag = document.createDocumentFragment();
		houses.forEach(h => frag.appendChild(renderHouseCard(h)));
		container.replaceChildren(frag);

	} catch (e) {
		console.error(e);
		container.innerHTML = '<div class="alert alert-danger" role="alert">Ошибка загрузки данных</div>';
	}

	/** Делегирование событий: переход/экшены/модалки */
	container.addEventListener('click', async (e) => {
		const card = e.target.closest('.card[data-id]');
		const id = card?.getAttribute('data-id');

		// Открыть визуализацию
		if (e.target.closest('.open-visual')) {
			location.href = `house-visualization.html?id=${encodeURIComponent(id)}`;
			return;
		}

		// Добавить жильца
		if (e.target.closest('.add-resident')) {
			const form = document.getElementById('addResidentForm');
			if (form) form.dataset.houseId = id;
			addResidentModal?.show();
			return;
		}

		// Редактировать
		if (e.target.closest('.edit-house')) {
			const h = HOUSE_BY_ID.get(String(id)) || {};
			document.getElementById('editName').value = h.name || '';
			document.getElementById('editAddress').value = h.address || '';
			editModal?.show();
			editModalEl.dataset.houseId = id;
			return;
		}

		// Удалить
		if (e.target.closest('.delete-house')) {
			const ok = typeof confirmDialog === 'function'
			? await confirmDialog('Удалить дом?', 'Данные будут удалены без возможности восстановления.', 'Удалить', 'Отмена')
			: window.confirm('Удалить дом?');
			if (!ok) return;

			try {
			const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${id}`, { method: 'DELETE' });
			if (resp.ok) {
				showToast?.('success', 'Дом удалён');
				e.target.closest('.col-12').remove();
			} else {
				showToast?.('danger', 'Не удалось удалить дом');
			}
			} catch {
			showToast?.('danger', 'Ошибка соединения');
			}
		}
	});

	/** Сохранение редактирования дома */
	document.getElementById('editForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const id = editModalEl?.dataset.houseId;
		try {
			const body = {
			name: document.getElementById('editName').value,
			address: document.getElementById('editAddress').value
			};
			const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${id}`, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
			});
			if (resp.ok) {
			showToast?.('success', 'Дом обновлён');
			editModal?.hide();
			location.reload();
			} else {
			showToast?.('danger', 'Ошибка при обновлении дома');
			}
		} catch { showToast?.('danger', 'Ошибка соединения'); }
	});

	/** === ЛОГИКА МОДАЛКИ "Создать дом" (как у вас, но без ручной стилизации) === */
	// Добавление подъезда
	document.getElementById('addEntrance')?.addEventListener('click', () => {
		const container = document.getElementById('entrancesContainer');
		const n = container.getElementsByClassName('entrance').length + 1;
		const div = document.createElement('div');
		div.className = 'entrance card card-sm p-2';
		div.innerHTML = `
			<div class="row g-2 align-items-center">
			<div class="col-12"><div class="small text-secondary">Подъезд №${n}</div></div>
			<div class="col-6">
				<label class="form-label">Этажей</label>
				<input type="number" class="form-control" name="floors[]" min="1" required>
			</div>
			<div class="col-6">
				<label class="form-label">Квартир на этаже</label>
				<input type="number" class="form-control" name="apartmentsPerFloor[]" min="1" required>
			</div>
			</div>`;
		container.appendChild(div);
	});

	// Показ/скрытие секций
	document.getElementById('addParking')?.addEventListener('change', function() {
		document.getElementById('parkingContainer').style.display = this.checked ? 'block' : 'none';
	});
	document.getElementById('addStorage')?.addEventListener('change', function() {
		document.getElementById('storageContainer').style.display = this.checked ? 'block' : 'none';
	});

	// Добавить уровень паркинга
	document.getElementById('addParkingLevel')?.addEventListener('click', () => {
		const c = document.getElementById('parkingContainer');
		const div = document.createElement('div');
		div.className = 'parkingLevel card card-sm p-2';
		div.innerHTML = `
			<div class="row g-2 align-items-center">
			<div class="col-6">
				<label class="form-label">Уровень</label>
				<input type="number" class="form-control" name="parkingLevel[]" value="-1">
			</div>
			<div class="col-6">
				<label class="form-label">Мест на уровне</label>
				<input type="number" class="form-control" name="parkingSpots[]" min="1">
			</div>
			<div class="col-12 text-end">
				<button type="button" class="btn btn-link text-danger removeLevel p-0">Удалить уровень</button>
			</div>
			</div>`;
		c.insertBefore(div, document.getElementById('addParkingLevel'));
	});

	// Добавить уровень кладовых
	document.getElementById('addStorageLevel')?.addEventListener('click', () => {
		const c = document.getElementById('storageContainer');
		const div = document.createElement('div');
		div.className = 'storageLevel card card-sm p-2';
		div.innerHTML = `
			<div class="row g-2 align-items-center">
			<div class="col-6">
				<label class="form-label">Уровень</label>
				<input type="number" class="form-control" name="storageLevel[]" value="-1">
			</div>
			<div class="col-6">
				<label class="form-label">Кол-во кладовых</label>
				<input type="number" class="form-control" name="storageUnits[]" min="1">
			</div>
			<div class="col-12 text-end">
				<button type="button" class="btn btn-link text-danger removeLevel p-0">Удалить уровень</button>
			</div>
			</div>`;
		c.insertBefore(div, document.getElementById('addStorageLevel'));
	});

	// Удаление уровня
	document.addEventListener('click', (e) => {
		if (e.target.classList?.contains('removeLevel')) {
			e.target.closest('.parkingLevel, .storageLevel')?.remove();
		}
	});

	// Сабмит формы создания дома
	document.getElementById('houseForm')?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const formData = {
			name: document.getElementById('houseName').value,
			address: document.getElementById('houseAddress').value,
			non_residential_first_floor: document.getElementById('nonResidential').checked,
			entrances: [],
			parking: [],
			storage: []
		};
		document.querySelectorAll('.entrance').forEach((ent, idx) => {
			formData.entrances.push({
			entrance_number: idx + 1,
			floors_count: ent.querySelector('input[name="floors[]"]').value,
			apartments_per_floor: ent.querySelector('input[name="apartmentsPerFloor[]"]').value
			});
		});
		if (document.getElementById('addParking')?.checked) {
			document.querySelectorAll('.parkingLevel').forEach(div => {
			formData.parking.push({
				level: div.querySelector('input[name="parkingLevel[]"]').value,
				spots_count: div.querySelector('input[name="parkingSpots[]"]').value
			});
			});
		}
		if (document.getElementById('addStorage')?.checked) {
			document.querySelectorAll('.storageLevel').forEach(div => {
			formData.storage.push({
				level: div.querySelector('input[name="storageLevel[]"]').value,
				units_count: div.querySelector('input[name="storageUnits[]"]').value
			});
			});
		}

		try {
			const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
			});
			if (resp.ok) {
			showToast?.('success', 'Дом создан');
			houseModal?.hide();
			location.reload();
			} else {
			showToast?.('danger', 'Ошибка при добавлении дома');
			}
		} catch { showToast?.('danger', 'Ошибка соединения'); }
	});

	// ====== Модалка "Добавить жильца" ======
	document.getElementById('addApartmentField')?.addEventListener('click', function() {
		const c = document.getElementById('apartmentContainer');
		const el = document.createElement('div');
		el.className = 'd-flex gap-2 align-items-center apartment-input mb-2';
		el.innerHTML = `
			<input type="text" class="form-control" name="apartments[]" placeholder="Номер квартиры">
			<label class="form-check m-0">
			<input class="form-check-input" type="checkbox" name="tenant[]">
			<span class="form-check-label">Арендатор</span>
			</label>
			<button type="button" class="btn btn-link text-danger remove-field p-0">Удалить</button>`;
		c.insertBefore(el, this);
	});

	document.getElementById('addParkingField')?.addEventListener('click', function() {
		const c = document.getElementById('parkingContainer');
		const el = document.createElement('div');
		el.className = 'd-flex gap-2 align-items-center parking-input mb-2';
		el.innerHTML = `
			<input type="text" class="form-control" name="parking[]" placeholder="Номер парковки">
			<label class="form-check m-0">
			<input class="form-check-input" type="checkbox" name="parkingTenant[]">
			<span class="form-check-label">Арендатор</span>
			</label>
			<button type="button" class="btn btn-link text-danger remove-field p-0">Удалить</button>`;
		c.insertBefore(el, this);
	});

	document.getElementById('addStorageField')?.addEventListener('click', function() {
		const c = document.getElementById('storageContainer');
		const el = document.createElement('div');
		el.className = 'd-flex gap-2 align-items-center storage-input mb-2';
		el.innerHTML = `
			<input type="text" class="form-control" name="storages[]" placeholder="Номер кладовой">
			<label class="form-check m-0">
			<input class="form-check-input" type="checkbox" name="storageTenant[]">
			<span class="form-check-label">Арендатор</span>
			</label>
			<button type="button" class="btn btn-link text-danger remove-field p-0">Удалить</button>`;
		c.insertBefore(el, this);
	});

	document.addEventListener('click', (e) => {
		if (e.target.classList?.contains('remove-field')) {
			e.target.closest('.apartment-input, .parking-input, .storage-input')?.remove();
		}
	});

	document.getElementById('addResidentForm')?.addEventListener('submit', async function(e) {
		e.preventDefault();
		const formData = new FormData(this);
		const houseId = this.dataset.houseId;
		
		/** Собираем данные жильца */
		const data = {
			full_name: formData.get('full_name'),
			telegram: formData.get('telegram') || null,
			phone: formData.get('phone') || null,
			email: formData.get('email') || null,
			apartments: [],
			parking: [],
			storages: []
		};

		// массивы присвоений
		document.querySelectorAll('input[name="apartments[]"]').forEach((input, index) => {
			data.apartments.push({
			number: input.value,
			tenant: document.querySelectorAll('input[name="tenant[]"]')[index]?.checked || false
			});
		});
		document.querySelectorAll('input[name="parking[]"]').forEach((input, index) => {
			data.parking.push({
			number: input.value,
			tenant: document.querySelectorAll('input[name="parkingTenant[]"]')[index]?.checked || false
			});
		});
		document.querySelectorAll('input[name="storages[]"]').forEach((input, index) => {
			data.storages.push({
			number: input.value,
			tenant: document.querySelectorAll('input[name="storageTenant[]"]')[index]?.checked || false
			});
		});

		/** Публичность (маскирование в шахматке) */
		const privacy = {
			// если чекбокс "Показывать ..." снят — будет false => поле маскируется как "****"
			show_name:     isPrivacyOn('name'),
			show_phone:    isPrivacyOn('phone'),
			show_email:    isPrivacyOn('email'),
			show_telegram: isPrivacyOn('telegram'),
		};
		data.resident_privacy = privacy; // ожидаемый формат
		data.privacy = privacy;          // дублируем на случай другого ожидания контроллера

		try {
			const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${houseId}/residents`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
			});
			if (resp.ok) {
			showToast?.('success', 'Жилец добавлен');
			addResidentModal?.hide();
			this.reset();
			} else {
			const err = await resp.json().catch(() => ({}));
			showToast?.('danger', 'Ошибка: ' + (err.message || resp.status));
			}
		} catch { showToast?.('danger', 'Ошибка соединения'); }
	});
	});
