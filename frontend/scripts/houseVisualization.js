/**
 * Domus — Визуализация дома (шахматка, паркинг, кладовые).
 * UI-улучшения: ровные этажи, нумерация слева/справа (липкие), горизонтальный скролл, оффканвас.
 * Все клики по пустым ячейкам открывают Tabler-модалку "Добавить жильца".
 */

/** Утилиты */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const n0 = v => Number.isFinite(+v) ? +v : 0;

/** Маска ПДн: буквы/цифры -> * (пробелы/пунктуация сохраняем) */
function mask(v){ return String(v||'').replace(/[0-9A-Za-zА-Яа-яЁё]/g, '*'); }

/** Bootstrap helpers */
const BSM = () => window.bootstrap?.Modal || bootstrap.Modal;
const BSO = () => window.bootstrap?.Offcanvas || bootstrap.Offcanvas;
function showModalById(id){ const el = $(id); if(!el) return null; const m = new (BSM())(el); m.show(); return m; }
function showOffcanvasById(id){ const el = $(id); if(!el) return null; const o = new (BSO())(el); o.show(); return o; }

/** Иконки-глаза для приватности (кнопки в модалках) */
function initPrivacyIconToggles(modalEl){
  if(!modalEl) return;
  $$('.privacy-toggle', modalEl).forEach(btn=>{
    const update = on=>{
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `<i class="ti ${on ? 'ti-eye' : 'ti-eye-off'}"></i>`;
      btn.title = on ? 'Показывать в шахматке' : 'Скрывать в шахматке';
    };
    // начальное состояние
    update(btn.getAttribute('aria-pressed') !== 'false');
    btn.addEventListener('click',()=>{
      const on = btn.getAttribute('aria-pressed') === 'true';
      update(!on);
    });
  });
}
function isPrivacyOn(modalEl, key){
  const btn = modalEl.querySelector(`.privacy-toggle[data-target="${key}"]`);
  return btn ? (btn.getAttribute('aria-pressed') === 'true') : true;
}

/**
 * Строит колонку этажей (числа от maxFloors до 1)
 * @param {HTMLElement} root - контейнер (floorsLeft/floorsRight)
 * @param {number} maxFloors
 */
function buildFloorsColumn(root, maxFloors){
  root.innerHTML = '';
  for(let f=maxFloors; f>=1; f--){
    const d=document.createElement('div');
    d.className='floor-index';
    d.textContent=String(f);
    root.appendChild(d);
  }
}

/**
 * Рисует одну колонку подъезда как набор "рядов этажей".
 * Каждый ряд содержит ровно apartments_per_floor ячеек.
 * Пропущенные этажи — пустые ряды (для выравнивания).
 * @param {object} entrance
 * @param {number} maxFloors
 * @param {boolean} nonResidentialFirst
 * @returns {HTMLElement}
 */
function renderEntranceColumn(entrance, maxFloors, nonResidentialFirst){
  const wrap = document.createElement('div');
  wrap.className='entrance-col';

  // заголовок подъезда
  const head = document.createElement('div');
  head.className = 'entrance-header';
  head.textContent = `Подъезд №${entrance.entrance_number}`;
  wrap.appendChild(head);

  // группируем квартиры по этажам
  const floorsMap = {};
  (entrance.Apartments || []).forEach(ap => {
    const f = n0(ap.floor_number);
    (floorsMap[f] ||= []).push(ap);
  });

  // базово берём apartments_per_floor; если нет — считаем максимум фактических квартир на этаж
  const colsFromData = n0(entrance.apartments_per_floor);
  const colsFromFact = Object.values(floorsMap).reduce((m, arr) => Math.max(m, arr.length), 0);
  const cols = Math.max(1, colsFromData || colsFromFact || 1);
  // прокидываем в CSS
  wrap.style.setProperty('--cols', String(cols));

  for (let f = maxFloors; f >= 1; f--) {
    const row = document.createElement('div');
    row.className = 'floor-row';

    if (f > n0(entrance.floors_count)) {
      // этаж отсутствует — просто пустая строка правильной высоты
      wrap.appendChild(row);
      continue;
    }

    if (f === 1 && nonResidentialFirst) {
      for (let i = 0; i < cols; i++) {
        const c = document.createElement('div');
        c.className = 'cell cell-nonres';
        c.textContent = '—';
        row.appendChild(c);
      }
      wrap.appendChild(row);
      continue;
    }

    const list = (floorsMap[f] || []).sort((a, b) => n0(a.apartment_number) - n0(b.apartment_number));
    list.forEach((ap) => {
      const c = document.createElement('div');
      c.className = 'cell apartment';
      c.textContent = ap.apartment_number;

      if (ap.isOccupied) {
        c.classList.add('occupied');
        c.addEventListener('click', () =>
          openResidentDrawerFor('apartment', ap.apartment_number, ap.ResidentApartments || []),
        );
      } else {
        c.addEventListener('click', () =>
          openAddResidentModalPrefill('apartment', String(ap.apartment_number)),
        );
      }

      row.appendChild(c);
    });

    wrap.appendChild(row);
  }

  // ✅ Нижняя подпись подъезда
  const foot = document.createElement('div');
  foot.className = 'entrance-footer';
  foot.textContent = `Подъезд №${entrance.entrance_number}`;
  wrap.appendChild(foot);

  return wrap;
}

