/**
 * boardService: публичная шахматка (маскирование ПДн на сервере)
 */
const { sequelize } = require('../models');

/**
 * Маскирует персональные данные по флагам или по умолчанию.
 * @param {object} r - запись жильца
 * @returns {object}
 */
function maskResident(r) {
// Если нет флагов — маскируем всё кроме ФИО (инициалы)
const show = r.privacy || {};
const name = r.full_name || '';
const parts = name.split(' ');
const initials = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : (name ? `${name[0]}***` : '***');

const safe = {
	id: r.id,
	full_name: show.show_full_name ? name : initials,
	phone: show.show_phone ? r.phone : '****',
	email: show.show_email ? r.email : '****',
	telegram: show.show_telegram ? r.telegram : '****',
};
return safe;
}

/**
 * Возвращает данные для публичной шахматки по house.slug.
 * Маскирует ПДн на сервере согласно флагам privacy (по умолчанию — скрыто).
 * @param {string} slug
 * @returns {Promise<null|{house:any, entrances:any[], apartments:any[], unassigned_residents:any[]}>}
 */
async function getBoardBySlug(slug) {
// 1) Дом
const [houseRows] = await sequelize.query(
	`SELECT id, name, address, slug FROM houses WHERE slug = :slug`,
	{ replacements: { slug } }
);
if (!houseRows.length) return null;
const house = houseRows[0];

// 2) Подъезды дома
const [entrances] = await sequelize.query(
	`SELECT id, entrance_number, floors_count, apartments_per_floor
	FROM entrances
	WHERE house_id = :houseId
	ORDER BY entrance_number`,
	{ replacements: { houseId: house.id } }
);

// 3) Квартиры (через JOIN для жёсткой фильтрации по дому)
const [apartments] = await sequelize.query(
	`SELECT a.id, a.entrance_id, a.floor_number, a.apartment_number
	FROM apartments a
	JOIN entrances e ON e.id = a.entrance_id
	WHERE e.house_id = :houseId
	ORDER BY e.entrance_number, a.floor_number, a.apartment_number`,
	{ replacements: { houseId: house.id } }
);

// 4) Жильцы + привязки + флаги приватности (всегда коалесцируем к FALSE)
const [residents] = await sequelize.query(
	`SELECT
		r.id,
		r.full_name,
		r.phone,
		r.email,
		r.telegram,
		r.house_id,
		ra.apartment_id,
		COALESCE(rp.show_full_name, FALSE) AS show_full_name,
		COALESCE(rp.show_phone,     FALSE) AS show_phone,
		COALESCE(rp.show_email,     FALSE) AS show_email,
		COALESCE(rp.show_telegram,  FALSE) AS show_telegram
	FROM residents r
	LEFT JOIN resident_apartments ra ON ra.resident_id = r.id
	LEFT JOIN resident_privacy rp    ON rp.resident_id = r.id
	WHERE r.house_id = :houseId`,
	{ replacements: { houseId: house.id } }
);

// 5) Словарь жильцов по квартире
const byApartment = new Map();
residents.forEach(r => {
	const key = r.apartment_id || 'unassigned';
	const privacy = {
		show_full_name: r.show_full_name,
		show_phone:     r.show_phone,
		show_email:     r.show_email,
		show_telegram:  r.show_telegram,
	};
	const arr = byApartment.get(key) || [];
	arr.push(maskResident({ ...r, privacy }));
	byApartment.set(key, arr);
});

// 6) Ответ
return {
	house: { id: house.id, name: house.name, address: house.address, slug: house.slug },
	entrances, // ≤— теперь определена в этой области видимости
	apartments: apartments.map(a => ({
		id: a.id,
		entrance_id: a.entrance_id,
		floor_number: a.floor_number,
		apartment_number: a.apartment_number,
		residents: byApartment.get(a.id) || [],
	})),
// жильцы без привязки
	unassigned_residents: byApartment.get('unassigned') || [],
};
}

module.exports = { getBoardBySlug };
