import Link from "next/link";
import type { CSSProperties } from "react";
import type { CategoryItem } from "@/domain/site-content";
import { categoryIconComponents, resolveCategoryIconKey, type CategoryIconKey } from "@/lib/category-icons";
import styles from "./category-menu-strip.module.css";

function balancedPositions(count: number, capacity: number) {
  const rows = Math.ceil(count / capacity);
  const perRow = Math.floor(count / rows);
  const extra = count % rows;

  // Half-card grid tracks let every row stay centered, including odd-sized rows.
  return Array.from({ length: rows }, (_, row) => {
    const rowSize = perRow + (row < extra ? 1 : 0);
    return Array.from({ length: rowSize }, (_, column) => ({
      row: row + 1,
      column: capacity - rowSize + 1 + column * 2,
    }));
  }).flat();
}

function CategoryCard({ category }: { category: CategoryItem }) {
  const iconKey: CategoryIconKey = resolveCategoryIconKey(category.name, category.icon as CategoryIconKey | undefined);
  const Icon = categoryIconComponents[iconKey] ?? categoryIconComponents.package;

  return (
    <Link
      href={`/galeria?category=${encodeURIComponent(category.name)}`}
      className="group flex aspect-square min-h-[170px] w-full flex-col items-center justify-center gap-5 rounded-[1.65rem] border border-[rgba(168,109,69,0.16)] bg-[linear-gradient(180deg,rgba(231,234,216,0.95)_0%,rgba(241,239,226,0.96)_100%)] px-5 py-6 text-center shadow-[0_10px_24px_rgba(74,57,38,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(74,57,38,0.12)]"
    >
      <span className="grid size-20 place-items-center rounded-[1.3rem] border border-[rgba(74,57,38,0.08)] bg-[rgba(248,242,232,0.82)] text-[var(--pf-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <Icon className="size-10 stroke-[1.8]" />
      </span>

      <span className="max-w-full break-words text-[0.95rem] font-semibold tracking-normal text-[var(--pf-text)] sm:text-[1rem]">
        {category.name}
      </span>
    </Link>
  );
}

export function CategoryMenuStrip({ categories }: { categories: CategoryItem[] }) {
  if (categories.length === 0) {
    return null;
  }

  const mobile = balancedPositions(categories.length, 2);
  const tablet = balancedPositions(categories.length, 3);
  const desktop = balancedPositions(categories.length, 6);

  return (
    <section className="w-full bg-transparent">
      <div className="pf-shell px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <div className={styles.grid}>
          {categories.map((category, index) => (
            <div
              key={category.id}
              className={styles.tile}
              style={{
                "--mobile-row": mobile[index].row,
                "--mobile-column": mobile[index].column,
                "--tablet-row": tablet[index].row,
                "--tablet-column": tablet[index].column,
                "--desktop-row": desktop[index].row,
                "--desktop-column": desktop[index].column,
              } as CSSProperties}
            >
              <CategoryCard category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