/**
 * Открывает оффканвас и наполняет данными жильцов (с маскированием по privacy).
 * @param {'apartment'|'parking'|'storage'} type
 * @param {string|number} number
 * @param {Array} links - связи (ResidentApartments | ResidentParkings | ResidentStorages)
 */
function openResidentDrawerFor(type, number, links){
  const title = {
    apartment:'Квартира',
    parking:'Место',
    storage:'Кладовая',
  }[type] || 'Помещение';

  $('#residentDrawerTitle').textContent = `${title} ${number}`;
  const body = $('#residentDrawerBody');
  body.innerHTML = '';

  if(!Array.isArray(links) || links.length===0){
    body.innerHTML = '<div class="text-secondary">Нет данных о жильцах</div>';
    showOffcanvasById('#residentDrawer');
    return;
  }

  // Секции жильцов
  links.forEach(link=>{
    const res = link?.Resident || {};
    const p = res?.privacy || {};
    const showName     = p.show_full_name !== false;
    const showPhone    = p.show_phone     !== false;
    const showEmail    = p.show_email     !== false;
    const showTelegram = p.show_telegram  !== false;

    const card=document.createElement('div');
    card.className='card card-sm mb-2';
const relationType = ('spot_number' in link) ? 'parking' : (('unit_number' in link) ? 'storage' : 'apartment');
const hasValidId = Number.isFinite(Number(res.id));
const editBtn = hasValidId
  ? `<button class="btn btn-ghost-secondary btn-icon edit-resident" title="Редактировать" data-id="${Number(res.id)}">
       <i class="ti ti-edit"></i>
     </button>`
  : ''; // нет id — не показываем кнопку редактирования

	card.innerHTML = `
	<div class="card-body">
		<div class="d-flex justify-content-between">
			<div>
			<div class="fw-bold">${showName ? (res.full_name||'—') : mask(res.full_name)}</div>
			${res.phone ? `<div class="text-secondary small">Тел: ${showPhone ? res.phone : mask(res.phone)}</div>` : ''}
			${res.email ? `<div class="text-secondary small">Email: ${showEmail ? res.email : mask(res.email)}</div>` : ''}
			${res.telegram ? `<div class="text-secondary small">Telegram: ${showTelegram ? res.telegram : mask(res.telegram)}</div>` : ''}
			</div>
			<div class="btn-list">
			${editBtn}
			<button class="btn btn-ghost-danger btn-icon delete-resident"
						title="Отвязать"
						data-id="${hasValidId ? Number(res.id) : ''}"
						data-relation="${relationType}"
						data-relation-id="${link.id}">
				<i class="ti ti-unlink"></i>
			</button>
			</div>
		</div>
	</div>`;
    body.appendChild(card);
  });

  showOffcanvasById('#residentDrawer');
}

