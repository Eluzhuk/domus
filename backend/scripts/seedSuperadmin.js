require('dotenv').config();
const bcrypt = require('bcryptjs');

// Берём ТОЛЬКО инстанс sequelize, без загрузки моделей
const { sequelize } = require('../src/db');

(async () => {
  try {
    await sequelize.authenticate();

    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD не заданы в .env');
    }

    // 1) Пользователь
    const [uRows] = await sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email } }
    );

    let userId;
    if (uRows.length) {
      userId = uRows[0].id;
      console.log('Пользователь уже существует:', email, 'id=', userId);
    } else {
      const hash = await bcrypt.hash(password, 10);
      const [ins] = await sequelize.query(
        'INSERT INTO users (email, password_hash, is_active) VALUES (:email, :hash, true) RETURNING id',
        { replacements: { email, hash } }
      );
      userId = ins[0].id;
      console.log('Создан superadmin user:', userId, email);
    }

    // 2) Роль superadmin
    const [rRows] = await sequelize.query(
      "SELECT id FROM roles WHERE name = 'superadmin'"
    );
    if (!rRows.length) throw new Error('Роль superadmin не найдена. Сначала выполните SQL сид ролей/прав.');
    const roleId = rRows[0].id;

    // 3) Scope: all или пустой список домов
    const scope = (process.env.SUPERADMIN_SCOPE_ALL === 'true') ? { all: true } : { houses: [] };

    await sequelize.query(
      `INSERT INTO user_roles (user_id, role_id, scope)
       VALUES (:userId, :roleId, :scope::jsonb)
       ON CONFLICT (user_id, role_id) DO UPDATE SET scope = EXCLUDED.scope`,
      { replacements: { userId, roleId, scope: JSON.stringify(scope) } }
    );

    // 4) Delegation cap: all
    await sequelize.query(
      `INSERT INTO user_delegation_caps (user_id, permissions)
       VALUES (:userId, '{"all": true}'::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions`,
      { replacements: { userId } }
    );

    console.log('Superadmin готов. userId=', userId);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
