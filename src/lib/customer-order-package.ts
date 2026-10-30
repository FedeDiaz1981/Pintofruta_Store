import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type JSZip from "jszip";
import { CUSTOMER_ORDER_VBA_PROJECT_BASE64 } from "@/lib/customer-order-vba-project";

export const CUSTOMER_ORDER_CONTENT_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12";
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

export async function attachCustomerOrderMacros(zip: JSZip, lastRemitoRow: number) {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const readXml = async (name: string) => {
    const entry = zip.file(name);
    if (!entry) throw new Error(`Falta ${name} en la planilla.`);
    return parser.parseFromString(await entry.async("string"), "application/xml");
  };
  const writeXml = (name: string, document: ReturnType<typeof parser.parseFromString>) => zip.file(name, serializer.serializeToString(document));
  const workbook = await readXml("xl/workbook.xml");
  workbook.getElementsByTagNameNS(SHEET_NS, "workbookPr")[0].setAttribute("codeName", "ThisWorkbook");
  writeXml("xl/workbook.xml", workbook);
  for (const number of [1, 2]) {
    const name = `xl/worksheets/sheet${number}.xml`;
    const document = await readXml(name);
    document.getElementsByTagNameNS(SHEET_NS, "sheetPr")[0].setAttribute("codeName", `Sheet${number}`);
    if (number === 2 && lastRemitoRow > 6) {
      const root = document.documentElement!;
      const hyperlinks = document.createElementNS(SHEET_NS, "hyperlinks");
      for (let row = 6; row < lastRemitoRow; row++) {
        const link = document.createElementNS(SHEET_NS, "hyperlink");
        link.setAttribute("ref", `E${row}`);
        link.setAttribute("location", `'REMITO'!A${row}`);
        link.setAttribute("tooltip", "Quitar este producto del pedido");
        hyperlinks.appendChild(link);
      }
      // Hyperlinks follow conditional formatting/validation and precede print settings.
      const following = new Set(["printOptions", "pageMargins", "pageSetup", "headerFooter", "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"]);
      const before = Array.from(root.childNodes).find(node => node.nodeType === 1 && following.has(node.localName ?? ""));
      root.insertBefore(hyperlinks, before ?? null);
    }
    writeXml(name, document);
  }
  const types = await readXml("[Content_Types].xml");
  const typesRoot = types.documentElement!;
  for (const entry of Array.from(types.getElementsByTagName("Override"))) {
    if (entry.getAttribute("PartName") === "/xl/workbook.xml") entry.setAttribute("ContentType", "application/vnd.ms-excel.sheet.macroEnabled.main+xml");
  }
  const override = types.createElementNS(typesRoot.namespaceURI, "Override");
  override.setAttribute("PartName", "/xl/vbaProject.bin");
  override.setAttribute("ContentType", "application/vnd.ms-office.vbaProject");
  typesRoot.appendChild(override);
  writeXml("[Content_Types].xml", types);
  const relationships = await readXml("xl/_rels/workbook.xml.rels");
  const relationship = relationships.createElementNS(REL_NS, "Relationship");
  relationship.setAttribute("Id", "rIdCustomerOrderVba");
  relationship.setAttribute("Type", "http://schemas.microsoft.com/office/2006/relationships/vbaProject");
  relationship.setAttribute("Target", "vbaProject.bin");
  relationships.documentElement!.appendChild(relationship);
  writeXml("xl/_rels/workbook.xml.rels", relationships);
  zip.file("xl/vbaProject.bin", Buffer.from(CUSTOMER_ORDER_VBA_PROJECT_BASE64, "base64"));
}
