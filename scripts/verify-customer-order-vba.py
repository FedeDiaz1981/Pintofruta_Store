"""Independently inspect the VBA embedded in the customer-order export."""
import base64
import io
from pathlib import Path
import re
import struct
import sys
import zipfile

import olefile
from oletools.olevba import VBA_Parser

root = Path(__file__).resolve().parents[1]
source = (root / "src/lib/customer-order-vba-project.ts").read_text(encoding="ascii")
binary = base64.b64decode(re.search(r'BASE64 = "([^"]+)"', source).group(1))
with olefile.OleFileIO(io.BytesIO(binary)) as compound:
    assert {("VBA", name) for name in ("ThisWorkbook", "Sheet1", "Sheet2")} <= {tuple(stream) for stream in compound.listdir()}
    assert struct.unpack_from("<H", compound.openstream("VBA/_VBA_PROJECT").read(), 2)[0] == 0xFFFF
    project = compound.openstream("PROJECT").read().decode("cp1252")
    for name in ("ThisWorkbook", "Sheet1", "Sheet2"):
        assert f"Document={name}/" in project

parser = VBA_Parser("customer-order.bin", data=binary)
try:
    modules = {name: code.decode("cp1252") if isinstance(code, bytes) else code for _, _, name, code in parser.extract_macros()}
finally:
    parser.close()
assert set(modules) == {"ThisWorkbook.cls", "Sheet1.cls", "Sheet2.cls"}
expected = (root / "scripts/excel/CustomerOrderWorkbook.cls").read_text(encoding="ascii").replace("\r\n", "\n").strip()
assert modules["ThisWorkbook.cls"].replace("\r\n", "\n").strip() == expected
for required in ("Workbook_SheetFollowHyperlink", "Workbook_SheetChange", 'Sh.Name <> "PEDIDO CLIENTE"', 'Sh.Name <> "REMITO"', 'CStr(clicked.Value2) <> "X"', 'ThisWorkbook.Names("PedidoIndice")', 'Sh.Range("PedidoOrigen")', "quantity.ClearContents", "RecalculateOrder", "Application.EnableEvents = eventsWereOn"):
    assert required in expected
assert 'ThisWorkbook.Worksheets("PEDIDO CLIENTE").Calculate' in expected
assert 'ThisWorkbook.Worksheets("REMITO").Calculate' in expected
assert "Rows(productRow).Delete" not in expected

for argument in sys.argv[1:]:
    with zipfile.ZipFile(argument) as archive:
        assert archive.read("xl/vbaProject.bin") == binary
    print(f"Verified embedded VBA in {Path(argument).name}")
print("OK independent VBA extraction, open/change/delete events, explicit recalculation of both sheets, exact source, row-based removal and Excel cache version.")
