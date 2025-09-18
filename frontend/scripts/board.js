/**
 * Публичная шахматка (read-only) — квартиры, паркинг, кладовые.
 * Источник: GET ${DOMUS_API_BASE_URL}/public/board/:slug
 * ВАЖНО: публичный API обычно отдаёт плоские списки: apartments[], entrances[], parkings[], storages[]
 * и списки связей на уровне соответствующих уровней: ResidentParkings/ResidentStorages (или в нижнем регистре).
 * Мы группируем и рендерим под существующий админский CSS без какого-либо редактирования.
 */

/** Утилиты и шорткаты */
const toNum = v => Number.isFinite(+v) ? +v : NaN;
const byAsc = (a,b)=> (a??0)-(b??0);
const byDesc = (a,b)=> (b??0)-(a??0);
const $ = (sel, root=document)=> root.querySelector(sel);

/** params */
function qs(key){ const v = new URLSearchParams(location.search).get(key); return v && v.trim() || null; }

/** GET без авторизации */
async function apiGet(url){
  const r = await fetch(url, { method:'GET', credentials:'omit', headers:{'Accept':'application/json'} });
  if(!r.ok){ const t = await r.text().catch(()=> ''); throw new Error(`HTTP ${r.status}: ${t||r.statusText}`); }
  return r.json();
}

/** Бейдж "Арендатор" рядом с именем (публичный вид) */
function renderResidentLabelPublic(res){
  // Имя уже может быть замаскировано бэкендом — показываем как есть
  const name = (res?.full_name || res?.display_name || '').toString().trim();

  // Пытаемся понять "арендатор" из разных возможных форматов (в т.ч. прокинуто из связи)
  const link = res?.link || res;
  const isTenant = link?.type === 'tenant' || link?.tenant === true || res?.isTenant === true;

  const badge = isTenant
    ? `<span class="badge bg-yellow-lt text-yellow ms-2 align-middle">
         <i class="ti ti-key me-1"></i>Арендатор
       </span>`
    : '';

  return `<span class="domus-resident-name">${name || 'Жилец'}</span>${badge}`;
}

/** Отрисовка контактов (что пришло — то и покажем; сервер уже учёл privacy) */
function renderContacts(res){
  const lines = [];
  if (res?.phone)    lines.push(`<div class="text-secondary"><i class="ti ti-phone me-1"></i>${res.phone}</div>`);
  if (res?.email)    lines.push(`<div class="text-secondary"><i class="ti ti-mail me-1"></i>${res.email}</div>`);
  if (res?.telegram) lines.push(`<div class="text-secondary"><i class="ti ti-brand-telegram me-1"></i>${res.telegram}</div>`);
  return lines.join('');
}

/** Открыть оффканвас для квартиры/парковки/кладовой */
function openPublicDrawerFor(kind, number, residents){
  const title = $('#residentDrawerTitle');
  const body  = $('#residentDrawerBody');

  const titleMap = { apartment:'Квартира', parking:'Парковка', storage:'Кладовая' };
  title.textContent = `${titleMap[kind] || 'Помещение'} ${number ?? ''}`;

  if (!Array.isArray(residents) || !residents.length){
    body.innerHTML = `<div class="text-secondary">Нет закреплённых жильцов.</div>`;
  } else {
    body.innerHTML = residents.map(res=>`
      <div class="card mb-2">
        <div class="card-body py-2">
          <div class="fw-semibold">${renderResidentLabelPublic(res)}</div>
          <div class="mt-1">${renderContacts(res)}</div>
        </div>
      </div>
    `).join('');
  }

  const el = document.getElementById('residentDrawer');
  const oc = (window.bootstrap && window.bootstrap.Offcanvas)
    ? new window.bootstrap.Offcanvas(el)
    : new tabler.Offcanvas(el);
  oc.show();
}

/** Рендер одной колонки этажей (левая/правая) */
function buildFloorsColumn(root, maxFloors){
  root.innerHTML = '';
  for(let f=maxFloors; f>=1; f--){
    const d = document.createElement('div');
    d.className = 'floor-index';
    d.textContent = f;
    root.appendChild(d);
  }
}

