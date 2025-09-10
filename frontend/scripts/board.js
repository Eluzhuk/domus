/**
 * Публичная шахматка: загрузка и отрисовка
 * Запрос: GET ${DOMUS_API_BASE_URL}/public/board/:slug
 */

/**
 * Создает DOM-элемент жильца (маскированные поля уже пришли с сервера)
 * @param {{full_name:string, phone:string, email:string, telegram:string}} r
 * @returns {HTMLElement}
 */
function residentItem(r) {
const el = document.createElement('div');
el.className = 'small text-muted';
el.textContent = `${r.full_name} | ${r.phone} | ${r.email} | ${r.telegram}`;
return el;
}

/**
 * Рендерит данные шахматки
 * @param {any} data
 */
function renderBoard(data) {
const root = document.getElementById('board');
root.innerHTML = '';

const h = document.createElement('div');
h.className = 'mb-3';
h.innerHTML = `<strong>${data.house.name}</strong><br/><span>${data.house.address}</span>`;
root.appendChild(h);

const mapEntrance = new Map();
data.entrances.forEach(e => mapEntrance.set(e.id, e));

// Группируем квартиры по подъездам
const byEntrance = new Map();
data.apartments.forEach(a => {
	const arr = byEntrance.get(a.entrance_id) || [];
	arr.push(a);
	byEntrance.set(a.entrance_id, arr);
});

byEntrance.forEach((apartments, entranceId) => {
	const e = mapEntrance.get(entranceId);
	const wrap = document.createElement('div');
	wrap.className = 'mb-4';
	wrap.innerHTML = `<h2 class="h6 mb-2">Подъезд ${e.entrance_number}</h2>`;
	root.appendChild(wrap);

	const list = document.createElement('div');
	list.className = 'row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3';
	wrap.appendChild(list);

	apartments.forEach(a => {
		const card = document.createElement('div');
		card.className = 'col';
		card.innerHTML = `
		<div class="card h-100">
			<div class="card-body">
				<div class="fw-semibold mb-1">Кв. ${a.apartment_number} • Этаж ${a.floor_number}</div>
				<div id="res-${a.id}"></div>
			</div>
		</div>`;
		list.appendChild(card);
		const resWrap = card.querySelector(`#res-${a.id}`);
		if (!a.residents || a.residents.length === 0) {
		resWrap.innerHTML = '<span class="text-success small">Свободно</span>';
		} else {
		a.residents.forEach(r => resWrap.appendChild(residentItem(r)));
		}
	});
});

if (data.unassigned_residents?.length) {
	const u = document.createElement('div');
	u.className = 'mt-4';
	u.innerHTML = '<h2 class="h6">Без привязки</h2>';
	data.unassigned_residents.forEach(r => u.appendChild(residentItem(r)));
	root.appendChild(u);
}
}

async function loadBoard(slug) {
const url = `${window.DOMUS_API_BASE_URL}/public/board/${encodeURIComponent(slug)}`;
const r = await fetch(url);
if (!r.ok) {
	document.getElementById('board').innerHTML = `<div class="alert alert-danger">Ошибка загрузки (${r.status})</div>`;
	return;
}
const data = await r.json();
renderBoard(data);
}

document.getElementById('loadBtn')?.addEventListener('click', () => {
const slug = document.getElementById('slug').value.trim();
if (!slug) { alert('Укажите slug дома'); return; }
loadBoard(slug);
});
