/**
 * boardService: публичная шахматка (маскирование ПДн на сервере)
 * Возвращает структуру дома для публичной страницы:
 * {
 *   house: { id, name, address, slug, non_residential_first_floor },
 *   entrances: [{ id, entrance_number, floors_count, apartments_per_floor }],
 *   apartments: [{ id, entrance_id, floor_number, apartment_number, residents: [maskedResident] }],
 *   parkings: [{ id, level, spots_count, ResidentParkings: [{ spot_number, residents:[maskedResident] }] }],
 *   storages: [{ id, level, units_count, ResidentStorages: [{ unit_number, residents:[maskedResident] }] }],
 *   unassigned_residents: []
 * }
 */
const { sequelize } = require('../models');

/** Маскирование строки: буквы/цифры -> *, пунктуация/пробелы сохраняются */
function maskString(s) {
  if (!s) return '';
  return String(s).replace(/[A-Za-zА-Яа-яЁё0-9]/g, '*');
}

/**
 * Маскирует персональные данные по флагам privacy.
 * По умолчанию (если privacy нет) — скрываем всё, кроме инициалов ФИО.
 * @param {object} r - запись жильца (из residents)
 * @param {object} [privacy] - {show_full_name, show_phone, show_email, show_telegram}
 */
function maskResident(r, privacy) {
  const p = privacy || {};
  const name = (r.full_name || '').trim();

  // ФИО: если show_full_name === false — отдаем инициалы: "Иванов И."
  let full_name = name;
  if (p.show_full_name === false) {
    if (name) {
      const parts = name.split(/\s+/);
      if (parts.length > 1) full_name = `${parts[0]} ${parts[1][0]}.`;
      else full_name = `${name[0]}***`;
    } else {
      full_name = '***';
    }
  }

  const phone    = p.show_phone    === false ? maskString(r.phone)    : (r.phone || null);
  const email    = p.show_email    === false ? maskString(r.email)    : (r.email || null);
  const telegram = p.show_telegram === false ? maskString(r.telegram) : (r.telegram || null);

  return { id: r.id, full_name, phone, email, telegram };
}

/**
 * Получить структуру шахматки по slug дома (публично).
 * Маскирование выполняется здесь.
 */
