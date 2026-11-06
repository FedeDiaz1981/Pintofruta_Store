Attribute VB_Name = "CatalogSync"
Option Explicit

Private Const MAX_LINES As Long = 5000

Public Sub ActualizarCatalogo()
    Dim text As String, lines() As String, section As String, i As Long
    DesprotegerPlanillas
    LimpiarCatalogoInterno
    text = HttpGet(CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B1").Value), CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B2").Value))
    lines = Split(text, vbCrLf)
    section = ""
    For i = 0 To UBound(lines)
        If Len(lines(i)) = 0 Then GoTo ContinueLine
        If Left$(lines(i), 1) = "[" Then
            section = lines(i)
        ElseIf InStr(1, lines(i), vbTab, vbBinaryCompare) > 0 Then
            If Left$(lines(i), 1) <> "i" And i < MAX_LINES Then WriteCatalogRow section, lines(i)
        End If
ContinueLine:
    Next i
    ThisWorkbook.Worksheets("CONFIGURACION").Range("B3").Value = Now
    ActualizarPedidoDesdeProductos
    AjustarFormatoPrecios
End Sub

Private Sub LimpiarCatalogoInterno()
    Dim names As Variant, item As Variant, sh As Object, usedLast As Long, maxColumn As Long
    names = Array("PRODUCTOS", "MARCAS", "CATEGORIAS")
    For Each item In names
        Set sh = ThisWorkbook.Worksheets(CStr(item))
        If CStr(item) = "PRODUCTOS" Then maxColumn = 13 Else maxColumn = 4
        usedLast = sh.Cells(sh.Rows.Count, 1).End(-4162).Row
        If usedLast >= 2 Then sh.Range(sh.Cells(2, 1), sh.Cells(usedLast, maxColumn)).ClearContents
    Next item
End Sub

Public Sub AjustarFormatoPrecios()
    Dim sh As Object, row As Long, last As Long, productRange As Object
    Set sh = ThisWorkbook.Worksheets("PRECIOS")
    last = sh.Cells(sh.Rows.Count, 3).End(-4162).Row
    If last < 4 Then Exit Sub
    Set productRange = sh.Range("A4:E" & last)
    With productRange
        .Font.Name = "Montserrat Medium"
        .Font.Size = 9
        .Font.Bold = False
        .WrapText = True
        .Borders.LineStyle = 1
        .Borders.Weight = 2
    End With
    sh.Range("A4:A" & last).Interior.Color = RGB(255, 226, 255)
    sh.Range("B4:B" & last).NumberFormat = "0"
    sh.Range("D4:E" & last).NumberFormat = "$ #,##0.00"
    sh.Range("A4:B" & last).HorizontalAlignment = -4108
    sh.Range("C4:C" & last).HorizontalAlignment = -4131
    sh.Range("D4:E" & last).HorizontalAlignment = -4152
    For row = 2 To last
        If row >= 4 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 And Len(Trim$(CStr(sh.Cells(row, 1).Value))) = 0 Then
            sh.Range("A" & row & ":E" & row).Font.Bold = True
            sh.Range("A" & row & ":E" & row).Font.Size = 16
            sh.Range("A" & row & ":E" & row).HorizontalAlignment = -4108
            sh.Range("A" & row & ":E" & row).Interior.Color = RGB(255, 255, 255)
            sh.Rows(row).RowHeight = 30
        Else
            If row >= 4 Then
                sh.Cells(row, 1).HorizontalAlignment = -4108
                sh.Cells(row, 2).HorizontalAlignment = -4108
                sh.Cells(row, 3).HorizontalAlignment = -4131
                sh.Cells(row, 4).HorizontalAlignment = -4152
                sh.Cells(row, 5).HorizontalAlignment = -4152
                sh.Rows(row).AutoFit
                If sh.Rows(row).RowHeight < 22 Then sh.Rows(row).RowHeight = 22
            End If
        End If
    Next row
End Sub