/** Открыть модалку "Добавить жильца" и подставить номер */
function openAddResidentModalPrefill(kind, number){
  const form = $('#addResidentForm');
  form.reset();
  form.dataset.houseId = new URLSearchParams(location.search).get('id') || '';

  // очистим возможные динамические поля
  $$('#apartmentContainer .dynamic-field, #parkingContainer .dynamic-field, #storageContainer .dynamic-field').forEach(n=>n.remove());

  // подставим номер
  if(kind==='apartment') form.querySelector('input[name="apartments[]"]').value = number;
  if(kind==='parking')   form.querySelector('input[name="parking[]"]').value   = number;
  if(kind==='storage')   form.querySelector('input[name="storages[]"]').value  = number;

  initPrivacyIconToggles($('#addResidentModal'));
  showModalById('#addResidentModal');
}

/** Построение разделов Паркинг/Кладовые с глобальной нумерацией и кликами */
function buildParking(house){
  const root = $('#parking'); root.innerHTML = '';
  const card = $('#parkingCard');

  const levels = [...(house.Parkings||[])].sort((a,b)=>n0(b.level)-n0(a.level));
  if(!levels.length){ card?.remove(); return; }

  let spotCounter=1;
  levels.forEach(l=>{
    const box=document.createElement('div');
    box.className='parking-level';
    box.innerHTML=`<div class="parking-title">Уровень ${l.level}</div>`;
    const grid=document.createElement('div');
    grid.className='parking-grid';

    for(let i=1;i<=n0(l.spots_count);i++){
      const gnum = spotCounter;
      const cell=document.createElement('div');
      cell.className='cell parking-spot';
      cell.textContent = gnum;

      const occupied = (l.ResidentParkings||[]).some(rp=>n0(rp.spot_number)===gnum);
      if(occupied){
        cell.classList.add('occupied');
        const residentsHere = (l.ResidentParkings||[]).filter(rp=>n0(rp.spot_number)===gnum);
        cell.addEventListener('click', ()=> openResidentDrawerFor('parking', gnum, residentsHere));
      }else{
        cell.addEventListener('click', ()=> openAddResidentModalPrefill('parking', String(gnum)));
      }
      grid.appendChild(cell);
      spotCounter++;
    }
    box.appendChild(grid);
    root.appendChild(box);
  });
}

function buildStorages(house){
  const root = $('#storages'); root.innerHTML = '';
  const card = $('#storagesCard');

  const levels = [...(house.StorageUnits||[])].sort((a,b)=>n0(b.level)-n0(a.level));
  if(!levels.length){ card?.remove(); return; }

  let unitCounter=1;
  levels.forEach(l=>{
    const box=document.createElement('div');
    box.className='storage-level';
    box.innerHTML=`<div class="storage-title">Уровень ${l.level}</div>`;
    const grid=document.createElement('div');
    grid.className='storage-grid';

    for(let i=1;i<=n0(l.units_count);i++){
      const gnum = unitCounter;
      const cell=document.createElement('div');
      cell.className='cell storage-unit';
      cell.textContent = gnum;

      const occupied = (l.ResidentStorages||[]).some(rs=>n0(rs.unit_number)===gnum);
      if(occupied){
        cell.classList.add('occupied');
        const residentsHere = (l.ResidentStorages||[]).filter(rs=>n0(rs.unit_number)===gnum);
        cell.addEventListener('click', ()=> openResidentDrawerFor('storage', gnum, residentsHere));
      }else{
        cell.addEventListener('click', ()=> openAddResidentModalPrefill('storage', String(gnum)));
      }
      grid.appendChild(cell);
      unitCounter++;
    }
    box.appendChild(grid);
    root.appendChild(box);
  });
}

/** Сбор приватности из модалки */
function getPrivacyFromModal(modalEl){
  return {
    show_full_name: isPrivacyOn(modalEl,'name'),
    show_phone:     isPrivacyOn(modalEl,'phone'),
    show_email:     isPrivacyOn(modalEl,'email'),
    show_telegram:  isPrivacyOn(modalEl,'telegram'),
  };
}

