export const HERO_IMAGE_LINK_ERROR = "El enlace de la imagen debe ser una URL http/https o una ruta del sitio.";

export function resolveHeroImageHref(value: string | null | undefined): string | null {
  const href = value?.trim();
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href) || href.startsWith("//")) return null;
  try {
    const url = new URL(href, "https://pintofruta.invalid/");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (/^https?:\/\//i.test(href)) return url.href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
    if (url.pathname === "/galeria.html") url.pathname = "/galeria";
    if (url.pathname === "/busqueda.html") url.pathname = "/busqueda";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
