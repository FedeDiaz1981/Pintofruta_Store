create table if not exists public.site_content_meta (
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

create table if not exists public.header_search_scopes (
  id text primary key,
  label text not null,
  href text not null,
  sort_order integer not null
);

create table if not exists public.header_sections (
  id text primary key,
  label text not null,
  icon text not null,
  href text not null,
  sort_order integer not null
);

create table if not exists public.header_groups (
  id text primary key,
  section_id text not null references public.header_sections(id) on delete cascade,
  label text not null,
  href text not null,
  sort_order integer not null
);

create table if not exists public.header_group_items (
  id text primary key,
  group_id text not null references public.header_groups(id) on delete cascade,
  label text not null,
  href text not null,
  sort_order integer not null
);

create table if not exists public.hero_slides (
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

create table if not exists public.banners (
  id integer primary key,
  text text not null,
  order_index integer not null,
  active boolean not null
);

create table if not exists public.categories (
  id integer primary key,
  name text not null,
  slug text not null,
  visible boolean not null,
  deleted_at timestamptz
);

create unique index if not exists categories_slug_key on public.categories (slug);
create index if not exists categories_visible_idx on public.categories (visible);
create index if not exists categories_deleted_at_idx on public.categories (deleted_at);

create table if not exists public.brands (
  id text primary key,
  code text not null,
  name text not null,
  image text,
  featured boolean not null,
  active boolean not null default true
);

create unique index if not exists brands_code_key on public.brands (code);
create index if not exists brands_active_idx on public.brands (active);

create table if not exists public.users (
  id integer primary key,
  name text not null,
  email text not null,
  role text not null,
  can_see_prices boolean not null,
  active boolean not null
);

create unique index if not exists users_email_key on public.users (email);
create index if not exists users_active_idx on public.users (active);

create table if not exists public.products (
  id integer primary key,
  sku text not null,
  name text not null,
  detail text not null,
  presentation text not null,
  category_id integer not null references public.categories(id),
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

create unique index if not exists products_sku_key on public.products (sku);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_featured_priority_idx on public.products (featured_priority);
create index if not exists products_featured_idx on public.products (featured);
create index if not exists products_trending_idx on public.products (trending);
create index if not exists products_deleted_at_idx on public.products (deleted_at);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_brand_idx on public.products (brand);

create table if not exists public.promotion_packs (
  id integer primary key,
  apodo text not null,
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

create unique index if not exists promotion_packs_apodo_key on public.promotion_packs (apodo);
create index if not exists promotion_packs_active_idx on public.promotion_packs (active);
create index if not exists promotion_packs_featured_idx on public.promotion_packs (featured);
create index if not exists promotion_packs_order_index_idx on public.promotion_packs (order_index);

create table if not exists public.promotion_pack_items (
  pack_id integer not null references public.promotion_packs(id) on delete cascade,
  product_id integer not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  order_index integer not null,
  primary key (pack_id, product_id)
);

create index if not exists promotion_pack_items_pack_id_idx on public.promotion_pack_items (pack_id);
create index if not exists promotion_pack_items_product_id_idx on public.promotion_pack_items (product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_promotion_packs_updated_at on public.promotion_packs;
create trigger trg_promotion_packs_updated_at
before update on public.promotion_packs
for each row execute function public.set_updated_at();

drop trigger if exists trg_site_content_meta_updated_at on public.site_content_meta;
create trigger trg_site_content_meta_updated_at
before update on public.site_content_meta
for each row execute function public.set_updated_at();