/** Добавление динамических полей в модалке "Добавить жильца" */
function hookAddButtons(){
  $('#addResidentModal')?.addEventListener('click', (ev)=>{
    const t = ev.target;
    const add = (containerId, inputName, checkboxName, placeholder)=>{
      const c = $(`#addResidentModal #${containerId}`);
      const row = document.createElement('div');
      row.className='dynamic-field d-flex gap-2 align-items-center mb-2';
      row.innerHTML = `
        <input type="text" class="form-control" name="${inputName}[]" placeholder="${placeholder}">
        <label class="form-check m-0">
          <input class="form-check-input" type="checkbox" name="${checkboxName}[]">
          <span class="form-check-label">Арендатор</span>
        </label>
        <button type="button" class="btn btn-link text-danger remove-field p-0"><i class="ti ti-x"></i></button>`;
      // вставляем перед кнопкой "Добавить"
      const btn = c.querySelector('button[id^="add"]');
      c.insertBefore(row, btn || null);
    };
    if(t.id==='addApartmentField') add('apartmentContainer','apartments','tenant','Номер квартиры');
    if(t.id==='addParkingField')   add('parkingContainer','parking','parkingTenant','Номер парковки');
    if(t.id==='addStorageField')   add('storageContainer','storages','storageTenant','Номер кладовой');
    if(t.classList.contains('remove-field')) t.closest('.dynamic-field')?.remove();
  });
}