Private Sub ActualizarPedidoDesdeProductos()
    Dim source As Object, target As Object, brands As Object, brandKey As Variant
    Dim row As Long, last As Long, targetLast As Long, outRow As Long
    Dim brand As String, productName As String, displayText As String
    Set source = ThisWorkbook.Worksheets("PRODUCTOS")
    Set target = ThisWorkbook.Worksheets("PRECIOS")
    Set brands = CreateObject("Scripting.Dictionary")
    last = source.Cells(source.Rows.Count, 1).End(-4162).Row
    targetLast = target.Cells(target.Rows.Count, 3).End(-4162).Row
    If targetLast >= 4 Then target.Range(target.Cells(4, 1), target.Cells(targetLast, 5)).ClearContents
    For row = 2 To last
        brand = Trim$(CStr(source.Cells(row, 6).Value))
        If Len(brand) > 0 Then
            If Not brands.Exists(brand) Then brands.Add brand, True
        End If
    Next row
    outRow = 4
    For Each brandKey In brands.Keys
        target.Cells(outRow, 1).Value = ""
        target.Cells(outRow, 2).Value = ""
        target.Cells(outRow, 3).Value = CStr(brandKey)
        target.Cells(outRow, 4).Value = ""
        target.Cells(outRow, 5).Value = ""
        outRow = outRow + 1
        For row = 2 To last
            brand = Trim$(CStr(source.Cells(row, 6).Value))
            If brand = CStr(brandKey) Then
                productName = Trim$(CStr(source.Cells(row, 3).Value))
                displayText = Trim$(CStr(source.Cells(row, 4).Value))
                If Len(displayText) = 0 Then displayText = productName
                target.Cells(outRow, 1).Value = IIf(LCase$(CStr(source.Cells(row, 13).Value)) = "inactive", "NO", "SI")
                target.Cells(outRow, 2).Value = source.Cells(row, 1).Value
                target.Cells(outRow, 3).Value = DisplayProductText(displayText, brand)
                target.Cells(outRow, 4).Value = source.Cells(row, 7).Value
                target.Cells(outRow, 5).Value = source.Cells(row, 8).Value
                outRow = outRow + 1
            End If
        Next row
    Next brandKey
    If outRow <= targetLast Then target.Range(target.Cells(outRow, 1), target.Cells(targetLast, 5)).ClearContents
End Sub

Private Sub ActualizarSeparadoresDesdeProductos()
    Dim source As Object, target As Object, found As Object
    Dim row As Long, last As Long, productName As String, brand As String, title As String
    Set source = ThisWorkbook.Worksheets("PRODUCTOS")
    Set target = ThisWorkbook.Worksheets("PRECIOS")
    last = target.Cells(target.Rows.Count, 3).End(-4162).Row
    For row = 2 To last - 1
        If Len(Trim$(CStr(target.Cells(row, 3).Value))) > 0 And Len(Trim$(CStr(target.Cells(row, 1).Value))) = 0 Then
            If UCase$(Trim$(CStr(target.Cells(row + 1, 1).Value))) = "SI" Then
                productName = Trim$(CStr(target.Cells(row + 1, 3).Value))
                Set found = source.Columns(3).Find(What:=productName, LookIn:=-4163, LookAt:=1)
                If Not found Is Nothing Then
                    brand = Trim$(CStr(source.Cells(found.Row, 6).Value))
                    target.Cells(row, 3).Value = brand
                End If
            End If
        End If
    Next row
End Sub

Private Sub WriteCatalogRow(ByVal section As String, ByVal line As String)
    Dim values() As String, target As Object, row As Long, j As Long, usedLast As Long
    values = Split(line, vbTab)
    If section = "[PRODUCTS]" Then Set target = ThisWorkbook.Worksheets("PRODUCTOS")
    If section = "[BRANDS]" Then Set target = ThisWorkbook.Worksheets("MARCAS")
    If section = "[CATEGORIES]" Then Set target = ThisWorkbook.Worksheets("CATEGORIAS")
    If target Is Nothing Then Exit Sub
    If target.Cells(2, 1).Value = "" Then
        usedLast = target.Cells(target.Rows.Count, 1).End(-4162).Row
        If usedLast >= 2 Then target.Range(target.Cells(2, 1), target.Cells(usedLast, 13)).ClearContents
    End If
    row = target.Cells(target.Rows.Count, 1).End(xlUp).Row + 1
    For j = 0 To UBound(values): target.Cells(row, j + 1).Value = values(j): Next j
End Sub

