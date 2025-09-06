document.addEventListener('DOMContentLoaded', async function () {
	const container = document.getElementById('housesContainer');
	const editModal = document.getElementById('editModal');
	const closeEditModalBtn = editModal?.querySelector('.close');
	const editForm = document.getElementById('editForm');
	let currentHouseId = null;

	try {
		const response = await fetch('http://localhost:5000/api/houses');
		const houses = await response.json();

		if (houses.length === 0) {
			container.innerHTML = '<p>Дома не найдены</p>';
			return;
		}

		houses.forEach((house) => {
			const card = document.createElement('div');
			card.classList.add('house-card');

			let detailsHTML = `
				<button class="add-resident" data-id="${house.id}"></button>
				<button class="edit-house" data-id="${house.id}"></button>
				<button class="delete-house" data-id="${house.id}"></button>
				<h2>${house.name}</h2>
				<p><i class="fa-solid fa-map-location-dot"></i> ${house.address}</p>
			`;

			// Блок для квартир и жильцов
			detailsHTML += `<p><i class="fas fa-building"></i> ${house.occupiedApartments}/${house.totalApartments} (${house.apartmentOccupancyRate}%) <i class="fas fa-users"></i> ${house.totalResidents}</p>`;

			// Блок для парковки (если есть)
			if (house.totalParkingSpots > 0) {
					detailsHTML += `<p><i class="fa-solid fa-car-side"></i> ${house.occupiedParking}/${house.totalParkingSpots} (${house.parkingOccupancyRate}%)</p>`;
			}

			// Блок для кладовых (если есть)
			if (house.totalStorages > 0) {
					detailsHTML += `<p><i class="fas fa-box"></i> ${house.occupiedStorages}/${house.totalStorages} (${house.storageOccupancyRate}%)</p>`;
			}

			// Добавляем событие перехода на шахматку при клике на карточку
			card.addEventListener('click', (e) => {
				// Исключаем клики по кнопкам внутри карточки
				if (
					!e.target.classList.contains('edit-house') &&
					!e.target.classList.contains('delete-house') &&
					!e.target.classList.contains('add-resident') // Исключаем кнопку "+"
				) {
					window.location.href = `house-visualization.html?id=${house.id}`;
				}
			});

			card.innerHTML = detailsHTML;
			container.appendChild(card);
		});

		// Логика удаления дома
		container.addEventListener('click', async (e) => {
			if (e.target.classList.contains('delete-house')) {
				const id = e.target.dataset.id;
				if (confirm('Вы уверены, что хотите удалить этот дом? Осторожно: данные не подлежат восстановлению')) {
					try {
							const response = await fetch(`http://localhost:5000/api/houses/${id}`, {
								method: 'DELETE'
							});

							if (response.ok) {
								alert('Дом успешно удалён');
								e.target.parentElement.remove(); // Удаляем карточку из DOM
							} else {
								alert('Ошибка при удалении дома');
							}
					} catch (error) {
							console.error('Ошибка сети:', error);
							alert('Ошибка подключения к серверу.');
					}
				}
			}
		});

		// Показ модального окна для редактирования
		container.addEventListener('click', (e) => {
			if (e.target.classList.contains('edit-house')) {
				currentHouseId = e.target.dataset.id;

				// Заполняем поля текущими значениями
				const houseCard = e.target.parentElement;
				document.getElementById('editName').value = houseCard.querySelector('h2').textContent;
				document.getElementById('editAddress').value = houseCard.querySelector('p').textContent.split(': ')[1];

				editModal.style.display = 'block';
			}
	});

	// Закрытие модального окна
	closeEditModalBtn && (closeEditModalBtn.onclick = () => {
			editModal.style.display = 'none';
	});

	window.addEventListener('click', (event) => {
			if (event.target === editModal) {
				editModal.style.display = 'none';
			}
	});

	// Сохранение изменений
	editForm.onsubmit = async (e) => {
			e.preventDefault();

			const newName = document.getElementById('editName').value;
			const newAddress = document.getElementById('editAddress').value;

			try {
				const response = await fetch(`http://localhost:5000/api/houses/${currentHouseId}`, {
					method: 'PUT',
					headers: {
							'Content-Type': 'application/json'
					},
					body: JSON.stringify({ name: newName, address: newAddress })
				});

				if (response.ok) {
					alert('Дом успешно обновлён');
					editModal.style.display = 'none';
					location.reload(); // Перезагрузка списка домов
				} else {
					alert('Ошибка при обновлении дома');
				}
			} catch (error) {
				console.error('Ошибка сети:', error);
				alert('Ошибка подключения к серверу.');
			}
	};

	document.addEventListener('click', (e) => {
		// Обработка клика по кнопке "+"
		if (e.target.classList.contains('add-resident')) {
			e.stopPropagation();
			const modal = document.getElementById('addResidentModal');
			if (!modal) {
				console.error('Модальное окно для добавления жильца не найдено.');
				return;
			}
			modal.style.display = 'flex';
			const houseId = e.target.dataset.id;
			const form = document.getElementById('addResidentForm');
			if (form) {
				form.dataset.houseId = houseId; // Привязываем ID дома
			} else {
				console.error('Форма для добавления жильца не найдена.');
			}
		}

		// Обработка клика по кнопке "Закрыть" в модальном окне
		if (e.target.classList.contains('close')) {
			const modal = document.getElementById('addResidentModal');
			if (modal) {
				modal.style.display = 'none';
				resetModal();
			}
		}
	});

	window.addEventListener('click', (e) => {
		const modal = document.getElementById('addResidentModal');
		if (e.target === modal) {
			modal.style.display = 'none';
			resetModal(); // Сбрасываем данные
		}
	});

	// Функция для сброса данных модального окна
	function resetModal() {
		const form = document.getElementById('addResidentForm');
		form.reset(); // Сбрасываем значения всех полей
		document.querySelectorAll('.apartment-input, .parking-input, .storage-input').forEach((field) => {
			if (!field.querySelector('button[type="button"]')) return; // Оставляем основные кнопки
			field.remove(); // Удаляем динамические поля
		});
	}

	document.getElementById('addApartmentField').onclick = function () {
		const container = document.getElementById('apartmentContainer');
		const newField = document.createElement('div');
		newField.classList.add('apartment-input');
		newField.innerHTML = `
			<input type="text" name="apartments[]" placeholder="Введите номер квартиры">
			<label>
				<input type="checkbox" name="tenant[]"> Арендатор
			</label>
			<button type="button" class="remove-field">Удалить</button>
		`;
		container.insertBefore(newField, this);
	};

document.getElementById('addParkingField').onclick = function () {
		const container = document.getElementById('parkingContainer');
		const newField = document.createElement('div');
		newField.classList.add('parking-input');
		newField.innerHTML = `
			<input type="text" name="parking[]" placeholder="Введите номер парковки">
			<label>
				<input type="checkbox" name="parkingTenant[]"> Арендатор
			</label>
			<button type="button" class="remove-field">Удалить</button>
		`;
		container.insertBefore(newField, this);
	};

document.getElementById('addStorageField').onclick = function () {
		const container = document.getElementById('storageContainer');
		const newField = document.createElement('div');
		newField.classList.add('storage-input');
		newField.innerHTML = `
			<input type="text" name="storages[]" placeholder="Введите номер кладовой">
			<label>
				<input type="checkbox" name="storageTenant[]"> Арендатор
			</label>
			<button type="button" class="remove-field">Удалить</button>
		`;
		container.insertBefore(newField, this);
	};

// Удаление динамического поля
document.addEventListener('click', function (e) {
		if (e.target.classList.contains('remove-field')) {
			e.target.parentElement.remove(); // Удаляем родительский div
		}
	});


	document.getElementById('addResidentForm').onsubmit = async function (e) {
		e.preventDefault(); // Останавливаем стандартное поведение формы

		const formData = new FormData(this); // Собираем данные формы
		const houseId = this.dataset.houseId; // Получаем ID дома

		const data = {
			full_name: formData.get('full_name'), // Берём данные корректно
			telegram: formData.get('telegram') || null,
			phone: formData.get('phone') || null,
			email: formData.get('email') || null,
			apartments: [],
			parking: [],
			storages: []
		};

		// Собираем данные о квартирах
		document.querySelectorAll('input[name="apartments[]"]').forEach((input, index) => {
				data.apartments.push({
					number: input.value,
					tenant: document.querySelectorAll('input[name="tenant[]"]')[index].checked
				});
		});

		// Собираем данные о парковках
		document.querySelectorAll('input[name="parking[]"]').forEach((input, index) => {
				data.parking.push({
					number: input.value,
					tenant: document.querySelectorAll('input[name="parkingTenant[]"]')[index].checked
				});
		});

		// Собираем данные о кладовых
		document.querySelectorAll('input[name="storages[]"]').forEach((input, index) => {
				data.storages.push({
					number: input.value,
					tenant: document.querySelectorAll('input[name="storageTenant[]"]')[index].checked
				});
		});

		// Отправляем данные на сервер
		try {
				const response = await fetch(`http://localhost:5000/api/houses/${houseId}/residents`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(data)
				});

				if (response.ok) {
					alert('Жилец успешно добавлен!');
					this.reset(); // Сбрасываем форму
					document.getElementById('addResidentModal').style.display = 'none'; // Закрываем модальное окно
				} else {
					const error = await response.json();
					alert(`Ошибка: ${error.message}`);
				}
			} catch (error) {
				console.error('Ошибка сети:', error);
				alert('Ошибка подключения к серверу.');
			}
		};

	} catch (error) {
		console.error('Ошибка загрузки домов:', error);
		container.innerHTML = '<p>Ошибка загрузки данных</p>';
	}
});
// 🔹 Открытие и закрытие модального окна
const modal = document.getElementById('houseModal');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');

