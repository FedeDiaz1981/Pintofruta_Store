"""Build the VBA project embedded in the local Excel catalog workbook."""

import base64
import os
import struct
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

from ms_ovba.Models.Entities.doc_module import DocModule
from ms_ovba.Models.Entities.std_module import StdModule
from ms_ovba.Models.Entities.reference import Reference
from ms_ovba.Models.Entities.reference_registered import ReferenceRegistered
from ms_ovba.Models.Fields.libid_reference import LibidReference
from ms_ovba.Views.project_ole_file import ProjectOleFile
from ms_ovba.vbaProject import VbaProject
from ms_ovba_compression.ms_ovba import MsOvba
from ms_dtyp.filetime import Filetime
from oletools.olevba import VBA_Parser

root = Path(__file__).resolve().parents[1]
Filetime.from_msfiletime = classmethod(lambda cls, value: cls(1601, 1, 1) + timedelta(microseconds=value // 10))

def literal_chunk(data: bytes) -> bytes:
    body = b"".join(b"\x00" + data[i:i + 8] for i in range(0, len(data), 8))
    if not body or len(body) > 4096:
        raise ValueError("VBA literal chunk is too large")
    return b"\x01" + struct.pack("<H", 0xB000 | (len(body) - 1)) + body

def literal_container(data: bytes) -> bytes:
    # A compressed VBA stream may contain multiple literal chunks.
    chunks = [literal_chunk(data[i:i + 2800]) for i in range(0, len(data), 2800)]
    return b"\x01" + b"".join(chunk[1:] for chunk in chunks)

MsOvba.compress = lambda self, data: literal_container(data)
project = VbaProject()
project.project_id = "{8A6B3C15-2A08-4E7B-9D4E-3E9A8F2D1C10}"
for name, guid, version, location, title in [
    ("VBA", "000204EF-0000-0000-C000-000000000046", "4.0", r"C:\Program Files\Common Files\Microsoft Shared\VBA\VBA7.1\VBE7.DLL", "Visual Basic For Applications"),
    ("Excel", "00020813-0000-0000-C000-000000000046", "1.9", r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE", "Microsoft Excel 16.0 Object Library"),
]:
    project.add_reference(Reference(ReferenceRegistered(LibidReference(uuid.UUID(guid), version, "0", location, title)), name))

workbook_source = (root / "scripts/excel/ExcelSyncWorkbook.cls").read_text(encoding="ascii")
sync_source = (root / "scripts/excel/CatalogSync.bas").read_text(encoding="ascii")
sources = {"ThisWorkbook": workbook_source, "CatalogSync": sync_source}
for index in range(1, 6):
    sheet_source = "\n".join([
        f'Attribute VB_Name = "Sheet{index}"',
        'Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"',
        'Attribute VB_GlobalNameSpace = False',
        'Attribute VB_Creatable = False',
        'Attribute VB_PredeclaredId = True',
        'Attribute VB_Exposed = True',
        'Attribute VB_TemplateDerived = False',
        'Attribute VB_Customizable = True',
        'Option Explicit',
        '',
    ])
    if index == 1:
        sheet_source += "\nPrivate Sub Worksheet_SelectionChange(ByVal Target As Range)\n    If Not Intersect(Target, Range(\"A1\")) Is Nothing Then Application.Run \"'\" & ThisWorkbook.Name & \"'!ActualizarCatalogo\"\n    If Not Intersect(Target, Range(\"B1\")) Is Nothing Then Application.Run \"'\" & ThisWorkbook.Name & \"'!SincronizarCambios\"\n    If Not Intersect(Target, Range(\"C1\")) Is Nothing Then Application.Run \"'\" & ThisWorkbook.Name & \"'!OrdenarProductosPorMarca\"\nEnd Sub\n\nPrivate Sub Worksheet_Change(ByVal Target As Range)\n    If Intersect(Target, Range(\"B4:B5000\")) Is Nothing Then Exit Sub\n    On Error GoTo CleanUp\n    Application.EnableEvents = False\n    ValidarIdsPrecios\nCleanUp:\n    Application.EnableEvents = True\nEnd Sub\n"
    sources[f"Sheet{index}"] = sheet_source

with tempfile.TemporaryDirectory(prefix="pintofruta-excel-vba-") as build_dir:
    previous = Path.cwd()
    os.chdir(build_dir)
    try:
        for name, source in sources.items():
            module = StdModule(name) if name == "CatalogSync" else DocModule(name)
            module.add_file(str(Path(build_dir) / name))
            Path(module.bin_path.removesuffix(".bin") + ".new").write_bytes(source.replace("\r\n", "\n").replace("\n", "\r\n").encode("ascii"))
            project.add_module(module)
        ProjectOleFile.write_file(project)
        binary = Path("vbaProject.bin").read_bytes()
    finally:
        os.chdir(previous)

parser = VBA_Parser("excel-sync.bin", data=binary)
try:
    extracted = {name: code for _, _, name, code in parser.extract_macros()}
finally:
    parser.close()
for name, expected in sources.items():
    extension = "bas" if name == "CatalogSync" else "cls"
    actual = extracted[f"{name}.{extension}"]
    if isinstance(actual, bytes):
        actual = actual.decode("ascii")
    assert actual.replace("\r\n", "\n").strip() == expected.replace("\r\n", "\n").strip(), name

output = root / "artifacts" / "excel-sync-vba-project.bin"
output.parent.mkdir(exist_ok=True)
output.write_bytes(binary)
print(f"Generated {output} ({len(binary)} bytes)")
