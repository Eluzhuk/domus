/**
 * Domus — Страница Домов (Tabler).
 * - Карточки с футером (экшены) и бейджем "Жильцов" поверх фото.
 * - Прогрессы заселённости по уникальным помещениям (апартаменты/парковка/кладовые).
 * - Поддержка slug: генерация на клиенте, показ на карточке, копирование публичной ссылки.
 * - Модалки: bootstrap.Modal (Tabler JS уже подключён).
 */

/** Преобразует значение к числу или 0 */
const n0 = (v) => Number.isFinite(+v) ? +v : 0;

/** Возвращает процент целым числом [0..100] */
const pct = (num, den) => {
  const d = n0(den);
  if (d <= 0) return 0;
  const p = Math.round(n0(num) * 100 / d);
  return Math.max(0, Math.min(100, p));
};

/** Формат «занято/всего (процент%)» */
const fmt = (x, y) => `${n0(x)}/${n0(y)} (${pct(x, y)}%)`;

/**
 * Транслитерация RU->EN для генерации slug (упрощённо).
 * @param {string} s
 * @returns {string}
 */
function translitRuClient(s){
  const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k',
    'л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch',
    'ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
  return String(s||'').toLowerCase().split('').map(ch=>map[ch] ?? ch).join('');
}

/**
 * В kebab-case: только латиница/цифры/дефисы, без двойных/краевых дефисов.
 * @param {string} s
 * @returns {string}
 */
