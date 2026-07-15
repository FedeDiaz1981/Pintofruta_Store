"use client";

import { useState } from "react";
import type { PackItem } from "@/domain/site-content";
import { PackCard } from "@/components/site/pack-card";
import { PackDetailModal } from "@/components/site/pack-detail-modal";

function getColumnClass(columns: number) {
  if (columns <= 2) {
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2";
  }

  if (columns >= 4) {
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

export function PackGrid({ packs, columns = 3 }: { packs: PackItem[]; columns?: number }) {
  const [selectedPack, setSelectedPack] = useState<PackItem | null>(null);

  return (
    <>
      <div className={`grid gap-4 ${getColumnClass(columns)}`}>
        {packs.map((pack) => (
          <PackCard key={pack.id} pack={pack} onSelect={setSelectedPack} />
        ))}
      </div>

      <PackDetailModal key={selectedPack?.id ?? "empty"} pack={selectedPack} onClose={() => setSelectedPack(null)} />
    </>
  );
}
