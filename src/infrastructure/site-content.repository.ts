import { cache } from "react";
import type { PoolClient, QueryResultRow } from "pg";
import type { SiteContentDocument } from "@/domain/site-content";
import { postgresPool } from "@/infrastructure/db/postgres";
import {
  mapHeaderNavigation,
  mapSiteContentDocument,
  type BannerRow,
  type BrandRow,
  type CategoryRow,
  type HeroSlideRow,
  type NavGroupRow,
  type NavItemRow,
  type NavSectionRow,
  type ProductRow,
  type SearchScopeRow,
  type SiteMetaRow,
  type UserRow,
} from "@/infrastructure/site-content/mappers";
import { fallbackSiteContent, seedLockKey, toSeedNavigationRows } from "@/infrastructure/site-content/seed";
import { siteContentSchemaSql } from "@/infrastructure/site-content/schema";

const ensureSchema = cache(async () => {
  if (!postgresPool) {
    return;
  }

  await postgresPool.query(siteContentSchemaSql);
});

async function countRows(client: PoolClient, table: string) {
  const result = await client.query<{ count: string }>(`select count(*)::text as count from ${table}`);
  return Number(result.rows[0]?.count ?? "0");
}

async function seedIfNeeded(client: PoolClient) {
  await client.query("begin");

  try {
    await client.query("select pg_advisory_xact_lock($1)", [seedLockKey]);

    const metaCount = await countRows(client, "site_content_meta");
    const productCount = await countRows(client, "products");

    if (metaCount > 0 && productCount > 0) {
      await client.query("commit");
      return;
    }

    await client.query("delete from header_group_items");
    await client.query("delete from header_groups");
    await client.query("delete from header_sections");
    await client.query("delete from header_search_scopes");
    await client.query("delete from hero_slides");
    await client.query("delete from banners");
    await client.query("delete from products");
    await client.query("delete from brands");
    await client.query("delete from users");
    await client.query("delete from categories");
    await client.query("delete from site_content_meta");

    const navigationRows = toSeedNavigationRows();

    await client.query(
      `
        insert into site_content_meta (
          id, session_role, view_mode, active_admin_panel, panel_search_query,
          active_modal_action, ping, next_ids
        ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        1,
        fallbackSiteContent.sessionRole ?? null,
        fallbackSiteContent.viewMode ?? null,
        fallbackSiteContent.activeAdminPanel ?? null,
        fallbackSiteContent.panelSearchQuery ?? null,
        fallbackSiteContent.activeModalAction ?? null,
        fallbackSiteContent.ping ?? null,
        JSON.stringify(fallbackSiteContent.nextIds ?? null),
      ],
    );

    for (const scope of navigationRows.searchScopes) {
      await client.query(
        "insert into header_search_scopes (id, label, href, sort_order) values ($1, $2, $3, $4)",
        [scope.id, scope.label, scope.href, scope.sort_order],
      );
    }

    for (const section of navigationRows.sections) {
      await client.query(
        "insert into header_sections (id, label, icon, href, sort_order) values ($1, $2, $3, $4, $5)",
        [section.id, section.label, section.icon, section.href, section.sort_order],
      );
    }

    for (const group of navigationRows.groups) {
      await client.query(
        "insert into header_groups (id, section_id, label, href, sort_order) values ($1, $2, $3, $4, $5)",
        [group.id, group.section_id, group.label, group.href, group.sort_order],
      );
    }

    for (const item of navigationRows.items) {
      await client.query(
        "insert into header_group_items (id, group_id, label, href, sort_order) values ($1, $2, $3, $4, $5)",
        [item.id, item.group_id, item.label, item.href, item.sort_order],
      );
    }

    for (const slide of fallbackSiteContent.heroSlides) {
      await client.query(
        `
          insert into hero_slides (
            id, order_index, title, subtitle, badge, image, image_mobile, link, active, home_spotlight
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          slide.id,
          slide.order,
          slide.title,
          slide.subtitle,
          slide.badge,
          slide.image,
          slide.imageMobile ?? null,
          slide.link,
          slide.active,
          slide.homeSpotlight ?? null,
        ],
      );
    }

    for (const banner of fallbackSiteContent.banners) {
      await client.query(
        "insert into banners (id, text, order_index, active) values ($1, $2, $3, $4)",
        [banner.id, banner.text, banner.order, banner.active],
      );
    }

    for (const category of fallbackSiteContent.categories ?? []) {
      await client.query(
        "insert into categories (id, name, slug, visible) values ($1, $2, $3, $4)",
        [category.id, category.name, category.slug, category.visible],
      );
    }

    for (const brand of fallbackSiteContent.brands) {
      await client.query(
        "insert into brands (id, code, name, image, featured) values ($1, $2, $3, $4, $5)",
        [brand.id, brand.code, brand.name, brand.image ?? null, brand.featured],
      );
    }

    for (const user of fallbackSiteContent.users ?? []) {
      await client.query(
        "insert into users (id, name, email, role, can_see_prices, active) values ($1, $2, $3, $4, $5, $6)",
        [user.id, user.name, user.email, user.role, user.canSeePrices, user.active],
      );
    }

    for (const product of fallbackSiteContent.products) {
      await client.query(
        `
          insert into products (
            id, sku, name, detail, presentation, category_id, category_name, brand,
            vegano, kosher, testeado_en_animales, public_price, member_price, image,
            status, featured, trending, stock, description, source_section
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20
          )
        `,
        [
          product.id,
          product.sku,
          product.name,
          product.detail || product.name || product.sku,
          product.presentation || "",
          product.categoryId,
          product.categoryName,
          product.brand,
          Boolean(product.vegano),
          Boolean(product.kosher),
          product.testeadoEnAnimales ?? null,
          product.publicPrice,
          product.memberPrice,
          product.image ?? null,
          product.status,
          Boolean(product.featured),
          product.trending ?? null,
          product.stock ?? null,
          product.description ?? null,
          product.sourceSection ?? null,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function readRows<T extends QueryResultRow>(client: PoolClient, sql: string) {
  const result = await client.query<T>(sql);
  return result.rows;
}

export async function getSiteContent(): Promise<SiteContentDocument> {
  if (!postgresPool) {
    return fallbackSiteContent;
  }

  await ensureSchema();

  const client = await postgresPool.connect();

  try {
    await seedIfNeeded(client);

    const metaRows = await readRows<SiteMetaRow>(
      client,
      "select session_role, view_mode, active_admin_panel, panel_search_query, active_modal_action, ping, next_ids from site_content_meta where id = 1 limit 1",
    );
    const scopesRows = await readRows<SearchScopeRow>(
      client,
      "select id, label, href, sort_order from header_search_scopes order by sort_order, id",
    );
    const sectionsRows = await readRows<NavSectionRow>(
      client,
      "select id, label, icon, href, sort_order from header_sections order by sort_order, id",
    );
    const groupsRows = await readRows<NavGroupRow>(
      client,
      "select id, section_id, label, href, sort_order from header_groups order by sort_order, id",
    );
    const itemsRows = await readRows<NavItemRow>(
      client,
      "select id, group_id, label, href, sort_order from header_group_items order by sort_order, id",
    );
    const heroSlidesRows = await readRows<HeroSlideRow>(
      client,
      "select id, order_index, title, subtitle, badge, image, image_mobile, link, active, home_spotlight from hero_slides order by order_index, id",
    );
    const bannerRows = await readRows<BannerRow>(
      client,
      "select id, text, order_index, active from banners order by order_index, id",
    );
    const productRows = await readRows<ProductRow>(
      client,
      "select id, sku, name, detail, presentation, category_id, category_name, brand, vegano, kosher, testeado_en_animales, public_price, member_price, image, status, featured, trending, stock, description, source_section from products order by id",
    );
    const brandRows = await readRows<BrandRow>(
      client,
      "select id, code, name, image, featured from brands order by featured desc, name",
    );
    const categoryRows = await readRows<CategoryRow>(
      client,
      "select id, name, slug, visible from categories order by id",
    );
    const userRows = await readRows<UserRow>(
      client,
      "select id, name, email, role, can_see_prices, active from users order by id",
    );

    const headerNavigation = mapHeaderNavigation(scopesRows, sectionsRows, groupsRows, itemsRows);

    return mapSiteContentDocument({
      metaRow: metaRows[0],
      headerNavigation,
      heroSlides: heroSlidesRows,
      banners: bannerRows,
      products: productRows,
      brands: brandRows,
      categories: categoryRows,
      users: userRows,
    });
  } finally {
    client.release();
  }
}
