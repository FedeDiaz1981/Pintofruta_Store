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
    On Error GoTo Finished
    RecalculateOrder
Finished:
End Sub

Private Sub RecalculateOrder()
    ThisWorkbook.Worksheets("PEDIDO CLIENTE").Calculate
    ThisWorkbook.Worksheets("REMITO").Calculate
End Sub

Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    On Error GoTo Finished
    If Sh.Name <> "PEDIDO CLIENTE" Then Exit Sub
    If Application.Intersect(Target, Sh.Range("C4:D8")) Is Nothing Then
        If Application.Intersect(Target, ThisWorkbook.Names("PedidoIndice").RefersToRange.Offset(0, -6)) Is Nothing Then Exit Sub
    End If
    RecalculateOrder
Finished:
End Sub

Private Sub Workbook_SheetFollowHyperlink(ByVal Sh As Object, ByVal Target As Hyperlink)
    Dim clicked As Range, origin As Range, indices As Range, quantity As Range
    Dim position As Variant
    Dim eventsWereOn As Boolean, screenWasOn As Boolean
    eventsWereOn = Application.EnableEvents
    screenWasOn = Application.ScreenUpdating
    On Error GoTo Failed
    If Sh.Name <> "REMITO" Then Exit Sub
    Set clicked = Target.Range
    If clicked.Cells.CountLarge <> 1 Then Exit Sub
    If clicked.Column <> Sh.Range("PedidoQuitar").Column Then Exit Sub
    If clicked.Row < 6 Then Exit Sub
    If CStr(clicked.Value2) <> "X" Then Exit Sub
    Set origin = Sh.Range("PedidoOrigen")
    position = Sh.Cells(clicked.Row, origin.Column).Value2
    If Not IsNumeric(position) Then Exit Sub
    If position < 1 Or position <> Fix(position) Then Exit Sub
    Set indices = ThisWorkbook.Names("PedidoIndice").RefersToRange
    If position > indices.Rows.Count Then Exit Sub
    Set quantity = indices.Cells(CLng(position), 1).Offset(0, -6)
    If Not IsNumeric(quantity.Value2) Then Exit Sub
    If quantity.Value2 <= 0 Then Exit Sub
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    quantity.ClearContents
    RecalculateOrder
    Sh.Cells(clicked.Row, 1).Select
CleanUp:
    Application.ScreenUpdating = screenWasOn
    Application.EnableEvents = eventsWereOn
    Exit Sub
Failed:
    MsgBox "No se pudo quitar el producto. Verifique que el archivo permita edicion.", vbExclamation, "Remito"
    Resume CleanUp
End Sub