function toKebabClient(s){
  return String(s||'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Быстрая генерация slug из названия дома (клиентская).
 * Итоговую уникальность гарантирует сервер.
 * @param {string} name
 * @returns {string}
 */
function makeSlugFromName(name){
  if(!name) return '';
  return toKebabClient(translitRuClient(name));
}

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
    // начальное состояние: если нет aria-pressed — считаем true
    updateIcon(btn.getAttribute('aria-pressed') !== 'false');
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

/** Кэш домов по id */
const HOUSE_BY_ID = new Map();

/**
 * Рендер одной карточки Tabler.
 * @param {object} h - дом
 * @returns {HTMLDivElement}
 */
function renderHouseCard(h) {
  const id = h.id;
  HOUSE_BY_ID.set(String(id), h);

  // Фото или плейсхолдер
  const img = (h.photo_url || h.photoUrl || '').trim() || '/assets/house-placeholder.svg';

  // Жильцы — общий бейдж (перенесено вверх по требованию)
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
  const occPUnique =
    uniqueObjectSetCount(h, ['parkingAssignments','parking','parking_places','parkingPlaces'], ['spot_number','spotNumber','number','place_number'])
    ?? uniquePrimitiveSetCount(h, ['occupiedParkingSpotNumbers','parkingOccupiedNumbers','parking_spots_occupied']);
  const occP = occPUnique ?? n0(h.occupiedParking);
  const pP = pct(occP, totalP);

  // --- Кладовые: считаем УНИКАЛЬНЫЕ помещения (unit_number)
  const totalS = n0(h.totalStorages);
  const occSUnique =
    uniqueObjectSetCount(h, ['storageAssignments','storages','storage_units','storageUnits'], ['unit_number','unitNumber','number'])
    ?? uniquePrimitiveSetCount(h, ['occupiedStorageUnitNumbers','storageOccupiedNumbers','storage_units_occupied']);
  const occS = occSUnique ?? n0(h.occupiedStorages);
  const pS = pct(occS, totalS);

  const col = document.createElement('div');
  col.className = 'col-12 col-md-6 col-lg-4 house-card';

  // slug-ряд (бейдж + действия), если slug есть
  const slugRow = h.slug ? `
    <div class="slug-row d-flex justify-content-between align-items-center my-1">
 		<span class="badge bg-azure text-blue-fg" title="Slug дома">${h.slug}</span>
		<div class="btn-list">
      <button class="btn btn-outline-secondary btn-sm copy-public" data-slug="${h.slug}" title="Скопировать публичную ссылку">
      <i class="ti ti-link"></i>
      </button>
      <a class="btn btn btn-outline-secondary btn-sm open-public" href="/pages/board.html?slug=${encodeURIComponent(h.slug)}" target="_blank" title="Открыть публичную ссылку">
        <i class="ti ti-external-link"></i>
      </a>
		</div>
    </div>
  ` : '';

  col.innerHTML = `
    <div class="card" data-id="${id}" data-slug="${h.slug || ''}">
      <!-- Фото -->
      <div class="card-img-top">
        <div class="ratio ratio-16x9 bg-muted">
          <img class="img-cover" src="${img}" alt="Фото дома" onerror="this.src='/assets/house-placeholder.svg'" />
        </div>
      </div>

      <div class="card-body">
        <!-- Верхняя строка: слева — жильцы, справа — действия -->
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

        <!-- Slug (если есть) -->
        ${slugRow}

        <!-- Адрес и название ниже -->
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

      <!-- Футер — только кнопка "Открыть" (админская визуализация) -->
      <div class="card-footer d-flex align-items-center justify-content-end">
        <a href="#" class="btn btn-primary btn-sm open-visual" data-id="${id}" title="Визуализация">
          Открыть <i class="ti ti-login-2 ms-1"></i>
        </a>
      </div>
    </div>
  `;
  return col;
}

/**
 * Навешивает фильтрацию карточек по тексту.
 * @param {HTMLInputElement} input
 */
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

/** Bootstrap modal helper */
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
  const editModal  = editModalEl  ? getModal(editModalEl)   : null;
  const addResidentModal = addResidentModalEl ? getModal(addResidentModalEl) : null;
  initPrivacyIconToggles(addResidentModalEl);

  // Генерация slug по кнопке (в модалке "Создать дом")
  document.getElementById('generateSlug')?.addEventListener('click', () => {
    const name = document.getElementById('houseName')?.value || '';
    const slug = makeSlugFromName(name);
    const slugInput = document.getElementById('houseSlug');
    if (slugInput) slugInput.value = slug;
    try { window.showToast?.('success', slug ? 'Сгенерирован slug' : 'Введите название'); } catch {}
  });

  // Кнопка "Добавить дом"
  document.getElementById('openModal')?.addEventListener('click', (e) => {
    e.preventDefault(); houseModal?.show();
  });

  // Загрузка домов
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
    } else {
      const frag = document.createDocumentFragment();
      houses.forEach(h => frag.appendChild(renderHouseCard(h)));
      container.replaceChildren(frag);
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div class="alert alert-danger" role="alert">Ошибка загрузки данных</div>';
  }

  /** Делегирование событий: переход/экшены/модалки */
  container.addEventListener('click', async (e) => {
    const card = e.target.closest('.card[data-id]');
    const id = card?.getAttribute('data-id');

    // Открыть админскую визуализацию (по id)
    if (e.target.closest('.open-visual')) {
      e.preventDefault();
      location.href = `house-visualization.html?id=${encodeURIComponent(id)}`;
      return;
    }

    // Копирование публичной ссылки (по slug)
    if (e.target.closest('.copy-public')) {
      e.preventDefault();
      const btn = e.target.closest('.copy-public');
      const slug = btn?.dataset?.slug || card?.getAttribute('data-slug');
      if (!slug) return window.showToast?.('warning', 'У дома не задан slug');
      const url = `${location.origin}/pages/board.html?slug=${encodeURIComponent(slug)}`;
      try {
        await navigator.clipboard.writeText(url);
        window.showToast?.('success', 'Ссылка скопирована');
      } catch {
        window.prompt?.('Скопируйте ссылку:', url);
      }
      return;
    }

    // Добавить жильца (просто открыть модалку и проставить houseId)
    if (e.target.closest('.add-resident')) {
      e.preventDefault();
      const form = document.getElementById('addResidentForm');
      if (form) form.dataset.houseId = id;
      addResidentModal?.show();
      return;
    }

    // Редактировать дом
    if (e.target.closest('.edit-house')) {
      e.preventDefault();
      const h = HOUSE_BY_ID.get(String(id)) || {};
      document.getElementById('editName').value    = h.name || '';
      document.getElementById('editAddress').value = h.address || '';
      const slugInput = document.getElementById('editSlug');
      if (slugInput) slugInput.value = h.slug || '';
      editModalEl.dataset.houseId = id;
      editModal?.show();
      return;
    }

    // Удалить дом
    if (e.target.closest('.delete-house')) {
      e.preventDefault();
      const ok = typeof window.confirmDialog === 'function'
        ? await window.confirmDialog('Удалить дом?', 'Данные будут удалены без возможности восстановления.', 'Удалить', 'Отмена')
        : window.confirm('Удалить дом?');
      if (!ok) return;

      try {
        const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${id}`, { method: 'DELETE' });
        if (resp.ok) {
          window.showToast?.('success', 'Дом удалён');
          e.target.closest('.col-12')?.remove();
        } else {
          window.showToast?.('danger', 'Не удалось удалить дом');
        }
      } catch {
        window.showToast?.('danger', 'Ошибка соединения');
      }
    }
  });

  /** Сохранение редактирования дома */
  document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editModalEl?.dataset.houseId;
    try {
      const body = {
        name:    document.getElementById('editName').value,
        address: document.getElementById('editAddress').value
      };
      const slugVal = (document.getElementById('editSlug')?.value || '').trim();
      if (slugVal) body.slug = slugVal; // пустое не шлём, чтобы не затирать

      const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (resp.ok) {
        window.showToast?.('success', 'Дом обновлён');
        editModal?.hide();
        location.reload();
      } else {
        const err = await resp.json().catch(()=> ({}));
        window.showToast?.('danger', 'Ошибка при обновлении дома' + (err?.message ? `: ${err.message}` : ''));
      }
    } catch { window.showToast?.('danger', 'Ошибка соединения'); }
  });

  // === МОДАЛКА "Создать дом" ===

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

  // Показ/скрытие секций паркинга/кладовых
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

  // Удаление уровня (паркинг/кладовые)
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('removeLevel')) {
      e.target.closest('.parkingLevel, .storageLevel')?.remove();
    }
  });

  // Сабмит формы создания дома
  document.getElementById('houseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawName = document.getElementById('houseName').value;
    const rawSlug = (document.getElementById('houseSlug')?.value || '').trim();

    const formData = {
      name: rawName,
      address: document.getElementById('houseAddress').value,
      slug: rawSlug || undefined, // сервер нормализует/уникализирует
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
        window.showToast?.('success', 'Дом создан');
        houseModal?.hide();
        location.reload();
      } else {
        const err = await resp.json().catch(()=> ({}));
        window.showToast?.('danger', 'Ошибка при добавлении дома' + (err?.message ? `: ${err.message}` : ''));
      }
    } catch { window.showToast?.('danger', 'Ошибка соединения'); }
  });

  // ====== Модалка "Добавить жильца" ======
  // ВАЖНО: на houses.html есть ДУБЛИ ID (#parkingContainer, #storageContainer) в разных модалках.
  // Поэтому все выборки делаем ТОЛЬКО ВНУТРИ модалки добавления жильца через делегирование.
  addResidentModalEl?.addEventListener('click', function (e) {
    const modal = addResidentModalEl;

    const addField = (containerId, inputName, checkboxName, placeholder) => {
      const c = modal.querySelector(`#${containerId}`);
      if (!c) return;
      const row = document.createElement('div');
      row.className = `d-flex gap-2 align-items-center mb-2 ${inputName.replace(/\[\]/,'')}-input dynamic-field`;
      row.innerHTML = `
        <input type="text" class="form-control" name="${inputName}[]" placeholder="${placeholder}">
        <label class="form-check m-0">
          <input class="form-check-input" type="checkbox" name="${checkboxName}[]">
          <span class="form-check-label">Арендатор</span>
        </label>
        <button type="button" class="btn btn-link text-danger remove-field p-0">Удалить</button>`;
      const btn = c.querySelector('button[id^="add"]');
      c.insertBefore(row, btn || null);
    };

    if (e.target.id === 'addApartmentField') {
      addField('apartmentContainer', 'apartments', 'tenant', 'Номер квартиры');
    }
    if (e.target.id === 'addParkingField') {
      addField('parkingContainer', 'parking', 'parkingTenant', 'Номер парковки');
    }
    if (e.target.id === 'addStorageField') {
      addField('storageContainer', 'storages', 'storageTenant', 'Номер кладовой');
    }

    if (e.target.classList.contains('remove-field')) {
      e.target.closest('.dynamic-field')?.remove();
    }
  });

  // Отправка формы "Добавить жильца"
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

    // массивы присвоений (берём ТОЛЬКО из модалки добавления жильца)
    addResidentModalEl.querySelectorAll('input[name="apartments[]"]').forEach((input, index) => {
      data.apartments.push({
        number: input.value,
        tenant: addResidentModalEl.querySelectorAll('input[name="tenant[]"]')[index]?.checked || false
      });
    });
    addResidentModalEl.querySelectorAll('input[name="parking[]"]').forEach((input, index) => {
      data.parking.push({
        number: input.value,
        tenant: addResidentModalEl.querySelectorAll('input[name="parkingTenant[]"]')[index]?.checked || false
      });
    });
    addResidentModalEl.querySelectorAll('input[name="storages[]"]').forEach((input, index) => {
      data.storages.push({
        number: input.value,
        tenant: addResidentModalEl.querySelectorAll('input[name="storageTenant[]"]')[index]?.checked || false
      });
    });

    /** Публичность (маскирование в шахматке) */
    const privacy = {
      show_name:     isPrivacyOn('name'),
      show_phone:    isPrivacyOn('phone'),
      show_email:    isPrivacyOn('email'),
      show_telegram: isPrivacyOn('telegram'),
    };
    data.resident_privacy = privacy;
    data.privacy = privacy;

    try {
      const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${houseId}/residents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (resp.ok) {
        window.showToast?.('success', 'Жилец добавлен');
        addResidentModal?.hide();
        this.reset();
      } else {
        const err = await resp.json().catch(() => ({}));
        window.showToast?.('danger', 'Ошибка: ' + (err.message || resp.status));
      }
    } catch { window.showToast?.('danger', 'Ошибка соединения'); }
  });
});
