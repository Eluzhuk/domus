/**
 * Контроллер домов (House).
 * Добавлена полноценная поддержка slug:
 * - генерация из name (RU->EN, kebab-case) при создании, если не передан
 * - нормализация/уникализация при create/update
 * - возврат slug в списке домов и структуре дома
 */

const { House, Entrance, Apartment, ResidentApartment, ResidentParking, Resident, Parking, StorageUnit, ResidentStorage, ResidentPrivacy, sequelize } = require('../models');
const { Op } = require('sequelize');

/* ============================
   Утилиты для работы со slug
   ============================ */

/**
 * Простейшая транслитерация RU->EN для названия дома.
 * @param {string} s
 * @returns {string}
 */
function translitRu(s) {
  const map = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y',
    к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
    х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
  };
  return String(s || '')
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('');
}

/**
 * Преобразование строки в kebab-case: [a-z0-9-], без краевых/двойных дефисов.
 * @param {string} s
 * @returns {string}
 */
function toKebab(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // любые не [a-z0-9] -> дефис
    .replace(/-+/g, '-')          // схлопываем подряд дефисы
    .replace(/^-|-$/g, '');       // убираем дефисы по краям
}

/**
 * Нормализация пользовательского slug (без транслита).
 * @param {string} s
 * @returns {string}
 */
function normalizeSlug(s) {
  return toKebab(s);
}

/** Короткий суффикс для устранения коллизий. */
function shortSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Гарантирует уникальность slug среди домов.
 * Если занят — добавляет суффикс "-xxxx".
 * @param {string} base
 * @param {number|null} currentId
 * @returns {Promise<string>}
 */
async function ensureUniqueSlug(base, currentId = null) {
  let candidate = base || 'house';
  let exists = await House.findOne({
    where: currentId
      ? { slug: candidate, id: { [Op.ne]: currentId } }
      : { slug: candidate }
  });
  if (!exists) return candidate;

  for (let i = 0; i < 5; i++) {
    const withSuffix = `${candidate}-${shortSuffix()}`;
    // eslint-disable-next-line no-await-in-loop
    exists = await House.findOne({
      where: currentId
        ? { slug: withSuffix, id: { [Op.ne]: currentId } }
        : { slug: withSuffix }
    });
    if (!exists) return withSuffix;
  }
  return `${candidate}-${Date.now().toString(36)}`;
}

/* =========================================
   1) Получение всех домов (со счётчиками)
   ========================================= */

/**
 * GET /api/houses
 * Возвращает список домов с агрегатами и slug.
 */
exports.getAllHouses = async (req, res) => {
  try {
    const houses = await House.findAll({
      include: [
        {
          model: Entrance,
          include: [
            {
              model: Apartment,
              include: [
                {
                  model: ResidentApartment,
                  include: [{ model: Resident, attributes: ['id'] }]
                }
              ]
            }
          ]
        },
        {
          model: Parking,
          include: [
            {
              model: ResidentParking,
              include: [{ model: Resident, attributes: ['id'] }]
            }
          ]
        },
        {
          model: StorageUnit,
          include: [
            {
              model: ResidentStorage,
              include: [{ model: Resident, attributes: ['id'] }]
            }
          ]
        }
      ]
    });

    const formattedHouses = houses.map((house) => {
      const totalResidents = new Set();

      // Общее количество объектов
      const totalApartments = house.Entrances.reduce((acc, e) => acc + e.Apartments.length, 0);
      const totalParkingSpots = house.Parkings.reduce((acc, p) => acc + p.spots_count, 0);
      const totalStorages = house.StorageUnits.reduce((acc, s) => acc + s.units_count, 0);

      // Квартиры: занятые по факту наличия связей
      const occupiedApartments = house.Entrances.reduce((acc, entrance) => {
        return acc + entrance.Apartments.filter(apartment => {
          if ((apartment.ResidentApartments || []).length > 0) {
            apartment.ResidentApartments.forEach(res => totalResidents.add(res.Resident.id));
            return true;
          }
          return false;
        }).length;
      }, 0);

      // Паркинг: считаем УНИКАЛЬНЫЕ занятые места по spot_number
      const occupiedParking = (() => {
        const spots = new Set();
        for (const parking of house.Parkings) {
          for (const rp of (parking.ResidentParkings || [])) {
            const val = rp?.spot_number;
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              spots.add(String(val).trim());
            }
          }
        }
        return spots.size;
      })();

      // Кладовые: считаем УНИКАЛЬНЫЕ занятые по unit_number
      const occupiedStorages = (() => {
        const units = new Set();
        for (const storage of house.StorageUnits) {
          for (const rs of (storage.ResidentStorages || [])) {
            const val = rs?.unit_number;
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              units.add(String(val).trim());
            }
          }
        }
        return units.size;
      })();

      // Проценты
      const apartmentOccupancyRate = totalApartments ? Math.round((occupiedApartments / totalApartments) * 100) : 0;
      const parkingOccupancyRate = totalParkingSpots ? Math.round((occupiedParking / totalParkingSpots) * 100) : 0;
      const storageOccupancyRate = totalStorages ? Math.round((occupiedStorages / totalStorages) * 100) : 0;

      return {
        id: house.id,
        name: house.name,
        address: house.address,
        slug: house.slug || null,
        totalApartments,
        totalParkingSpots,
        totalStorages,
        occupiedApartments,
        occupiedParking,
        occupiedStorages,
        apartmentOccupancyRate,
        parkingOccupancyRate,
        storageOccupancyRate,
        totalResidents: totalResidents.size
      };
    });

    res.json(formattedHouses);
  } catch (error) {
    console.error('Ошибка при получении домов:', error);
    res.status(500).json({ error: 'Ошибка при получении домов' });
  }
};

