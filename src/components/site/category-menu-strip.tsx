import Link from "next/link";
import type { CategoryItem } from "@/domain/site-content";
import { categoryIconComponents, resolveCategoryIconKey, type CategoryIconKey } from "@/lib/category-icons";

function CategoryCard({ category }: { category: CategoryItem }) {
  const iconKey: CategoryIconKey = (category.icon as CategoryIconKey | undefined) ?? resolveCategoryIconKey(category.name);
  const Icon = categoryIconComponents[iconKey] ?? categoryIconComponents.package;

  return (
    <Link
      href={`/galeria?category=${encodeURIComponent(category.name)}`}
      className="group flex aspect-square min-h-[170px] flex-col items-center justify-center gap-5 rounded-[1.65rem] border border-[rgba(168,109,69,0.16)] bg-[linear-gradient(180deg,rgba(231,234,216,0.95)_0%,rgba(241,239,226,0.96)_100%)] px-5 py-6 text-center shadow-[0_10px_24px_rgba(74,57,38,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(74,57,38,0.12)]"
    >
      <span className="grid size-20 place-items-center rounded-[1.3rem] border border-[rgba(74,57,38,0.08)] bg-[rgba(248,242,232,0.82)] text-[var(--pf-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <Icon className="size-10 stroke-[1.8]" />
      </span>

      <span className="text-[0.95rem] font-semibold tracking-[0.02em] text-[var(--pf-text)] sm:text-[1rem]">
        {category.name}
      </span>
    </Link>
  );
}

export function CategoryMenuStrip({ categories }: { categories: CategoryItem[] }) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-transparent">
      <div className="pf-shell px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <div className="grid grid-flow-col gap-4 overflow-x-auto pb-2 [scrollbar-width:none] lg:grid-flow-row lg:grid-cols-6 lg:overflow-visible">
          {categories.map((category) => (
            <div key={category.id} className="min-w-[180px] lg:min-w-0">
              <CategoryCard category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
