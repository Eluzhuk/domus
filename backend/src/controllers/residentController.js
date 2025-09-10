//backend\controllers\residentController.js

const { Resident, ResidentApartment, ResidentParking, ResidentStorage, Apartment, Parking, StorageUnit, House, Entrance, ResidentPrivacy } = require('../models');
const sequelize = require('../db');
const { Op } = require('sequelize');

// Сохранение квартир
async function syncApartments(residentId, apartments, houseId) {
	await ResidentApartment.destroy({ where: { resident_id: residentId } });

	if (apartments && apartments.length > 0) {
		for (const apartment of apartments) {
			const dbApartment = await Apartment.findOne({
					where: {
						apartment_number: apartment.number,
						entrance_id: {
							[Op.in]: sequelize.literal(`(
									SELECT id FROM entrances WHERE house_id = ${houseId}
							)`)
						}
					}
			});

			if (!dbApartment) {
					throw new Error(`Квартира с номером ${apartment.number} не найдена в указанном доме.`);
			}

			await ResidentApartment.create({
					resident_id: residentId,
					apartment_id: dbApartment.id,
					type: apartment.tenant ? 'tenant' : 'owner'
			});
		}
	}
}

// Сохранение парковок
async function syncParking(residentId, parking, houseId) {
	await ResidentParking.destroy({ where: { resident_id: residentId } });

	if (parking && parking.length > 0) {
		const allParkings = await Parking.findAll({ where: { house_id: houseId } });

		if (allParkings.length > 0) {
			let currentSpot = 0;
			const parkingRanges = allParkings.map((park) => {
					const range = {
						parking_id: park.id,
						start: currentSpot + 1,
						end: currentSpot + park.spots_count
					};
					currentSpot += park.spots_count;
					return range;
			});

			for (const spot of parking) {
					if (!spot.number) continue;

					const matchingRange = parkingRanges.find(
						(range) => spot.number >= range.start && spot.number <= range.end
					);

					if (!matchingRange) {
						throw new Error(`Номер парковочного места ${spot.number} выходит за пределы диапазона (1-${currentSpot}).`);
					}

					await ResidentParking.create({
						resident_id: residentId,
						parking_id: matchingRange.parking_id,
						spot_number: spot.number,
						type: spot.tenant ? 'tenant' : 'owner'
					});
			}
		}
	}
}

// Сохранение кладовых
async function syncStorages(residentId, storages, houseId) {
	await ResidentStorage.destroy({ where: { resident_id: residentId } });

	if (storages && storages.length > 0) {
		const allStorages = await StorageUnit.findAll({ where: { house_id: houseId } });

		if (allStorages.length > 0) {
			let currentUnit = 0;
			const storageRanges = allStorages.map((storage) => {
					const range = {
						storage_id: storage.id,
						start: currentUnit + 1,
						end: currentUnit + storage.units_count
					};
					currentUnit += storage.units_count;
					return range;
			});

			for (const unit of storages) {
					if (!unit.number) continue;

					const matchingRange = storageRanges.find(
						(range) => unit.number >= range.start && unit.number <= range.end
					);

					if (!matchingRange) {
						throw new Error(`Номер кладовой ${unit.number} выходит за пределы диапазона (1-${currentUnit}).`);
					}

					await ResidentStorage.create({
						resident_id: residentId,
						storage_id: matchingRange.storage_id,
						unit_number: unit.number,
						type: unit.tenant ? 'tenant' : 'owner'
					});
			}
		}
	}
}


exports.addResident = async (req, res) => {
	try {
		console.log('Полученные данные:', req.body);
		const { full_name, phone, email, telegram, apartments, parking, storages } = req.body;
		const { house_id } = req.params; // Берём house_id из URL

		if (!house_id) {
				return res.status(400).json({ message: 'Поле "house_id" обязательно.' });
		}

		const house = await House.findByPk(house_id);
		if (!house) {
				return res.status(404).json({ message: 'Дом с указанным ID не найден.' });
		}

		// Создание жильца
		const newResident = await Resident.create({
				full_name,
				phone: phone || null,
				email: email || null,
				telegram: telegram || null,
				house_id: house_id
		});

		// Сохраняем приватность, если пришла
		if (req.body.privacy) {
		const p = req.body.privacy;
		await ResidentPrivacy.upsert({
			resident_id: newResident.id,         // ✅ используем только что созданного жильца
			show_full_name: p.show_full_name !== false,
			show_phone:     p.show_phone     !== false,
			show_email:     p.show_email     !== false,
			show_telegram:  p.show_telegram  !== false,
		});
		}

		// Связь с квартирами
		await syncApartments(newResident.id, apartments, house_id);
		// Связь с парковками
		await syncParking(newResident.id, parking, house_id);
		// Связь с кладовыми
		await syncStorages(newResident.id, storages, house_id);

		res.status(201).json({ message: 'Жилец успешно добавлен.', resident: newResident });
	} catch (error) {
		console.error('Ошибка добавления жильца:', error);
		res.status(500).json({ message: 'Ошибка сервера.' });
	}
};