/** Рендер одной колонки подъезда под классы .entrance-col / .floor-row / .cell */
function renderEntranceColumn(entrance, apartmentsOfEntrance, allFloorsDesc, nonResidentialFirst, aptIndex){
  const col = document.createElement('div');
  col.className = 'entrance-col';

  // заголовок подъезда
  const head = document.createElement('div');
  head.className = 'entrance-header';
  head.textContent = `Подъезд ${entrance.entrance_number ?? ''}`;
  col.appendChild(head);

  // группируем квартиры по этажам
  const byFloor = new Map();
  apartmentsOfEntrance.forEach(ap=>{
    const f = toNum(ap.floor_number);
    if(!Number.isFinite(f)) return;
    if(!byFloor.has(f)) byFloor.set(f, []);
    byFloor.get(f).push(ap);
  });
  // сортировка квартир по номеру
  for(const list of byFloor.values()){
    list.sort((a,b)=> (toNum(a.apartment_number)||0) - (toNum(b.apartment_number)||0));
  }

  // ширина подъезда = max(apartments_per_floor, фактический максимум на этаже)
  const factCols = Math.max(1, ...[...byFloor.values()].map(a=>a.length), 1);
  const cols = Math.max(1, toNum(entrance.apartments_per_floor) || 0, factCols);
  col.style.setProperty('--cols', String(cols));

  // ряды по этажам (сверху вниз)
  for(const f of allFloorsDesc){
    const row = document.createElement('div');
    row.className = 'floor-row';
    row.style.setProperty('--cols', String(cols));

    // этаж отсутствует у подъезда -> пустая строка нужной высоты (как в админке)
    if(!byFloor.has(f) && !(nonResidentialFirst && f===1)){
      col.appendChild(row);
      continue;
    }

    // нежилой 1-й этаж — рисуем «—» в количестве cols
    if(nonResidentialFirst && f===1){
      for(let i=0;i<cols;i++){
        const c = document.createElement('div');
        c.className = 'cell cell-nonres';
        c.textContent = '—';
        row.appendChild(c);
      }
      col.appendChild(row);
      continue;
    }

    // реальные квартиры — НЕ рисуем «пустые» ячейки
    for(const ap of (byFloor.get(f) || [])){
      const residents = Array.isArray(ap.residents) ? ap.residents : [];
      const isOcc = residents.length > 0;

      const c = document.createElement('div');
      c.className = 'cell apartment' + (isOcc ? ' occupied' : '');
      c.textContent = ap.apartment_number;

      // индексируем для кликов
      const key = (ap.id != null)
        ? `id:${ap.id}`
        : `k:${ap.entrance_id}|${ap.apartment_number}|${ap.floor_number}`;
      c.dataset.key = key;
      aptIndex.set(key, ap);

      // клик — только занятые
      if (isOcc) c.addEventListener('click', () => openPublicDrawerFor('apartment', ap.apartment_number, residents));

      row.appendChild(c);
    }

    col.appendChild(row);
  }

  // нижний заголовок (симметрия)
  const foot = document.createElement('div');
  foot.className = 'entrance-footer';
  foot.textContent = `Подъезд ${entrance.entrance_number ?? ''}`;
  col.appendChild(foot);

  return col;
}

/** Построить блок паркинга (read-only, глобальная нумерация) */
function buildParkingPublic(data){
  const root = $('#parking'); if(!root) return;
  root.innerHTML = '';
  const card = $('#parkingCard');

  // источники уровней
  const house = data?.house || data || {};
  const levels = (house.parkings || data.parkings || house.Parkings || [])
    .slice()
    .sort((a,b)=> (toNum(b.level)||0) - (toNum(a.level)||0));

  if(!levels.length){ card?.remove(); return; }

  // Функция получения массива связей на уровне (поддержка разных кейсов именования)
  const getResidentParkings = (lvl)=> lvl?.ResidentParkings || lvl?.resident_parkings || lvl?.links || [];

  let spotCounter = 1; // сквозная нумерация по дому
  levels.forEach(l=>{
    const box = document.createElement('div');
    box.className = 'parking-level';
    box.innerHTML = `<div class="parking-title">Уровень ${l.level}</div>`;

    const grid = document.createElement('div');
    grid.className = 'parking-grid';

    const occ = getResidentParkings(l);

    for(let i=1; i<= (toNum(l.spots_count)||0); i++){
      const gnum = spotCounter;
      const cell = document.createElement('div');
      cell.className = 'cell parking-spot';
      cell.textContent = gnum;

      // кто занят?
      const hits = (occ || []).filter(rp => (toNum(rp.spot_number)||0) === gnum);
      const occupied = hits.length > 0;

      if(occupied){
        cell.classList.add('occupied');

        // собираем жильцов; пробуем разные форматы (residents[] или resident)
        const residentsHere = hits.flatMap(rp=>{
          if (Array.isArray(rp.residents)) {
            // прокинем флаг аренды, если есть на связи
            return rp.residents.map(r => ({ ...r, isTenant: (r.isTenant || rp.tenant === true || rp.type === 'tenant') }));
          }
          if (rp.resident) {
            return [{ ...rp.resident, isTenant: (rp.tenant === true || rp.type === 'tenant') }];
          }
          return [];
        });

        cell.addEventListener('click', ()=> openPublicDrawerFor('parking', gnum, residentsHere));
      }
      // свободные — без действий

      grid.appendChild(cell);
      spotCounter++;
    }

    box.appendChild(grid);
    root.appendChild(box);
  });
}

