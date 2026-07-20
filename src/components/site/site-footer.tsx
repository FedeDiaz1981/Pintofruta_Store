import Image from "next/image";
import { publicAsset } from "@/lib/catalog";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-primary-darker),var(--pf-primary-dark))] text-[#f8f1e7]">
      <div className="pf-shell grid gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-12">
        <div>
          <div className="inline-flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 shadow-sm">
            <Image
              src={publicAsset("/assets/images/logo/logo-Pintofruta.png")}
              alt="Pintofruta"
              width={220}
              height={56}
              className="h-auto w-[150px] sm:w-[180px]"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.28em] text-[#f8f1e7]/70">Navegación</h3>
          <ul className="space-y-2 text-sm text-[#f8f1e7]/80">
            <li>Inicio</li>
            <li>Galería</li>
            <li>Búsqueda</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