openModalBtn.addEventListener('click', () => {
	modal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
	modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
	if (event.target === modal) {
		modal.style.display = 'none';
	}
});

// 🔹 Добавление подъездов
document.getElementById('addEntrance').onclick = function () {
	const container = document.getElementById('entrancesContainer');
	const entranceCount = container.getElementsByClassName('entrance').length + 1;

	const entranceDiv = document.createElement('div');
	entranceDiv.classList.add('entrance');

	entranceDiv.innerHTML = `
		<label>Подъезд №${entranceCount}</label>
		<label>Количество этажей:</label>
		<input type="number" name="floors[]" min="1" required>

		<label>Квартир на этаже:</label>
		<input type="number" name="apartmentsPerFloor[]" min="1" required>
	`;

	container.appendChild(entranceDiv);
};

// 🔹 Показ/скрытие паркинга
document.getElementById('addParking').onchange = function () {
	document.getElementById('parkingContainer').style.display = this.checked ? 'block' : 'none';
};

// 🔹 Показ/скрытие кладовых
document.getElementById('addStorage').onchange = function () {
	document.getElementById('storageContainer').style.display = this.checked ? 'block' : 'none';
};

// 🔹 Добавление уровня паркинга
document.getElementById('addParkingLevel').onclick = function () {
	const container = document.getElementById('parkingContainer');

	const parkingDiv = document.createElement('div');
	parkingDiv.classList.add('parkingLevel');

	parkingDiv.innerHTML = `
		<label>Уровень паркинга:</label>
		<input type="number" name="parkingLevel[]" value="-1">

		<label>Количество мест на уровне:</label>
		<input type="number" name="parkingSpots[]" min="1">
		<button type="button" class="removeLevel">Удалить уровень</button>
	`;

	container.insertBefore(parkingDiv, document.getElementById('addParkingLevel'));
};

