import type { PoolClient } from "pg";

export async function ensureProductIdSequence(client: Pick<PoolClient, "query">) {
  await client.query(`do $$
    begin
      perform pg_advisory_xact_lock(hashtext('pintofruta-product-id-sequence'));
      if to_regclass('pintofruta_product_id_seq') is null then
        create sequence pintofruta_product_id_seq as integer;
        perform setval('pintofruta_product_id_seq', coalesce((select max(id)::bigint from products),0)+1, false);
      end if;
    end $$`);
}

export async function allocateProductIds(client: Pick<PoolClient, "query">, count: number) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error("Cantidad de IDs invalida.");
  if (count === 0) return [];
  await ensureProductIdSequence(client);
  // Never reset an existing sequence. Skip legacy IDs inserted outside this allocator.
  const result = await client.query<{ id: number }>(
    `with recursive allocated(id, used, floor) as (
      select nextval('pintofruta_product_id_seq'), 0, (select coalesce(max(id),0) from products)
      union all
      select nextval('pintofruta_product_id_seq'), used+(id>floor)::integer, floor
      from allocated where used+(id>floor)::integer < $1
    ) select id::integer from allocated where id>floor`,
    [count],
  );
  return result.rows.map((row) => row.id);
}