/* ======================
   2) Создание нового дома
   ====================== */

/**
 * POST /api/houses
 * Тело: { name, address, slug?, non_residential_first_floor, entrances[], parking[], storage[] }
 * Если slug не указан — генерируем из name.
 */
exports.createHouse = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, address, slug: slugRaw, non_residential_first_floor, entrances, parking, storage } = req.body || {};

    if (!name || !address) {
      await t.rollback();
      return res.status(400).json({ error: 'Поля name и address обязательны' });
    }

    // Подготовка slug
    let slug = (typeof slugRaw === 'string' && slugRaw.trim()) ? normalizeSlug(slugRaw) : toKebab(translitRu(name));
    slug = await ensureUniqueSlug(slug);

    // Создаём дом
    const newHouse = await House.create(
      { name, address, slug, non_residential_first_floor: !!non_residential_first_floor },
      { transaction: t }
    );

    // Нумерация квартир — сквозная
    let currentApartmentNumber = 1;

    // Подъезды/квартиры
    if (Array.isArray(entrances) && entrances.length > 0) {
      for (const entrance of entrances) {
        const newEntrance = await Entrance.create({
          house_id: newHouse.id,
          entrance_number: entrance.entrance_number,
          floors_count: entrance.floors_count,
          apartments_per_floor: entrance.apartments_per_floor
        }, { transaction: t });

        const startFloor = newHouse.non_residential_first_floor ? 2 : 1;

        for (let floor = startFloor; floor <= entrance.floors_count; floor++) {
          for (let apt = 1; apt <= entrance.apartments_per_floor; apt++) {
            await Apartment.create({
              entrance_id: newEntrance.id,
              floor_number: floor,
              apartment_number: currentApartmentNumber
            }, { transaction: t });
            currentApartmentNumber++;
          }
        }
      }
    }

    // Паркинг
    if (Array.isArray(parking) && parking.length > 0) {
      for (const park of parking) {
        await Parking.create({
          house_id: newHouse.id,
          level: park.level,
          spots_count: park.spots_count
        }, { transaction: t });
      }
    }

    // Кладовые
    if (Array.isArray(storage) && storage.length > 0) {
      for (const store of storage) {
        await StorageUnit.create({
          house_id: newHouse.id,
          level: store.level,
          units_count: store.units_count
        }, { transaction: t });
      }
    }

    await t.commit();
	res.status(201).json({
	id: newHouse.id,
	name: newHouse.name,
	address: newHouse.address,
	slug, // возвращаем тот, что сгенерировали/уникализировали
	non_residential_first_floor: newHouse.non_residential_first_floor
	});

  } catch (error) {
    await t.rollback();
    console.error('Ошибка при создании дома:', error);
    res.status(500).json({ error: 'Ошибка при создании' });
  }
};

/* =====================
   3) Редактирование дома
   ===================== */

/**
 * PUT /api/houses/:id
 * Тело (опционально): { name, address, slug?, non_residential_first_floor? }
 * Если передан slug — нормализуем и уникализируем.
 */
exports.updateHouse = async (req, res) => {
  try {
    const { id } = req.params;
    const houseId = parseInt(id, 10);
    if (!houseId || Number.isNaN(houseId)) return res.status(400).json({ error: 'Некорректный ID дома' });

    const { name, address, slug: slugRaw, non_residential_first_floor } = req.body || {};

    const house = await House.findByPk(houseId);
    if (!house) return res.status(404).json({ error: 'Дом не найден' });

    if (typeof name === 'string' && name.trim()) house.name = name.trim();
    if (typeof address === 'string' && address.trim()) house.address = address.trim();
    if (typeof non_residential_first_floor !== 'undefined') {
      house.non_residential_first_floor = !!non_residential_first_floor;
    }

    if (typeof slugRaw === 'string') {
      let newSlug = normalizeSlug(slugRaw);
      if (!newSlug) newSlug = toKebab(translitRu(house.name || 'house'));
      house.slug = await ensureUniqueSlug(newSlug, houseId);
    }

    await house.save();

    res.json({
      message: 'Дом успешно обновлён',
      house: {
        id: house.id,
        name: house.name,
        address: house.address,
        slug: house.slug,
        non_residential_first_floor: house.non_residential_first_floor
      }
    });
  } catch (error) {
    console.error('Ошибка при обновлении дома:', error);
    res.status(500).json({ error: 'Ошибка при обновлении дома' });
  }
};