/** Сабмит "Добавить жильца" */
function hookAddResidentSubmit(){
  $('#addResidentForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const form = this;
    const houseId = form.dataset.houseId || new URLSearchParams(location.search).get('id');

    const data = {
      full_name: $('#residentFullName').value,
      telegram: $('#residentTelegram').value || null,
      phone:    $('#residentPhone').value || null,
      email:    $('#residentEmail').value || null,
      apartments: [],
      parking: [],
      storages: [],
      privacy: getPrivacyFromModal($('#addResidentModal'))
    };

    $$('input[name="apartments[]"]').forEach((inp, idx)=>{
      const v = (inp.value||'').trim();
      if(!v || isNaN(v)) return;
      const chk = $$('input[name="tenant[]"]')[idx];
      data.apartments.push({ number: parseInt(v,10), tenant: !!(chk && chk.checked) });
    });
    $$('input[name="parking[]"]').forEach((inp, idx)=>{
      const v = (inp.value||'').trim();
      if(!v || isNaN(v)) return;
      const chk = $$('input[name="parkingTenant[]"]')[idx];
      data.parking.push({ number: parseInt(v,10), tenant: !!(chk && chk.checked) });
    });
    $$('input[name="storages[]"]').forEach((inp, idx)=>{
      const v = (inp.value||'').trim();
      if(!v || isNaN(v)) return;
      const chk = $$('input[name="storageTenant[]"]')[idx];
      data.storages.push({ number: parseInt(v,10), tenant: !!(chk && chk.checked) });
    });

    try{
      const resp = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${houseId}/residents`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      if(resp.ok){
        new (BSM())($('#addResidentModal')).hide();
        location.reload();
      }else{
        const err = await resp.json().catch(()=>({}));
        alert('Ошибка: ' + (err.message || resp.status));
      }
    }catch(e){ alert('Ошибка соединения'); }
  });
}

/** Отвязка жильца */
function hookDetach(){
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.delete-resident');
    if(!btn) return;
    const residentId = btn.dataset.id;
    const relation = btn.dataset.relation;
    const relationId = +btn.dataset.relationId;
    if(!residentId || !relation || !relationId) return;

    if(!confirm('Отвязать жильца от этого объекта?')) return;
    try{
      const resp = await fetch(`${window.DOMUS_API_BASE_URL}/residents/${residentId}/link`, {
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ relation, relation_id: relationId })
      });
      if(resp.ok){ location.reload(); }
      else{
        const err=await resp.json().catch(()=>({}));
        alert('Ошибка: ' + (err.message || resp.status));
      }
    }catch{ alert('Ошибка соединения'); }
  });
}

	/** Загрузка жильца и открытие модалки редактирования */
	async function openEditResidentModal(residentId){
	// приводим входной id к числу и валидируем
	const idNum = parseInt(String(residentId ?? '').trim(), 10);
	if (!idNum || Number.isNaN(idNum)) {
		alert('Ошибка: некорректный ID жильца.');
		console.warn('openEditResidentModal → bad residentId:', residentId);
		return;
	}
	try{
		const r = await fetch(`${window.DOMUS_API_BASE_URL}/residents/${idNum}`);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();

    $('#editFullName').value = d.full_name || '';
    $('#editTelegram').value = d.telegram || '';
    $('#editPhone').value    = d.phone || '';
    $('#editEmail').value    = d.email || '';

    // приватность
    initPrivacyIconToggles($('#editResidentModal'));
    // применим состояние глаз
    const setEye = (key, show)=>{
      const btn = $('#editResidentModal').querySelector(`.privacy-toggle[data-target="${key}"]`);
      if(!btn) return;
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.innerHTML = `<i class="ti ${show ? 'ti-eye' : 'ti-eye-off'}"></i>`;
    };
    setEye('name',     d?.privacy?.show_full_name !== false);
    setEye('phone',    d?.privacy?.show_phone     !== false);
    setEye('email',    d?.privacy?.show_email     !== false);
    setEye('telegram', d?.privacy?.show_telegram  !== false);

    // контейнеры связей
    const cA = $('#editApartmentContainer'); cA.innerHTML = '<label class="form-label">Квартиры</label>';
    const cP = $('#editParkingContainer');   cP.innerHTML = '<label class="form-label">Парковочные места</label>';
    const cS = $('#editStorageContainer');   cS.innerHTML = '<label class="form-label">Кладовые</label>';

    (d.apartments||[]).forEach(a=>{
      const row=document.createElement('div');
      row.className='d-flex gap-2 align-items-center mb-2';
      row.innerHTML=`
        <input type="text" class="form-control" name="apartments[]" value="${a.number||''}" placeholder="Номер квартиры">
        <label class="form-check m-0">
          <input class="form-check-input" type="checkbox" name="tenant[]" ${a.tenant?'checked':''}>
          <span class="form-check-label">Арендатор</span>
        </label>
        <button type="button" class="btn btn-link text-danger remove-field p-0"><i class="ti ti-x"></i></button>`;
      cA.appendChild(row);
    });

    (d.parking||[]).forEach(p=>{
      const row=document.createElement('div');
      row.className='d-flex gap-2 align-items-center mb-2';
      row.innerHTML=`
        <input type="text" class="form-control" name="parking[]" value="${p.number||''}" placeholder="Номер парковки">
        <label class="form-check m-0">
          <input class="form-check-input" type="checkbox" name="parkingTenant[]" ${p.tenant?'checked':''}>
          <span class="form-check-label">Арендатор</span>
        </label>
        <button type="button" class="btn btn-link text-danger remove-field p-0"><i class="ti ti-x"></i></button>`;
      cP.appendChild(row);
    });

    (d.storages||[]).forEach(s=>{
      const row=document.createElement('div');
      row.className='d-flex gap-2 align-items-center mb-2';
      row.innerHTML=`
        <input type="text" class="form-control" name="storages[]" value="${s.number||''}" placeholder="Номер кладовой">
        <label class="form-check m-0">
          <input class="form-check-input" type="checkbox" name="storageTenant[]" ${s.tenant?'checked':''}>
          <span class="form-check-label">Арендатор</span>
        </label>
        <button type="button" class="btn btn-link text-danger remove-field p-0"><i class="ti ti-x"></i></button>`;
      cS.appendChild(row);
    });

    // поведение удаления строк
    $('#editResidentModal').addEventListener('click', (e)=>{
      if(e.target.closest('.remove-field')) e.target.closest('.remove-field').closest('.mb-2')?.remove();
    });

	// ✅ Надёжно сохраняем ID в dataset и скрытом поле (берём ИЗ ПАРАМЕТРА idNum)
	const form = $('#editResidentForm');
	form.dataset.residentId = String(idNum);
	form.dataset.houseId = String(d.house_id || new URLSearchParams(location.search).get('id') || '');

	let hiddenId = form.querySelector('input[type="hidden"][name="resident_id"]');
	if (!hiddenId) {
	hiddenId = document.createElement('input');
	hiddenId.type = 'hidden';
	hiddenId.name = 'resident_id';
	form.appendChild(hiddenId);
	}
	hiddenId.value = String(idNum);


		showModalById('#editResidentModal');

	}catch(e){ alert('Ошибка загрузки данных жильца'); }
	}

/** Сабмит редактирования жильца */
function hookEditSubmit(){
  $('#editResidentForm')?.addEventListener('submit', async function(e){
    e.preventDefault();

    // достаём id из dataset или из hidden и валидируем
    let id = this.dataset.residentId ?? this.querySelector('input[name="resident_id"]')?.value;
    id = String(id || '').trim();
    const idNum = parseInt(id, 10);
    if (!id || Number.isNaN(idNum)) {
      alert('Ошибка: не удалось определить ID жильца. Закройте окно и откройте «Редактировать» снова.');
      console.error('edit submit → bad id:', id);
      return;
    }

    const houseId = this.dataset.houseId;
    if (!houseId) {
      alert('Ошибка: не найден идентификатор дома.');
      return;
    }

    const data = {
      full_name: $('#editFullName').value,
      telegram: $('#editTelegram').value || null,
      phone:    $('#editPhone').value || null,
      email:    $('#editEmail').value || null,
      house_id: houseId,
      apartments: [], parking: [], storages: [],
      privacy: getPrivacyFromModal($('#editResidentModal'))
    };

    $$('#editApartmentContainer input[name="apartments[]"]').forEach((inp, idx)=>{
      const num=(inp.value||'').trim(); if(!num||isNaN(num)) return;
      const chk=$$('#editApartmentContainer input[name="tenant[]"]')[idx];
      data.apartments.push({number:parseInt(num,10), tenant:!!(chk&&chk.checked)});
    });
    $$('#editParkingContainer input[name="parking[]"]').forEach((inp, idx)=>{
      const num=(inp.value||'').trim(); if(!num||isNaN(num)) return;
      const chk=$$('#editParkingContainer input[name="parkingTenant[]"]')[idx];
      data.parking.push({number:parseInt(num,10), tenant:!!(chk&&chk.checked)});
    });
    $$('#editStorageContainer input[name="storages[]"]').forEach((inp, idx)=>{
      const num=(inp.value||'').trim(); if(!num||isNaN(num)) return;
      const chk=$$('#editStorageContainer input[name="storageTenant[]"]')[idx];
      data.storages.push({number:parseInt(num,10), tenant:!!(chk&&chk.checked)});
    });

    try{
      const resp = await fetch(`${window.DOMUS_API_BASE_URL}/residents/${idNum}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      if(resp.ok){
        new (BSM())($('#editResidentModal')).hide();
        location.reload();
      }else{
        const err = await resp.json().catch(()=>({}));
        alert('Ошибка: '+(err.message||resp.status));
      }
    }catch{
      alert('Ошибка соединения');
    }
  });
}

