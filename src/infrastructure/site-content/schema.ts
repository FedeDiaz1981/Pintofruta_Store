export const siteContentSchemaSql = `
  create table if not exists site_content_meta (
    id integer primary key,
    session_role text,
    view_mode text,
    active_admin_panel text,
    panel_search_query text,
    active_modal_action text,
    ping boolean,
    next_ids jsonb,
    updated_at timestamptz not null default now()
  );

  create table if not exists header_search_scopes (
    id text primary key,
    label text not null,
    href text not null,
    sort_order integer not null
  );

  create table if not exists header_sections (
    id text primary key,
    label text not null,
    icon text not null,
    href text not null,
    sort_order integer not null
  );

  create table if not exists header_groups (
    id text primary key,
    section_id text not null references header_sections(id) on delete cascade,
    label text not null,
    href text not null,
    sort_order integer not null
  );

  create table if not exists header_group_items (
    id text primary key,
    group_id text not null references header_groups(id) on delete cascade,
    label text not null,
    href text not null,
    sort_order integer not null
  );

  create table if not exists hero_slides (
    id integer primary key,
    order_index integer not null,
    title text not null,
    subtitle text not null,
    badge text not null,
    image text not null,
    image_mobile text,
    link text not null,
    active boolean not null,
    home_spotlight boolean
  );

  create table if not exists banners (
    id integer primary key,
    text text not null,
    order_index integer not null,
    active boolean not null
  );

  create table if not exists categories (
    id integer primary key,
    name text not null,
    slug text not null,
    visible boolean not null,
    home_menu boolean not null default true,
    icon text not null default 'package',
    deleted_at timestamptz
  );

  alter table categories add column if not exists deleted_at timestamptz;
  alter table categories add column if not exists home_menu boolean not null default true;
  alter table categories add column if not exists icon text not null default 'package';
  update categories set home_menu = coalesce(home_menu, true) where home_menu is null;
  update categories set icon = coalesce(nullif(icon, ''), 'package') where icon is null or trim(icon) = '';

  create table if not exists brands (
    id text primary key,
    code text not null unique,
    name text not null,
    image text,
    featured boolean not null,
    active boolean not null default true
  );

  alter table brands add column if not exists active boolean not null default true;

  create table if not exists users (
    id integer primary key,
    name text not null,
    email text not null unique,
    role text not null,
    can_see_prices boolean not null,
    active boolean not null
  );

  create table if not exists products (
    id integer primary key,
    sku text not null unique,
    name text not null,
    detail text not null,
    presentation text not null,
    category_id integer not null references categories(id),
    category_name text not null,
    category_ids jsonb not null default '[]'::jsonb,
    category_names jsonb not null default '[]'::jsonb,
    brand text not null,
    vegano boolean not null,
    kosher boolean not null,
    testeado_en_animales boolean,
    public_price integer not null,
    member_price integer not null,
    image text,
    status text not null,
    featured boolean not null,
    featured_priority integer,
    trending boolean,
    stock integer,
    views_count integer not null default 0,
    sales_count integer not null default 0,
    description text,
    source_section text,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table products add column if not exists created_at timestamptz not null default now();
  alter table products add column if not exists updated_at timestamptz not null default now();
  alter table products add column if not exists featured_priority integer;
  alter table products add column if not exists views_count integer not null default 0;
  alter table products add column if not exists sales_count integer not null default 0;
  alter table products add column if not exists category_ids jsonb not null default '[]'::jsonb;
  alter table products add column if not exists category_names jsonb not null default '[]'::jsonb;
  alter table products add column if not exists deleted_at timestamptz;

  create table if not exists promotion_packs (
    id integer primary key,
    apodo text not null unique,
    title text not null,
    description text not null,
    category text not null,
    public_price integer not null,
    image text,
    active boolean not null,
    featured boolean not null,
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists promotion_pack_items (
    pack_id integer not null references promotion_packs(id) on delete cascade,
    product_id integer not null references products(id) on delete cascade,
    quantity integer not null default 1,
    order_index integer not null,
    primary key (pack_id, product_id)
  );

  alter table promotion_packs add column if not exists created_at timestamptz not null default now();
  alter table promotion_packs add column if not exists updated_at timestamptz not null default now();
`;