/* ===============
   4) Удаление дома
   =============== */

/**
 * DELETE /api/houses/:id
 */
exports.deleteHouse = async (req, res) => {
  try {
    const { id } = req.params;

    const house = await House.findByPk(id);
    if (!house) {
      return res.status(404).json({ error: 'Дом не найден' });
    }

    await house.destroy();
    res.json({ message: 'Дом успешно удалён' });
  } catch (error) {
    console.error('Ошибка при удалении дома:', error);
    res.status(500).json({ error: 'Ошибка при удалении дома' });
  }
};

/* =========================================
   5) Полная структура дома (для шахматки)
   ========================================= */

/**
 * GET /api/houses/:id/structure
 * Возвращает дом с подъездами/квартирами/паркингом/кладовыми и связями жильцов.
 * В ответе есть slug дома.
 */
exports.getHouseStructure = async (req, res) => {
  try {
    const { id } = req.params;

    const house = await House.findByPk(id, {
      include: [
        {
          model: Entrance,
          include: [
            {
              model: Apartment,
              include: [
                {
                  model: ResidentApartment,
                  include: [
                    {
                      model: Resident,
                      attributes: ['id', 'full_name', 'phone', 'email', 'telegram'],
                      include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name', 'show_phone', 'show_email', 'show_telegram'] }]
                    }
                  ]
                }
              ]
            }
          ]
          // Примечание: сортировку подъездов лучше задавать в опции order (см. ниже), но оставляем как есть, чтобы не ломать существующую логику.
        },
        {
          model: Parking,
          include: [
            {
              model: ResidentParking,
              include: [
                {
                  model: Resident,
                  attributes: ['id', 'full_name', 'phone', 'email', 'telegram'],
                  include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name', 'show_phone', 'show_email', 'show_telegram'] }]
                }
              ]
            }
          ]
        },
        {
          model: StorageUnit,
          include: [
            {
              model: ResidentStorage,
              include: [
                {
                  model: Resident,
                  attributes: ['id', 'full_name', 'phone', 'email', 'telegram'],
                  include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name', 'show_phone', 'show_email', 'show_telegram'] }]
                }
              ]
            }
          ]
        }
      ],
      order: [
        // Общая сортировка: подъезды по entrance_number, квартиры по apartment_number
        [Entrance, 'entrance_number', 'ASC'],
        [Entrance, Apartment, 'apartment_number', 'ASC']
      ]
    });

    if (!house) {
      return res.status(404).json({ error: 'Дом не найден' });
    }

    const houseData = house.toJSON();
    // Явно убеждаемся, что slug присутствует в ответе
    houseData.slug = house.slug;

    // Помечаем квартиры флагом занятости для удобства фронта
    houseData.Entrances = (houseData.Entrances || []).map((entrance) => ({
      ...entrance,
      Apartments: (entrance.Apartments || []).map((apartment) => ({
        ...apartment,
        isOccupied: Array.isArray(apartment.ResidentApartments) && apartment.ResidentApartments.length > 0
      }))
    }));

    res.json(houseData);
  } catch (error) {
    console.error('Ошибка при получении структуры дома:', error);
    res.status(500).json({ error: 'Ошибка при загрузке данных' });
  }
};

/* ===================================
   6) Упрощённая визуализация (legacy)
   =================================== */

/**
 * GET /api/houses/:id/visualization
 * Возвращает только список квартир с флагом занятости.
 */
exports.getHouseVisualization = async (req, res) => {
  try {
    const houseId = parseInt(req.params.id, 10);

    const apartments = await Apartment.findAll({
      where: { '$Entrance.house_id$': houseId },
      include: [
        {
          model: ResidentApartment,
          attributes: ['resident_id']
        },
        {
          association: 'Entrance',
          attributes: [] // без лишних полей подъезда
        }
      ]
    });

    const apartmentsData = apartments.map(apartment => ({
      id: apartment.id,
      floor_number: apartment.floor_number,
      apartment_number: apartment.apartment_number,
      isOccupied: Array.isArray(apartment.ResidentApartments) && apartment.ResidentApartments.length > 0
    }));

    res.status(200).json({ apartments: apartmentsData });
  } catch (error) {
    console.error('Ошибка получения визуализации дома:', error);
    res.status(500).json({ message: 'Ошибка сервера.' });
  }
};
