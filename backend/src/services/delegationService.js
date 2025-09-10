/**
 * Сервис делегирования и общих проверок.
 * Проверяет: подмножество прав и подмножество скоупа по домам.
 * Работает с "капом" делегирования (UserDelegationCap).
 */

const { sequelize } = require('../models');

/**
 * Возвращает массив строк-кодов прав из капа пользователя.
 * Если {all:true} — вернёт специальный маркер 'ALL'.
 * @param {number} userId
 * @returns {Promise<('ALL'|string[])>}
 */
async function getDelegationCap(userId) {
  const [rows] = await sequelize.query(
    `SELECT permissions FROM user_delegation_caps WHERE user_id = :userId`,
    { replacements: { userId } }
  );
  if (!rows?.length) return [];
  const p = rows[0].permissions;
  if (p && p.all === true) return 'ALL';
  if (Array.isArray(p)) return p;
  if (Array.isArray(p.permissions)) return p.permissions;
  return [];
}

/**
 * Проверяет, что набор выдаваемых прав не выходит за пределы
 * (кап делегирующего ∩ эффективные права делегирующего).
 * @param {Set<string>} grantorEffective - Set прав делегирующего
 * @param {('ALL'|string[])} grantorCap - кап делегирующего
 * @param {string[]} requested - выдаваемые права
 * @returns {boolean}
 */
function isPermSubset(grantorEffective, grantorCap, requested) {
  if (!Array.isArray(requested)) return false;
  const capSet = (grantorCap === 'ALL') ? null : new Set(grantorCap);
  for (const code of requested) {
    if (!grantorEffective.has(code)) return false;
    if (capSet && !capSet.has(code)) return false;
  }
  return true;
}

/**
 * Проверяет, что scope выдаваемого пользователя — подмножество scope делегирующего.
 * @param {{all?:boolean, houses?:number[]}} grantorScope
 * @param {{all?:boolean, houses?:number[]}} targetScope
 * @returns {boolean}
 */
function isScopeSubset(grantorScope, targetScope) {
  if (grantorScope?.all) return true;
  if (!Array.isArray(grantorScope?.houses)) return false;
  if (targetScope?.all) return false; // админ не может выдать all:true
  const base = new Set((grantorScope.houses || []).map(Number));
  for (const h of (targetScope?.houses || [])) {
    if (!base.has(Number(h))) return false;
  }
  return true;
}

module.exports = {
  getDelegationCap,
  isPermSubset,
  isScopeSubset,
};