async function getBoardBySlug(slug) {
  // Дом
  const [houses] = await sequelize.query(
    `SELECT id, name, address, slug, COALESCE(non_residential_first_floor,false) AS non_residential_first_floor
     FROM houses WHERE slug = :slug LIMIT 1`,
    { replacements: { slug } }
  );
  const house = houses && houses[0];
  if (!house) return null;
  const houseId = house.id;

  // Подъезды
  const [entrances] = await sequelize.query(
    `SELECT id, house_id, entrance_number, floors_count, apartments_per_floor
       FROM entrances
      WHERE house_id = :houseId
      ORDER BY entrance_number ASC`,
    { replacements: { houseId } }
  );

  // Квартиры
  const [apartments] = await sequelize.query(
    `SELECT a.id, a.entrance_id, a.floor_number, a.apartment_number
       FROM apartments a
       JOIN entrances e ON e.id = a.entrance_id
      WHERE e.house_id = :houseId
      ORDER BY a.entrance_id, a.floor_number DESC, a.apartment_number ASC`,
    { replacements: { houseId } }
  );

  // Жильцы + privacy
  const [residents] = await sequelize.query(
    `SELECT r.id, r.full_name, r.phone, r.email, r.telegram,
            p.show_full_name, p.show_phone, p.show_email, p.show_telegram
       FROM residents r
  LEFT JOIN resident_privacy p ON p.resident_id = r.id
      WHERE r.house_id = :houseId`,
    { replacements: { houseId } }
  );

  const privacyByResident = new Map(residents.map(r => [r.id, {
    show_full_name: r.show_full_name,
    show_phone: r.show_phone,
    show_email: r.show_email,
    show_telegram: r.show_telegram,
  }]));
  const residentBaseById = new Map(residents.map(r => [r.id, {
    id: r.id, full_name: r.full_name, phone: r.phone, email: r.email, telegram: r.telegram
  }]));

  // Привязки жильцов к квартирам
  const [rap] = await sequelize.query(
    `SELECT ra.resident_id, ra.apartment_id, ra.type
       FROM resident_apartments ra
       JOIN apartments a ON a.id = ra.apartment_id
       JOIN entrances e ON e.id = a.entrance_id
      WHERE e.house_id = :houseId`,
    { replacements: { houseId } }
  );

  const byApartment = new Map();
  for (const link of rap) {
    const base = residentBaseById.get(link.resident_id);
    if (!base) continue;
    const priv = privacyByResident.get(link.resident_id);
    const masked = maskResident(base, priv);
    const out = { ...masked, type: link.type, isTenant: link.type === 'tenant' };
    if (!byApartment.has(link.apartment_id)) byApartment.set(link.apartment_id, []);
    byApartment.get(link.apartment_id).push(out);
  }

  // ==== Паркинг: уровни + связи ====
  const [parkings] = await sequelize.query(
    `SELECT id, house_id, level, spots_count
       FROM parkings
      WHERE house_id = :houseId
      ORDER BY level DESC`,
    { replacements: { houseId } }
  );
  const [rpLinks] = await sequelize.query(
    `SELECT rp.parking_id, rp.spot_number, rp.type, rp.resident_id,
            r.full_name, r.phone, r.email, r.telegram,
            p.show_full_name, p.show_phone, p.show_email, p.show_telegram
       FROM resident_parkings rp
       JOIN parkings pk ON pk.id = rp.parking_id
       JOIN residents r ON r.id = rp.resident_id
  LEFT JOIN resident_privacy p ON p.resident_id = r.id
      WHERE pk.house_id = :houseId`,
    { replacements: { houseId } }
  );
  const residentParkingsByLevel = new Map(); // parking_id -> Map(spot_number -> [residents])
  for (const row of rpLinks) {
    const masked = maskResident(row, {
      show_full_name: row.show_full_name,
      show_phone: row.show_phone,
      show_email: row.show_email,
      show_telegram: row.show_telegram,
    });
    const out = { ...masked, type: row.type, isTenant: row.type === 'tenant' };
    if (!residentParkingsByLevel.has(row.parking_id)) {
      residentParkingsByLevel.set(row.parking_id, new Map());
    }
    const m = residentParkingsByLevel.get(row.parking_id);
    if (!m.has(row.spot_number)) m.set(row.spot_number, []);
    m.get(row.spot_number).push(out);
  }
  const parkingsOut = parkings.map(pk => {
    const m = residentParkingsByLevel.get(pk.id) || new Map();
    const ResidentParkings = [];
    for (const [spot_number, residentsAtSpot] of m.entries()) {
      ResidentParkings.push({ spot_number, residents: residentsAtSpot });
    }
    return { id: pk.id, level: pk.level, spots_count: pk.spots_count, ResidentParkings };
  });

  // ==== Кладовые: уровни + связи ====
  const [storages] = await sequelize.query(
    `SELECT id, house_id, level, units_count
       FROM storages
      WHERE house_id = :houseId
      ORDER BY level DESC`,
    { replacements: { houseId } }
  );
  const [rsLinks] = await sequelize.query(
    `SELECT rs.storage_id, rs.unit_number, rs.type, rs.resident_id,
            r.full_name, r.phone, r.email, r.telegram,
            p.show_full_name, p.show_phone, p.show_email, p.show_telegram
       FROM resident_storage rs
       JOIN storages st ON st.id = rs.storage_id
       JOIN residents r ON r.id = rs.resident_id
  LEFT JOIN resident_privacy p ON p.resident_id = r.id
      WHERE st.house_id = :houseId`,
    { replacements: { houseId } }
  );
  const residentStoragesByLevel = new Map(); // storage_id -> Map(unit_number -> [residents])
  for (const row of rsLinks) {
    const masked = maskResident(row, {
      show_full_name: row.show_full_name,
      show_phone: row.show_phone,
      show_email: row.show_email,
      show_telegram: row.show_telegram,
    });
    const out = { ...masked, type: row.type, isTenant: row.type === 'tenant' };
    if (!residentStoragesByLevel.has(row.storage_id)) {
      residentStoragesByLevel.set(row.storage_id, new Map());
    }
    const m = residentStoragesByLevel.get(row.storage_id);
    if (!m.has(row.unit_number)) m.set(row.unit_number, []);
    m.get(row.unit_number).push(out);
  }
  const storagesOut = storages.map(st => {
    const m = residentStoragesByLevel.get(st.id) || new Map();
    const ResidentStorages = [];
    for (const [unit_number, residentsAtUnit] of m.entries()) {
      ResidentStorages.push({ unit_number, residents: residentsAtUnit });
    }
    return { id: st.id, level: st.level, units_count: st.units_count, ResidentStorages };
  });

  // Результат
  return {
    house,
    entrances,
    apartments: apartments.map(a => ({
      id: a.id,
      entrance_id: a.entrance_id,
      floor_number: a.floor_number,
      apartment_number: a.apartment_number,
      residents: byApartment.get(a.id) || [],
    })),
    parkings: parkingsOut,
    storages: storagesOut,
    unassigned_residents: [],
  };
}

module.exports = { getBoardBySlug };
