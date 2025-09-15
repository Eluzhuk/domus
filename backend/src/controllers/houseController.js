const { House, Entrance, Apartment, ResidentApartment, ResidentParking, Resident, Parking, StorageUnit, ResidentStorage, ResidentPrivacy, sequelize } = require('../models');

// Получение всех домов
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

			  // Общее количество объектов в доме
			  const totalApartments = house.Entrances.reduce((acc, entrance) => acc + entrance.Apartments.length, 0);
			  const totalParkingSpots = house.Parkings.reduce((acc, parking) => acc + parking.spots_count, 0);
			  const totalStorages = house.StorageUnits.reduce((acc, storage) => acc + storage.units_count, 0);

			// Заселенные объекты
			const occupiedApartments = house.Entrances.reduce((acc, entrance) => {
			return acc + entrance.Apartments.filter(apartment => {
				if (apartment.ResidentApartments.length > 0) {
					apartment.ResidentApartments.forEach(res => totalResidents.add(res.Resident.id));
					return true;
				}
				return false;
			}).length;
			}, 0);

			// 🔹 Паркинг: считаем УНИКАЛЬНЫЕ места по spot_number из resident_parkings
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

			// 🔹 Кладовые: считаем УНИКАЛЬНЫЕ помещения по unit_number из resident_storage
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

			  // Вычисляем процент заселенности (с округлением до целых чисел)
			  const apartmentOccupancyRate = totalApartments ? Math.round((occupiedApartments / totalApartments) * 100) : 0;
			  const parkingOccupancyRate = totalParkingSpots ? Math.round((occupiedParking / totalParkingSpots) * 100) : 0;
			  const storageOccupancyRate = totalStorages ? Math.round((occupiedStorages / totalStorages) * 100) : 0;

			  return {
					id: house.id,
					name: house.name,
					address: house.address,
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

// Создание нового дома
exports.createHouse = async (req, res) => {
	const t = await sequelize.transaction();
	try {
		const { name, address, non_residential_first_floor, entrances, parking, storage } = req.body;

		// Создаём новый дом
		const newHouse = await House.create(
			{ name, address, non_residential_first_floor },
			{ transaction: t }
		);

		let currentApartmentNumber = 1;  // Начинаем нумерацию с 1

		if (entrances && entrances.length > 0) {
			for (const entrance of entrances) {
				const newEntrance = await Entrance.create({
					house_id: newHouse.id,
					entrance_number: entrance.entrance_number,
					floors_count: entrance.floors_count,
					apartments_per_floor: entrance.apartments_per_floor
				}, { transaction: t });

				const startFloor = non_residential_first_floor ? 2 : 1;

				for (let floor = startFloor; floor <= entrance.floors_count; floor++) {
					for (let apt = 1; apt <= entrance.apartments_per_floor; apt++) {
						await Apartment.create({
							entrance_id: newEntrance.id,
							floor_number: floor,
							apartment_number: currentApartmentNumber  // Продолжаем нумерацию
						}, { transaction: t });

						currentApartmentNumber++;  // Увеличиваем номер квартиры
					}
				}
			}
		}

		// Добавляем паркинг
		if (Array.isArray(parking) && parking.length > 0) {
			for (const park of parking) {
				await Parking.create({
					house_id: newHouse.id,
					level: park.level,
					spots_count: park.spots_count
				}, { transaction: t });
			}
		}

		// Добавляем кладовые
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
		res.status(201).json(newHouse);
	} catch (error) {
		await t.rollback();
		res.status(500).json({ error: 'Ошибка при создании' });
	}
};

//Редактирования дома
exports.updateHouse = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, address } = req.body;

		const house = await House.findByPk(id);
		if (!house) {
			return res.status(404).json({ error: 'Дом не найден' });
		}

		house.name = name || house.name;
		house.address = address || house.address;
		await house.save();

		res.json({ message: 'Дом успешно обновлён', house });
	} catch (error) {
		console.error('Ошибка при обновлении дома:', error);
		res.status(500).json({ error: 'Ошибка при обновлении дома' });
	}
};

//Удаление дома
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

exports.getHouseStructure = async (req, res) => {
	try {
		const { id } = req.params;

		// Получаем данные дома
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
									{model: Resident,
										attributes: ['id','full_name','phone','email','telegram'],
										include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name','show_phone','show_email','show_telegram'] }]
									}
									]
								}
							]
						}
					],
					order: [['entrance_number', 'ASC']], // Сортировка подъездов по возрастанию
				},
				{
					model: Parking,
					include: [
						{
							model: ResidentParking,
							include: [
								{model: Resident,
									attributes: ['id','full_name','phone','email','telegram'],
									include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name','show_phone','show_email','show_telegram'] }]
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
								{model: Resident,
									attributes: ['id','full_name','phone','email','telegram'],
									include: [{ model: ResidentPrivacy, as: 'privacy', attributes: ['show_full_name','show_phone','show_email','show_telegram'] }]
								}
							]
						}
					]
				}
			]
		});

		if (!house) {
			return res.status(404).json({ error: 'Дом не найден' });
		}

		// Преобразуем дом в объект и добавляем поле isOccupied
		const houseData = house.toJSON();

		houseData.Entrances = houseData.Entrances.map((entrance) => ({
			...entrance,
			Apartments: entrance.Apartments.map((apartment) => ({
				...apartment,
				isOccupied: apartment.ResidentApartments && apartment.ResidentApartments.length > 0
			}))
		}));

		res.json(houseData);
	} catch (error) {
		console.error('Ошибка при получении структуры дома:', error);
		res.status(500).json({ error: 'Ошибка при загрузке данных' });
	}
};


// Получение визуализации дома
exports.getHouseVisualization = async (req, res) => {
	try {
		const houseId = req.params.id;

		// Получаем квартиры вместе с жильцами
		const apartments = await Apartment.findAll({
			include: {
					model: ResidentApartment,
					attributes: ['resident_id'] // Получаем только ID жильца
			},
			where: { '$Entrance.house_id$': houseId }, // Фильтруем по ID дома через связь Entrance
			include: {
				association: 'Entrance', // Связь Apartment -> Entrance
				attributes: [] // Убираем ненужные данные из Entrance
			}
		});

		const apartmentsData = apartments.map(apartment => ({
			id: apartment.id,
			floor_number: apartment.floor_number,
			apartment_number: apartment.apartment_number,
			isOccupied: apartment.ResidentApartments && apartment.ResidentApartments.length > 0 // Проверяем наличие жильцов
		}));

		res.status(200).json({ apartments: apartmentsData });
	} catch (error) {
		console.error('Ошибка получения визуализации дома:', error);
		res.status(500).json({ message: 'Ошибка сервера.' });
	}
};