exports.getResidentById = async (req, res) => {
	try {
		const residentId = req.params.id;

		const resident = await Resident.findByPk(residentId, {
			include: [
				{model: House, attributes: ['id'],},
				{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name','show_phone','show_email','show_telegram']},
				{model: ResidentApartment,
					include: [{model: Apartment,attributes: ['apartment_number'],
					include: [{model: Entrance,attributes: ['entrance_number'],
					},],
					},],
				},
				{model: ResidentParking,
					include: [{model: Parking,attributes: ['level'],},],
				},
				{model: ResidentStorage,include: [{model: StorageUnit,attributes: ['level'],},],
				},
			],
		});

		if (!resident) {
			return res.status(404).json({ message: 'Жилец не найден.' });
		}

		// Преобразуем данные в удобный формат
		const apartments = resident.ResidentApartments.map((ra) => ({
			number: ra.Apartment.apartment_number,
			tenant: ra.type === 'tenant'
		}));

		const parking = resident.ResidentParkings.map((rp) => ({
			number: rp.spot_number,
			tenant: rp.type === 'tenant'
		}));

		const storages = resident.ResidentStorages.map((rs) => ({
			number: rs.unit_number,
			tenant: rs.type === 'tenant'
		}));

		res.status(200).json({
			full_name: resident.full_name,
			phone: resident.phone,
			email: resident.email,
			telegram: resident.telegram,
			privacy: resident.privacy || { show_full_name: true, show_phone: true, show_email: true, show_telegram: true },
			house_id: resident.House.id,
			apartments,
			parking,
			storages
		});
	} catch (error) {
		console.error('Ошибка получения данных жильца:', error);
		res.status(500).json({ message: 'Ошибка сервера.' });
	}
};


exports.updateResident = async (req, res) => {
	try {
		 const residentId = req.params.id;
		 const { full_name, phone, email, telegram, apartments, parking, storages } = req.body;

		 console.log('Полученные данные для обновления:', req.body); // Лог данных

		 const resident = await Resident.findByPk(residentId);
		 if (!resident) {
			return res.status(404).json({ message: 'Жилец не найден.' });
		}

		if (!resident.house_id) {
			return res.status(400).json({ message: 'Идентификатор дома отсутствует у жильца.' });
		}

		// Обновление данных жильца
		resident.full_name = full_name || resident.full_name;
		resident.phone = phone || resident.phone;
		resident.email = email || resident.email;
		resident.telegram = telegram || resident.telegram;
		await resident.save();

		if (req.body.privacy) {
		const p = req.body.privacy;
		await ResidentPrivacy.upsert({
			resident_id: residentId,
			show_full_name: p.show_full_name !== false,
			show_phone: p.show_phone !== false,
			show_email: p.show_email !== false,
			show_telegram: p.show_telegram !== false,
		});
		}

		// Связь с квартирами
		await syncApartments(residentId, apartments, resident.house_id);
		// Связь с парковками
		await syncParking(residentId, parking, resident.house_id);
		// Связь с кладовыми
		await syncStorages(residentId, storages, resident.house_id);

		 res.status(200).json({ message: 'Жилец успешно обновлён.' });
	} catch (error) {
		 console.error('Ошибка обновления жильца:', error);
		 res.status(500).json({ message: 'Ошибка сервера.' });
	}
};

exports.deleteResident = async (req, res) => {
	try {
		const residentId = req.params.id;

		// Проверка наличия жильца
		const resident = await Resident.findByPk(residentId);
		if (!resident) {
			return res.status(404).json({ message: 'Жилец не найден.' });
		}

		// Удаление связанных записей
		await ResidentApartment.destroy({ where: { resident_id: residentId } });
		await ResidentParking.destroy({ where: { resident_id: residentId } });
		await ResidentStorage.destroy({ where: { resident_id: residentId } });

		// Удаление жильца
		await resident.destroy();

		res.status(200).json({ message: 'Жилец успешно удалён.' });
	} catch (error) {
		console.error('Ошибка удаления жильца:', error);
		res.status(500).json({ message: 'Ошибка сервера.' });
	}
};

/**
 * Отвязка жильца от конкретного объекта.
 * Ожидает в body:
 *  - relation: 'apartment' | 'parking' | 'storage'
 *  - relation_id: number (ID строки связи: ResidentApartment/ResidentParking/ResidentStorage)
 */
exports.detachResidentLink = async (req, res) => {
try {
	const residentId = req.params.id;
	const { relation, relation_id } = req.body;

	// Простая валидация входа
	if (!['apartment', 'parking', 'storage'].includes(relation)) {
		return res.status(400).json({ message: 'Некорректный тип связи (relation).' });
	}
	if (!relation_id) {
		return res.status(400).json({ message: 'Не передан relation_id.' });
	}

	// Выбираем модель связи по типу
	let Model = null;
	switch (relation) {
		case 'apartment':
		Model = ResidentApartment;
		break;
		case 'parking':
		Model = ResidentParking;
		break;
		case 'storage':
		Model = ResidentStorage;
		break;
	}

	// Проверяем, что такая связь существует и принадлежит этому жильцу
	const linkRow = await Model.findOne({ where: { id: relation_id, resident_id: residentId } });
	if (!linkRow) {
		return res.status(404).json({ message: 'Связь не найдена или не принадлежит указанному жильцу.' });
	}

	await linkRow.destroy();

	return res.status(200).json({ message: 'Связь успешно отвязана. Жилец не удалён.' });
} catch (error) {
	console.error('Ошибка отвязки связи жильца:', error);
	return res.status(500).json({ message: 'Ошибка сервера.' });
}
};
