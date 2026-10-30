import type ExcelJS from "exceljs";
import template from "@/lib/customer-order-template.json";

const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF939DA4" } },
  bottom: { style: "thin", color: { argb: "FF939DA4" } },
  left: { style: "thin", color: { argb: "FF939DA4" } },
  right: { style: "thin", color: { argb: "FF939DA4" } },
};

export function addCustomerOrderRemito(workbook: ExcelJS.Workbook, sourceLastRow: number, productCount: number, date: string) {
  const remito = workbook.addWorksheet("REMITO", {
    views: [{ state: "normal", activeCell: "A1", zoomScale: 90 }],
    pageSetup: { ...template.remito.pageSetup, printTitlesRow: "1:5" } as Partial<ExcelJS.PageSetup>,
  });
  remito.columns = template.remito.columns.map((column, index) => ({ width: Math.max(column.width, [94, 12, 18, 20][index]) }));
  for (const header of template.remito.headerRows) {
    const row = remito.addRow(header.cells.map(cell => cell.value as ExcelJS.CellValue));
    row.height = Math.max(header.height, [36, 36, 32, 30, 28][row.number - 1]);
    header.cells.forEach((cell, index) => {
      row.getCell(index + 1).style = structuredClone(cell.style) as Partial<ExcelJS.Style>;
      row.getCell(index + 1).alignment = { ...row.getCell(index + 1).alignment, vertical: "middle", wrapText: true };
      row.getCell(index + 1).protection = { locked: true };
    });
  }
  for (const merge of template.remito.merges) remito.mergeCellsWithoutStyle(merge);
  remito.getCell("A1").value = `REMITO    ${date}`;
  remito.getCell("A2").value = { formula: `TRIM('PEDIDO CLIENTE'!C5&"   "&'PEDIDO CLIENTE'!C8&IF('PEDIDO CLIENTE'!C4="","","   CUIT "&'PEDIDO CLIENTE'!C4))`, result: "" };
  remito.getCell("A3").value = { formula: `TRIM('PEDIDO CLIENTE'!C6&"   "&'PEDIDO CLIENTE'!C7)`, result: "" };
  for (let column = 1; column <= 4; column++) {
    const cell = remito.getRow(5).getCell(column);
    cell.font = { name: "Calibri", size: 12, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
    cell.border = border;
  }
  const lastRow = 6 + productCount;
  const source = "'PEDIDO CLIENTE'!";
  const indices = `${source}$G$15:$G$${sourceLastRow}`;
  const details = `${source}$C$15:$C$${sourceLastRow}`;
  const quantities = `${source}$A$15:$A$${sourceLastRow}`;
  const prices = `${source}$E$15:$E$${sourceLastRow}`;
  remito.getColumn(5).width = 12;
  remito.getColumn(6).hidden = true;
  remito.getCell("E5").value = "Quitar";
  remito.getCell("E5").style = structuredClone(remito.getCell("D5").style);
  remito.getCell("E5").alignment = { horizontal: "center", vertical: "middle" };
  workbook.definedNames.add("'REMITO'!$E$5", "PedidoQuitar");
  workbook.definedNames.add("'REMITO'!$F$5", "PedidoOrigen");
  workbook.definedNames.add(indices, "PedidoIndice");
  for (let number = 6; number <= lastRow; number++) {
    const position = number - 5;
    const row = remito.getRow(number);
    row.height = 42;
    row.getCell(6).value = { formula: `IFERROR(MATCH(${position},${indices},0),0)`, result: 0 };
    row.getCell(1).value = { formula: `IF(F${number}>0,INDEX(${details},F${number}),IF(${position}=COUNT(${indices})+1,"TOTAL",""))`, result: number === 6 ? "TOTAL" : "" };
    row.getCell(2).value = { formula: `IF(F${number}>0,INDEX(${quantities},F${number}),"")`, result: "" };
    row.getCell(3).value = { formula: `IF(F${number}>0,INDEX(${prices},F${number}),"")`, result: "" };
    // SUM must include every line. Excel's SUBTOTAL excludes cells whose formulas
    // contain another SUBTOTAL, even when that IF branch is not currently used.
    row.getCell(4).value = { formula: `IF(F${number}>0,B${number}*C${number},IF(A${number}="TOTAL",SUM($D$5:D${number - 1}),""))`, result: number === 6 ? 0 : "" };
    row.getCell(5).value = { formula: `IF(F${number}>0,"X","")`, result: "" };
    row.getCell(5).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFB03A2E" } };
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    for (let column = 1; column <= 4; column++) {
      const cell = row.getCell(column);
      cell.font = { name: "Calibri", size: 11, bold: column === 1 || column === 2 };
      cell.alignment = { vertical: "middle", horizontal: column === 1 ? "left" : "right", wrapText: column === 1 };
      cell.numFmt = column === 1 ? "General" : "#,##0";
    }
  }
  remito.addConditionalFormatting({ ref: `A6:E${lastRow}`, rules: [
    { type: "expression", priority: 1, formulae: ['$A6="TOTAL"'], style: { border, font: { bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } } } },
    { type: "expression", priority: 2, formulae: ['AND($A6<>"",$A6<>"TOTAL")'], style: { border } },
  ] });
  remito.autoFilter = `A5:D${lastRow}`;
  remito.pageSetup.printArea = `A1:D${lastRow}`;
  return remito;
}
