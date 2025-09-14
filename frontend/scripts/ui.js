// ui.js — тосты и подтверждения (минимум, в стиле Tabler)

/**
 * Показывает тост-уведомление.
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {string} message
 */
function showToast(type, message) {
  // Контейнер
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }
  // Элемент тоста
  const toast = document.createElement('div');
  toast.className = `toast show`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="toast-header">
      <strong class="me-auto">${type === 'success' ? 'Успех' : type === 'danger' ? 'Ошибка' : type === 'warning' ? 'Внимание' : 'Сообщение'}</strong>
      <small>сейчас</small>
      <button type="button" class="btn-close ms-2" aria-label="Close"></button>
    </div>
    <div class="toast-body">${message}</div>
  `;
  container.appendChild(toast);
  // Закрытие
  toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 4000);
}

/**
 * Показывает модал подтверждения и возвращает Promise<boolean>.
 * @param {string} title
 * @param {string} text
 * @param {string} okLabel
 * @param {string} cancelLabel
 * @returns {Promise<boolean>}
 */
function confirmDialog(title, text, okLabel = 'Подтвердить', cancelLabel = 'Отмена') {
  return new Promise((resolve) => {
    let modal = document.getElementById('confirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'confirmModal';
      modal.className = 'modal';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"></h5>
              <button type="button" class="btn-close" aria-label="Close"></button>
            </div>
            <div class="modal-body"><p class="mb-0"></p></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-link" id="confirmCancel">${cancelLabel}</button>
              <button type="button" class="btn btn-primary" id="confirmOk">${okLabel}</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-body p').textContent = text;
    modal.querySelector('#confirmCancel').textContent = cancelLabel;
    modal.querySelector('#confirmOk').textContent = okLabel;

    // Показ
    modal.style.display = 'block';
    modal.classList.add('show');

    const close = (result) => {
      modal.classList.remove('show');
      modal.style.display = 'none';
      resolve(result);
    };

    modal.querySelector('.btn-close').onclick = () => close(false);
    modal.querySelector('#confirmCancel').onclick = () => close(false);
    modal.querySelector('#confirmOk').onclick = () => close(true);
  });
}
