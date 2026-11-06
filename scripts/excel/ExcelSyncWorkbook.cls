Attribute VB_Name = "ThisWorkbook"
Attribute VB_Base = "0{00020819-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Option Explicit

Private Sub Workbook_Open()
    Dim eventsEnabled As Boolean
    eventsEnabled = Application.EnableEvents
    On Error GoTo Failed
    If Len(Trim$(CStr(Sheets("CONFIGURACION").Range("B2").Value))) = 0 Or CStr(Sheets("CONFIGURACION").Range("B2").Value) = "REEMPLAZAR_TOKEN" Then Exit Sub
    Application.EnableEvents = False
    ActualizarCatalogo
    Application.EnableEvents = eventsEnabled
    Exit Sub
Failed:
    Application.EnableEvents = eventsEnabled
    MsgBox "No se pudo actualizar el catalogo al abrir: " & Err.Description, vbExclamation, "PintoFruta"
End Sub
