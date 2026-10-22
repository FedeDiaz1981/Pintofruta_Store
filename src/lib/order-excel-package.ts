import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { REMITO_VBA_PROJECT_BASE64 } from "@/lib/remito-vba-project";
import { normalizeWorkbookFonts } from "@/lib/excel-workbook-compat";

export const REMITO_CONTENT_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12";

const SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const VBA_RELATIONSHIP = "http://schemas.microsoft.com/office/2006/relationships/vbaProject";

export async function packageRemitoWorkbook(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const readXml = async (name: string) => {
    const entry = zip.file(name);
    if (!entry) throw new Error(`Falta ${name} en el remito.`);
    return parser.parseFromString(await entry.async("string"), "application/xml");
  };
  const writeXml = (name: string, document: ReturnType<typeof parser.parseFromString>) => {
    zip.file(name, serializer.serializeToString(document));
  };

  const workbook = await readXml("xl/workbook.xml");
  workbook.getElementsByTagNameNS(SPREADSHEET_NS, "workbookPr")[0].setAttribute("codeName", "ThisWorkbook");
  // Removed template sheets must not leave filter names pointing to missing tabs.
  const definedNames = workbook.getElementsByTagNameNS(SPREADSHEET_NS, "definedName");
  for (const name of Array.from(definedNames)) {
    if (name.getAttribute("name") === "_xlnm._FilterDatabase") name.parentNode?.removeChild(name);
  }
  writeXml("xl/workbook.xml", workbook);

  for (const entry of zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)) {
    const sheet = await readXml(entry.name);
    let properties = sheet.getElementsByTagNameNS(SPREADSHEET_NS, "sheetPr")[0];
    if (!properties) {
      properties = sheet.createElementNS(SPREADSHEET_NS, "sheetPr");
      sheet.documentElement!.insertBefore(properties, sheet.documentElement!.firstChild);
    }
    properties.setAttribute("codeName", "Sheet1");
    // ExcelJS emits outlinePr after pageSetUpPr, which violates the worksheet schema.
    const outline = properties.getElementsByTagNameNS(SPREADSHEET_NS, "outlinePr")[0];
    const pageSetup = properties.getElementsByTagNameNS(SPREADSHEET_NS, "pageSetUpPr")[0];
    if (outline && pageSetup) properties.insertBefore(outline, pageSetup);
    // Internal hyperlinks use a location, without an external relationship.
    for (const link of Array.from(sheet.getElementsByTagNameNS(SPREADSHEET_NS, "hyperlink"))) {
      const location = link.getAttribute("location");
      if (location) {
        link.removeAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        if (location.startsWith("#")) link.setAttribute("location", location.slice(1));
      }
    }
    for (const validations of Array.from(sheet.getElementsByTagNameNS(SPREADSHEET_NS, "dataValidations"))) {
      validations.parentNode?.removeChild(validations);
    }
    writeXml(entry.name, sheet);
  }

  await normalizeWorkbookFonts(zip);

  const types = await readXml("[Content_Types].xml");
  const typesRoot = types.documentElement!;
  for (const override of Array.from(types.getElementsByTagName("Override"))) {
    if (override.getAttribute("PartName") === "/xl/workbook.xml") {
      override.setAttribute("ContentType", "application/vnd.ms-excel.sheet.macroEnabled.main+xml");
    }
  }
  const vbaType = types.createElementNS(typesRoot.namespaceURI, "Override");
  vbaType.setAttribute("PartName", "/xl/vbaProject.bin");
  vbaType.setAttribute("ContentType", "application/vnd.ms-office.vbaProject");
  typesRoot.appendChild(vbaType);
  writeXml("[Content_Types].xml", types);

  const relationships = await readXml("xl/_rels/workbook.xml.rels");
  const vbaRelationship = relationships.createElementNS(RELATIONSHIPS_NS, "Relationship");
  vbaRelationship.setAttribute("Id", "rIdRemitoVba");
  vbaRelationship.setAttribute("Type", VBA_RELATIONSHIP);
  vbaRelationship.setAttribute("Target", "vbaProject.bin");
  relationships.documentElement!.appendChild(vbaRelationship);
  writeXml("xl/_rels/workbook.xml.rels", relationships);
  zip.file("xl/vbaProject.bin", Buffer.from(REMITO_VBA_PROJECT_BASE64, "base64"));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
