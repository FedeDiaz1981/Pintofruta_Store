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
    Dim Sh As Worksheet
    Dim header As Range
    Dim total As Range
    Dim productRow As Range

    On Error GoTo Finished
    Set Sh = ThisWorkbook.Worksheets("REMITO")
    Set header = Sh.Range("RemitoQuitar")
    Set total = Sh.Range("RemitoTotal")
    If total.Row <= header.Row + 1 Then Exit Sub
    With Sh.Range(Sh.Cells(header.Row + 1, 1), Sh.Cells(total.Row - 1, header.Column))
        For Each productRow In .Rows
            If Not productRow.Hidden Then
                productRow.AutoFit
                If productRow.RowHeight < 24 Then productRow.RowHeight = 24
            End If
        Next productRow
    End With
Finished:
End Sub

Private Sub Workbook_SheetFollowHyperlink(ByVal Sh As Object, ByVal Target As Hyperlink)
    Dim clicked As Range
    Dim header As Range
    Dim total As Range
    Dim productRow As Long
    Dim eventsEnabled As Boolean
    Dim screenUpdating As Boolean

    eventsEnabled = Application.EnableEvents
    screenUpdating = Application.ScreenUpdating
    On Error GoTo Failed

    If Sh.Name <> "REMITO" Then Exit Sub
    Set clicked = Target.Range
    If clicked.Cells.CountLarge <> 1 Then Exit Sub
    If CStr(clicked.Value2) <> "X" Then Exit Sub
    Set header = Sh.Range("RemitoQuitar")
    Set total = Sh.Range("RemitoTotal")
    If clicked.Column <> header.Column Then Exit Sub
    If clicked.Row <= header.Row Or clicked.Row >= total.Row Then Exit Sub

    productRow = clicked.Row
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Sh.Rows(productRow).Delete
    Sh.Calculate
    Sh.Cells(productRow, 1).Select

CleanUp:
    Application.ScreenUpdating = screenUpdating
    Application.EnableEvents = eventsEnabled
    Exit Sub

Failed:
    MsgBox "No se pudo eliminar la fila. Verifique que el archivo permita edicion y no este protegido.", vbExclamation, "Remito"
    Resume CleanUp
End Sub
