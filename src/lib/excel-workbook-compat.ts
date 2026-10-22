import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type JSZip from "jszip";

export async function normalizeWorkbookFonts(zip: JSZip) {
  const entry = zip.file("xl/styles.xml");
  if (!entry) throw new Error("El Excel no contiene estilos.");
  const styles = new DOMParser().parseFromString(await entry.async("string"), "application/xml");
  // Excel 2007 requires font children in schema order; ExcelJS uses a different order.
  const order = ["b", "i", "strike", "condense", "extend", "outline", "shadow", "u", "vertAlign", "sz", "color", "name", "family", "charset", "scheme"];
  for (const font of Array.from(styles.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main", "font"))) {
    const children = Array.from(font.childNodes).filter((child) => child.nodeType === 1);
    children.sort((left, right) => order.indexOf(left.nodeName) - order.indexOf(right.nodeName));
    for (const child of children) font.appendChild(child);
  }
  zip.file("xl/styles.xml", new XMLSerializer().serializeToString(styles));
}