/** Построить блок кладовых (read-only, глобальная нумерация) */
function buildStoragesPublic(data){
  const root = $('#storages'); if(!root) return;
  root.innerHTML = '';
  const card = $('#storagesCard');

  const house = data?.house || data || {};
  const levels = (house.storages || data.storages || house.StorageUnits || [])
    .slice()
    .sort((a,b)=> (toNum(b.level)||0) - (toNum(a.level)||0));

  if(!levels.length){ card?.remove(); return; }

  const getResidentStorages = (lvl)=> lvl?.ResidentStorages || lvl?.resident_storages || lvl?.links || [];

  let unitCounter = 1; // сквозная нумерация по дому
  levels.forEach(l=>{
    const box = document.createElement('div');
    box.className = 'storage-level';
    box.innerHTML = `<div class="storage-title">Уровень ${l.level}</div>`;

    const grid = document.createElement('div');
    grid.className = 'storage-grid';

    const occ = getResidentStorages(l);

    for(let i=1; i<= (toNum(l.units_count)||0); i++){
      const gnum = unitCounter;
      const cell = document.createElement('div');
      cell.className = 'cell storage-unit';
      cell.textContent = gnum;

      const hits = (occ || []).filter(rs => (toNum(rs.unit_number)||0) === gnum);
      const occupied = hits.length > 0;

      if(occupied){
        cell.classList.add('occupied');

        const residentsHere = hits.flatMap(rs=>{
          if (Array.isArray(rs.residents)) {
            return rs.residents.map(r => ({ ...r, isTenant: (r.isTenant || rs.tenant === true || rs.type === 'tenant') }));
          }
          if (rs.resident) {
            return [{ ...rs.resident, isTenant: (rs.tenant === true || rs.type === 'tenant') }];
          }
          return [];
        });

        cell.addEventListener('click', ()=> openPublicDrawerFor('storage', gnum, residentsHere));
      }
      // свободные — без действий

      grid.appendChild(cell);
      unitCounter++;
    }

    box.appendChild(grid);
    root.appendChild(box);
  });
}

/** Главный рендер квартир */
function renderAptsBoard(data){
  const house = data?.house || data || {};
  const entrances = Array.isArray(data?.entrances) ? data.entrances : (house.Entrances || []);
  const apartments = Array.isArray(data?.apartments) ? data.apartments : [];
  const nonResidentialFirst = !!(house.non_residential_first_floor || data.non_residential_first_floor);

  // Заголовок
  $('#houseName').textContent = house.name || data.name || 'Дом';
  $('#houseMeta').textContent = house.address || data.address || '';

  if(!entrances.length){
    $('#boardNotice').innerHTML = '<span class="text-danger">Нет данных по подъездам.</span>';
    return { ok:false };
  }

  // Максимальный этаж по дому
  const maxFromEntrances = Math.max(0, ...entrances.map(e=>toNum(e.floors_count)||0));
  const maxFromApts = Math.max(0, ...apartments.map(a=>toNum(a.floor_number)||0));
  const maxFloors = Math.max(maxFromEntrances, maxFromApts, 0);
  const allFloorsDesc = Array.from({length:maxFloors}, (_,i)=> maxFloors-i);

  // Левая/правая колонка этажей
  buildFloorsColumn($('#floorsLeft'),  maxFloors);
  buildFloorsColumn($('#floorsRight'), maxFloors);

  // Индекс квартир для кликов
  const aptIndex = new Map();

  // Группируем квартиры по подъезду
  const byEntranceId = new Map();
  for(const ap of apartments){
    const eid = ap.entrance_id;
    if(eid==null) continue;
    if(!byEntranceId.has(eid)) byEntranceId.set(eid, []);
    byEntranceId.get(eid).push(ap);
  }

  // Колонки подъездов
  const board = $('#chessboard'); board.innerHTML = '';
  entrances
    .slice()
    .sort((a,b)=> (toNum(a.entrance_number)||0) - (toNum(b.entrance_number)||0))
    .forEach(e=>{
      const list = byEntranceId.get(e.id) || [];
      board.appendChild(renderEntranceColumn(e, list, allFloorsDesc, nonResidentialFirst, aptIndex));
    });

  // Делегирование по занятым (подстраховка)
  board.addEventListener('click', (ev)=>{
    const cell = ev.target.closest('.cell.occupied.apartment');
    if(!cell) return;
    const key = cell.dataset.key;
    // Мы уже дергаем openPublicDrawerFor напрямую при создании клетки,
    // поэтому здесь ничего не ищем — просто выходим.
  });

  // показать, убрать сообщение
  $('#boardRoot').hidden = false;
  $('#boardNotice').textContent = '';

  return { ok:true };
}

/** Bootstrap */
(async function init(){
  const slug = qs('slug');
  const $notice = $('#boardNotice');
  if(!slug){
    $('#houseName').textContent = 'Не указан slug дома';
    $('#houseMeta').textContent = 'Добавьте ?slug=<идентификатор-дома> в адресной строке.';
    $notice.innerHTML = 'Пример: <code>…/board.html?slug=dom-1</code>';
    return;
  }

  try{
    const api = (window.DOMUS_API_BASE_URL || '').replace(/\/+$/,'');
    const data = await apiGet(`${api}/public/board/${encodeURIComponent(slug)}`);

    // Квартиры
    renderAptsBoard(data);
    // Паркинг
    buildParkingPublic(data);
    // Кладовые
    buildStoragesPublic(data);

  }catch(e){
    console.error(e);
    $notice.innerHTML = `<span class="text-danger">Ошибка загрузки: ${(e && e.message) || e}</span>`;
  }
})();