Public Sub SincronizarCambios()
    Dim payload As String
    DesprotegerPlanillas
    ActualizarProductosDesdePrecios
    payload = "{""workbookId"":""" & Json(CStr(ThisWorkbook.Name)) & """,""products"":["
    payload = payload & ProductsJson() & "],""brands"":[" & BrandsJson() & "],""categories"":[" & CategoriesJson() & "]}"
    Call HttpPost(CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B1").Value), CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B2").Value), payload)
    MsgBox "Cambios sincronizados correctamente.", vbInformation, "PintoFruta"
End Sub

Private Sub ActualizarProductosDesdePrecios()
    Dim source As Object, target As Object, found As Object
    Dim row As Long, last As Long, productName As String
    Set source = ThisWorkbook.Worksheets("PRODUCTOS")
    Set target = ThisWorkbook.Worksheets("PRECIOS")
    last = target.Cells(target.Rows.Count, 3).End(-4162).Row
    For row = 2 To last
        productName = Trim$(CStr(target.Cells(row, 3).Value))
        If Len(productName) > 0 Then
            Set found = Nothing
            If Len(Trim$(CStr(target.Cells(row, 2).Value))) > 0 Then
                Set found = source.Columns(1).Find(What:=target.Cells(row, 2).Value, LookIn:=-4163, LookAt:=1)
            End If
            If found Is Nothing Then Set found = FindProductByDisplay(source, productName)
            If Not found Is Nothing Then
                source.Cells(found.Row, 13).Value = IIf(UCase$(Trim$(CStr(target.Cells(row, 1).Value))) = "NO", "inactive", "published")
                source.Cells(found.Row, 7).Value = target.Cells(row, 4).Value
                source.Cells(found.Row, 8).Value = target.Cells(row, 5).Value
            End If
        End If
    Next row
End Sub

Private Function DisplayProductText(ByVal productName As String, ByVal brand As String) As String
    Dim text As String, prefix As String
    text = Trim$(productName): prefix = Trim$(brand)
    If Len(prefix) > 0 And LCase$(Left$(text, Len(prefix))) = LCase$(prefix) Then text = Trim$(Mid$(text, Len(prefix) + 1))
    DisplayProductText = text
End Function

Private Function FindProductByDisplay(ByVal source As Object, ByVal displayText As String) As Object
    Dim row As Long, last As Long
    last = source.Cells(source.Rows.Count, 1).End(-4162).Row
    For row = 2 To last
        If NormalizeMatch(DisplayProductText(CStr(source.Cells(row, 3).Value), CStr(source.Cells(row, 6).Value))) = NormalizeMatch(displayText) Then
            Set FindProductByDisplay = source.Cells(row, 1)
            Exit Function
        End If
    Next row
    Set FindProductByDisplay = Nothing
End Function

Private Function FindPrecioByDisplay(ByVal target As Object, ByVal displayText As String, ByVal fullProductName As String) As Object
    Dim row As Long, last As Long, currentText As String
    last = target.Cells(target.Rows.Count, 3).End(-4162).Row
    For row = 2 To last
        If Len(Trim$(CStr(target.Cells(row, 1).Value))) > 0 Then
        currentText = CStr(target.Cells(row, 3).Value)
            If NormalizeMatch(currentText) = NormalizeMatch(displayText) Or NormalizeMatch(currentText) = NormalizeMatch(fullProductName) Then
                Set FindPrecioByDisplay = target.Cells(row, 3)
                Exit Function
            End If
        End If
    Next row
    Set FindPrecioByDisplay = Nothing
End Function

Private Function NormalizeMatch(ByVal value As String) As String
    Dim text As String, compact As String, i As Long, code As Long, ch As String
    text = LCase$(Trim$(value))
    text = Replace(text, "sin stock", "")
    text = Replace(text, "nuevo", "")
    Do While InStr(1, text, "  ", vbBinaryCompare) > 0
        text = Replace(text, "  ", " ")
    Loop
    For i = 1 To Len(text)
        ch = Mid$(text, i, 1)
        code = AscW(ch)
        If (code >= 97 And code <= 122) Or (code >= 48 And code <= 57) Then compact = compact & ch
    Next i
    NormalizeMatch = compact
End Function

Public Sub DesprotegerPlanillas()
    Dim names As Variant, item As Variant
    names = Array("PRECIOS", "PRODUCTOS", "MARCAS", "CATEGORIAS", "CONFIGURACION")
    On Error Resume Next
    For Each item In names
        ThisWorkbook.Worksheets(CStr(item)).Unprotect
    Next item
    On Error GoTo 0
End Sub

Private Function ProductsJson() As String
    Dim sh As Object, r As Long, last As Long, s As String, q As String, item As String, productStatus As String
    q = Chr$(34)
    Set sh = ThisWorkbook.Worksheets("PRODUCTOS"): last = sh.Cells(sh.Rows.Count, 1).End(-4162).Row
    For r = 2 To last
        If IsNumeric(sh.Cells(r, 1).Value) Then
            If Len(s) > 0 Then s = s & ","
            productStatus = LCase$(Trim$(CStr(sh.Cells(r, 13).Value)))
            If productStatus <> "inactive" Then productStatus = "published"
            item = "{" & q & "id" & q & ":" & CLng(sh.Cells(r, 1).Value)
            item = item & "," & q & "name" & q & ":" & q & Json(sh.Cells(r, 3).Value) & q
            item = item & "," & q & "detail" & q & ":" & q & Json(sh.Cells(r, 4).Value) & q
            item = item & "," & q & "presentation" & q & ":" & q & Json(sh.Cells(r, 5).Value) & q
            item = item & "," & q & "brand" & q & ":" & q & Json(sh.Cells(r, 6).Value) & q
            item = item & "," & q & "publicPrice" & q & ":" & NumberOrNull(sh.Cells(r, 7).Value)
            item = item & "," & q & "memberPrice" & q & ":" & NumberOrNull(sh.Cells(r, 8).Value)
            item = item & "," & q & "categoryId" & q & ":" & NumberOrNull(sh.Cells(r, 9).Value)
            item = item & "," & q & "stock" & q & ":" & NumberOrNull(sh.Cells(r, 11).Value)
            item = item & "," & q & "soldOut" & q & ":" & IIf(sh.Cells(r, 12).Value = 1, "true", "false")
            item = item & "," & q & "status" & q & ":" & q & productStatus & q & "}"
            s = s & item
        End If
    Next r
    ProductsJson = s
End Function

Private Function BrandsJson() As String: BrandsJson = MasterJson("MARCAS", 1, 3, 4): End Function
Private Function CategoriesJson() As String: CategoriesJson = MasterJson("CATEGORIAS", 1, 2, 4): End Function

Private Function MasterJson(ByVal sheetName As String, ByVal idCol As Long, ByVal nameCol As Long, ByVal activeCol As Long) As String
    Dim sh As Object, r As Long, last As Long, s As String, q As String
    q = Chr$(34)
    Set sh = ThisWorkbook.Worksheets(sheetName): last = sh.Cells(sh.Rows.Count, idCol).End(-4162).Row
    For r = 2 To last
        If Len(Trim$(CStr(sh.Cells(r, nameCol).Value))) > 0 Then
            If Len(s) > 0 Then s = s & ","
            s = s & "{" & q & "id" & q & ":" & IdOrString(sh.Cells(r, idCol).Value) & "," & q & "name" & q & ":" & q & Json(sh.Cells(r, nameCol).Value) & q & "," & q & "active" & q & ":" & IIf(sh.Cells(r, activeCol).Value = 1, "true", "false") & "}"
        End If
    Next r
    MasterJson = s
End Function

Private Function IdOrString(ByVal value As Variant) As String
    If IsNumeric(value) And Len(Trim$(CStr(value))) > 0 Then IdOrString = CStr(CLng(value)) Else IdOrString = """" & Json(value) & """"
End Function

Private Function HttpGet(ByVal url As String, ByVal token As String) As String
    Dim req As Object: Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
    req.Open "GET", url & "?format=tsv", False: req.SetTimeouts 10000, 10000, 30000, 180000: req.SetRequestHeader "Authorization", "Bearer " & token: req.Send
    If req.Status < 200 Or req.Status >= 300 Then Err.Raise vbObjectError + req.Status, , "No se pudo actualizar el catalogo (HTTP " & req.Status & ")."
    HttpGet = req.ResponseText
End Function

Private Function HttpPost(ByVal url As String, ByVal token As String, ByVal body As String) As String
    Dim req As Object: Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
    req.Open "POST", url, False: req.SetTimeouts 10000, 10000, 30000, 300000: req.SetRequestHeader "Authorization", "Bearer " & token: req.SetRequestHeader "Content-Type", "application/json": req.Send body
    If req.Status < 200 Or req.Status >= 300 Then Err.Raise vbObjectError + req.Status, , "No se pudo sincronizar (HTTP " & req.Status & "): " & Left$(req.ResponseText, 500)
    HttpPost = req.ResponseText
End Function

Private Function Json(ByVal value As Variant) As String: Json = Replace(Replace(Replace(CStr(value), "\", "\\"), """", "\"""), vbCrLf, "\n"): End Function
Private Function NumberOrNull(ByVal value As Variant) As String: If IsNumeric(value) And Len(Trim$(CStr(value))) > 0 Then NumberOrNull = CStr(CLng(value)) Else NumberOrNull = "null"
End Function
