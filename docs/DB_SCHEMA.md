# Domus — Схема БД (PostgreSQL)
Источник: `domus.sql` (pg_dump). Ключевое: `houses.slug` — `varchar(120) NULL UNIQUE` (частичный индекс `ux_houses_slug`), используется публичной шахматкой. :contentReference[oaicite:1]{index=1}

## Таблицы (выдержка)
- **houses**: `id, name, address, non_residential_first_floor, slug (NULL, UNIQUE)`; индекс: `ux_houses_slug` (WHERE slug IS NOT NULL). FK: `entrances.house_id`, `parkings.house_id`, `storages.house_id`, `residents.house_id`. :contentReference[oaicite:2]{index=2}
- **entrances**: `id, house_id, entrance_number, floors_count, apartments_per_floor` + FK→`houses`. :contentReference[oaicite:3]{index=3}
- **apartments**: `id, entrance_id, floor_number, apartment_number` + FK→`entrances`. :contentReference[oaicite:4]{index=4}
- **parkings**: `id, house_id, level, spots_count` + FK→`houses`. :contentReference[oaicite:5]{index=5}
- **storages**: `id, house_id, level, units_count` + FK→`houses`. :contentReference[oaicite:6]{index=6}
- **residents**: `id, full_name, phone, email, telegram, house_id (NULL)` + FK→`houses`. :contentReference[oaicite:7]{index=7}
- **resident_privacy**: `id, resident_id (UNIQUE, FK→residents), show_* BOOLEAN DEFAULT false`. (В модели сейчас defaultValue=true — см. замечания). :contentReference[oaicite:8]{index=8}
- **resident_apartments/parkings/storage**: связи many-to-one с enum-типами `'owner'|'tenant'`, уникальные составные ключи `(resident_id, apartment_id)` и т.п. :contentReference[oaicite:9]{index=9}
- **users / roles / permissions** (+ `user_roles.scope JSONB`, `user_permission_boosts`, `user_delegation_caps.permissions JSONB`, `role_permissions`). Уникальные ключи: `users.email`, `roles.name`, `permissions.code`. :contentReference[oaicite:10]{index=10}

> Полные определения колонок/индексов, PK/FK — см. исходный `domus.sql`.