/** Навешиваем: клик "редактировать" из оффканваса */
function hookEditFromDrawer(){
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.edit-resident'); if(!btn) return;
    openEditResidentModal(btn.dataset.id);
  });
}

/** Инициализация страницы */
document.addEventListener('DOMContentLoaded', async ()=>{
  // Кнопка "Добавить жильца" в шапке — пустая форма
  $('#openAddResidentBlank')?.addEventListener('click', ()=> openAddResidentModalPrefill('apartment',''));

  // Инициализация кнопок/сабмитов модалок
  hookAddButtons();
  hookAddResidentSubmit();
  hookEditSubmit();
  hookEditFromDrawer();
  hookDetach();

  const houseId = new URLSearchParams(location.search).get('id');
  try{
    const r = await fetch(`${window.DOMUS_API_BASE_URL}/houses/${houseId}/structure`);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const house = await r.json();

    // заголовок/метаданные
    $('#houseName').textContent = house.name || 'Дом';
    $('#houseMeta').textContent = house.address || '';

    // шахматка
    const maxFloors = Math.max(...(house.Entrances||[]).map(e=>n0(e.floors_count)), 0);
    buildFloorsColumn($('#floorsLeft'), maxFloors);
    buildFloorsColumn($('#floorsRight'), maxFloors);

    const board = $('#chessboard'); board.innerHTML='';
    (house.Entrances||[]).sort((a,b)=>n0(a.entrance_number)-n0(b.entrance_number))
      .forEach(e=> board.appendChild(renderEntranceColumn(e, maxFloors, !!house.non_residential_first_floor)));

    // паркинг / кладовые
    buildParking(house);
    buildStorages(house);

  }catch(e){
    console.error(e);
    $('#chessboard').innerHTML = '<div class="p-3 text-danger">Ошибка загрузки данных</div>';
  }
});