// 🔹 Добавление уровня кладовых
document.getElementById('addStorageLevel').onclick = function () {
	const container = document.getElementById('storageContainer');

	const storageDiv = document.createElement('div');
	storageDiv.classList.add('storageLevel');

	storageDiv.innerHTML = `
		<label>Уровень кладовых:</label>
		<input type="number" name="storageLevel[]" value="-1">

		<label>Количество кладовых:</label>
		<input type="number" name="storageUnits[]" min="1">
		<button type="button" class="removeLevel">Удалить уровень</button>
	`;

	container.insertBefore(storageDiv, document.getElementById('addStorageLevel'));
};

// 🔹 Удаление уровня паркинга или кладовой
document.addEventListener('click', function (e) {
	if (e.target && e.target.classList.contains('removeLevel')) {
		e.target.parentElement.remove();
	}
});

// 🔹 Отправка формы создания дома
document.getElementById('houseForm').onsubmit = async function (e) {
	e.preventDefault();

	const formData = {
		name: document.getElementById('houseName').value,
		address: document.getElementById('houseAddress').value,
		non_residential_first_floor: document.getElementById('nonResidential').checked,
		entrances: [],
		parking: [],
		storage: []
	};

	// Сбор данных о подъездах
	document.querySelectorAll('.entrance').forEach((entrance, index) => {
		formData.entrances.push({
				entrance_number: index + 1,
				floors_count: entrance.querySelector('input[name="floors[]"]').value,
				apartments_per_floor: entrance.querySelector('input[name="apartmentsPerFloor[]"]').value
		});
	});

	// Сбор данных о паркинге
	if (document.getElementById('addParking').checked) {
		document.querySelectorAll('.parkingLevel').forEach((parking) => {
				formData.parking.push({
					level: parking.querySelector('input[name="parkingLevel[]"]').value,
					spots_count: parking.querySelector('input[name="parkingSpots[]"]').value
				});
		});
	}

	// Сбор данных о кладовых
	if (document.getElementById('addStorage').checked) {
		document.querySelectorAll('.storageLevel').forEach((storage) => {
				formData.storage.push({
					level: storage.querySelector('input[name="storageLevel[]"]').value,
					units_count: storage.querySelector('input[name="storageUnits[]"]').value
				});
		});
	}

	// Отправка данных на сервер
	try {
		const response = await fetch('http://localhost:5000/api/houses', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
		});

		if (response.ok) {
				alert('Дом успешно создан!');
				modal.style.display = 'none';
				location.reload();
		} else {
				alert('Ошибка при добавлении дома.');
		}
	} catch (error) {
		console.error('Ошибка сети:', error);
		alert('Ошибка подключения к серверу.');
	}
};
