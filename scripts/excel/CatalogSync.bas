Attribute VB_Name = "CatalogSync"
Option Explicit

Private Const MAX_LINES As Long = 5000

Public Sub ActualizarCatalogo()
    Dim text As String, lines() As String, section As String, i As Long, eventsEnabled As Boolean
    eventsEnabled = Application.EnableEvents
    On Error GoTo Failed
    Application.EnableEvents = False
    DesprotegerPlanillas
    CrearBackupPrecios
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
    OrdenarProductosPorMarca
    AjustarFormatoPrecios
    Application.EnableEvents = eventsEnabled
    Exit Sub
Failed:
    Application.EnableEvents = eventsEnabled
    Err.Raise Err.Number, Err.Source, Err.Description
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
                If IsNumeric(source.Cells(row, 1).Value) Then
                    target.Cells(outRow, 2).Value = CLng(source.Cells(row, 1).Value)
                Else
                    target.Cells(outRow, 2).Value = CStr(source.Cells(row, 1).Value)
                End If
                target.Cells(outRow, 3).Value = DisplayProductText(displayText, brand)
                target.Cells(outRow, 4).Value = source.Cells(row, 7).Value
                target.Cells(outRow, 5).Value = source.Cells(row, 8).Value
                outRow = outRow + 1
            End If
        Next row
    Next brandKey
    If outRow <= targetLast Then target.Range(target.Cells(outRow, 1), target.Cells(targetLast, 5)).ClearContents
End Sub

Public Sub OrdenarProductosPorMarca()
    Dim sh As Object, row As Long, last As Long, productStart As Long, productEnd As Long
    Set sh = ThisWorkbook.Worksheets("PRECIOS")
    last = sh.Cells(sh.Rows.Count, 3).End(-4162).Row
    If last < 5 Then Exit Sub

    row = 4
    Do While row <= last
        If Len(Trim$(CStr(sh.Cells(row, 1).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 Then
            productStart = row + 1
            productEnd = productStart
            Do While productEnd <= last _
                And Len(Trim$(CStr(sh.Cells(productEnd, 1).Value))) > 0 _
                And Len(Trim$(CStr(sh.Cells(productEnd, 3).Value))) > 0
                productEnd = productEnd + 1
            Loop
            productEnd = productEnd - 1

            If productEnd >= productStart Then
                sh.Range("A" & productStart & ":E" & productEnd).Sort _
                    Key1:=sh.Range("C" & productStart), Order1:=1, Header:=2, Orientation:=1
            End If
            row = productEnd + 1
        Else
            row = row + 1
        End If
    Loop
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
    For j = 0 To UBound(values)
        If section = "[PRODUCTS]" And j = 0 And IsNumeric(values(j)) Then
            target.Cells(row, j + 1).Value = CLng(values(j))
        Else
            target.Cells(row, j + 1).Value = values(j)
        End If
    Next j
End Sub

Public Sub SincronizarCambios()
    Dim payload As String, response As String
    DesprotegerPlanillas
    CrearBackupPrecios
    ValidarIdsPrecios
    ActualizarProductosDesdePrecios
    payload = "{""workbookId"":""" & Json(CStr(ThisWorkbook.Name)) & """,""products"":["
    payload = payload & ProductsJson() & "],""newProducts"":[" & NewProductsJson() & "],""brands"":[" & BrandsJson() & "],""categories"":[" & CategoriesJson() & "]}"
    response = HttpPost(CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B1").Value), CStr(ThisWorkbook.Worksheets("CONFIGURACION").Range("B2").Value), payload)
    AsignarIdsNuevos response
    ActualizarCatalogo
    MsgBox "Cambios sincronizados correctamente.", vbInformation, "PintoFruta"
End Sub

Public Sub ImportarPedidoCliente()
    Dim importSheet As Object, products As Object, prices As Object, found As Object, priceCell As Object
    Dim headerRow As Long, lastRow As Long, row As Long
    Dim brandCol As Long, detailCol As Long, priceCol As Long, idCol As Long
    Dim brand As String, detail As String, status As String
    Dim price As Variant, matched As Long, notFound As Long, ambiguous As Long

    DesprotegerPlanillas
    Set importSheet = ThisWorkbook.Worksheets("IMPORTAR PEDIDO")
    Set products = ThisWorkbook.Worksheets("PRODUCTOS")
    Set prices = ThisWorkbook.Worksheets("PRECIOS")
    headerRow = FindImportHeaderRow(importSheet)
    If headerRow = 0 Then Err.Raise vbObjectError + 710, , "No se encontro una fila con los encabezados CANTIDAD, MARCA, DETALLE / VARIEDAD y PRECIO."

    brandCol = FindImportHeaderColumn(importSheet, headerRow, "MARCA")
    detailCol = FindImportHeaderColumn(importSheet, headerRow, "DETALLE")
    priceCol = FindImportHeaderColumn(importSheet, headerRow, "PRECIO")
    idCol = FindImportHeaderColumn(importSheet, headerRow, "ID")
    If detailCol = 0 Or priceCol = 0 Then Err.Raise vbObjectError + 711, , "Faltan las columnas DETALLE / VARIEDAD o PRECIO."

    importSheet.Cells(headerRow, 7).Value = "ID EN SITIO"
    importSheet.Cells(headerRow, 8).Value = "RESULTADO"
    importSheet.Cells(headerRow, 9).Value = "DETALLE EN SITIO"
    importSheet.Range(importSheet.Cells(headerRow + 1, 7), importSheet.Cells(importSheet.Rows.Count, 9)).ClearContents
    lastRow = importSheet.Cells(importSheet.Rows.Count, detailCol).End(-4162).Row

    For row = headerRow + 1 To lastRow
        detail = Trim$(CStr(importSheet.Cells(row, detailCol).Value))
        brand = ""
        If brandCol > 0 Then brand = Trim$(CStr(importSheet.Cells(row, brandCol).Value))
        If Len(detail) > 0 And NormalizeMatch(detail) <> "detallevariedad" Then
            Set found = Nothing
            status = "NO ENCONTRADO"
            If idCol > 0 And Len(Trim$(CStr(importSheet.Cells(row, idCol).Value))) > 0 Then
                Set found = products.Columns(1).Find(What:=importSheet.Cells(row, idCol).Value, LookIn:=-4163, LookAt:=1)
                If Not found Is Nothing Then status = "MATCH POR ID"
            End If
            If found Is Nothing Then Set found = FindImportedProduct(products, brand, detail, status)

            If Not found Is Nothing Then
                price = importSheet.Cells(row, priceCol).Value
                If IsNumeric(price) Then
                    products.Cells(found.Row, 7).Value = price
                    Set priceCell = prices.Columns(2).Find(What:=products.Cells(found.Row, 1).Value, LookIn:=-4163, LookAt:=1)
                    If Not priceCell Is Nothing Then prices.Cells(priceCell.Row, 4).Value = price
                End If
                importSheet.Cells(row, 7).Value = products.Cells(found.Row, 1).Value
                importSheet.Cells(row, 8).Value = status
                importSheet.Cells(row, 9).Value = products.Cells(found.Row, 3).Value
                matched = matched + 1
            Else
                importSheet.Cells(row, 8).Value = status
                notFound = notFound + 1
                If status = "AMBIGUO" Then ambiguous = ambiguous + 1
            End If
        End If
    Next row

    importSheet.Columns("G:I").AutoFit
    importSheet.Cells(1, 11).Value = "ULTIMA IMPORTACION"
    importSheet.Cells(2, 11).Value = "Coincidencias: " & matched & " | No actualizados: " & notFound & IIf(ambiguous > 0, " | Ambiguos: " & ambiguous, "")
    If Application.Visible Then MsgBox "Importacion finalizada." & vbCrLf & "Coincidencias: " & matched & vbCrLf & "No actualizados: " & notFound & IIf(ambiguous > 0, vbCrLf & "Ambiguos: " & ambiguous, ""), vbInformation, "PintoFruta"
End Sub

Private Function FindImportHeaderRow(ByVal sh As Object) As Long
    Dim row As Long, lastColumn As Long
    For row = 1 To 50
        lastColumn = sh.Cells(row, sh.Columns.Count).End(-4159).Column
        If FindImportHeaderColumn(sh, row, "DETALLE") > 0 And FindImportHeaderColumn(sh, row, "PRECIO") > 0 Then
            FindImportHeaderRow = row
            Exit Function
        End If
    Next row
    FindImportHeaderRow = 0
End Function

Private Function FindImportHeaderColumn(ByVal sh As Object, ByVal headerRow As Long, ByVal headerText As String) As Long
    Dim column As Long, lastColumn As Long, value As String
    lastColumn = sh.Cells(headerRow, sh.Columns.Count).End(-4159).Column
    For column = 1 To lastColumn
        value = NormalizeMatch(CStr(sh.Cells(headerRow, column).Value))
        If InStr(1, value, NormalizeMatch(headerText), vbBinaryCompare) > 0 Then
            FindImportHeaderColumn = column
            Exit Function
        End If
    Next column
    FindImportHeaderColumn = 0
End Function

Private Function FindImportedProduct(ByVal source As Object, ByVal importBrand As String, ByVal importDetail As String, ByRef result As String) As Object
    Dim row As Long, last As Long, brand As String, candidate As String, importText As String
    Dim score As Long, bestScore As Long, secondScore As Long, bestRow As Long
    importText = NormalizeMatch(DisplayProductText(importDetail, importBrand))
    last = source.Cells(source.Rows.Count, 1).End(-4162).Row
    For row = 2 To last
        brand = CStr(source.Cells(row, 6).Value)
        candidate = NormalizeMatch(DisplayProductText(CStr(source.Cells(row, 3).Value), brand))
        score = MatchScore(importBrand, importText, brand, candidate, CStr(source.Cells(row, 3).Value), CStr(source.Cells(row, 4).Value))
        If score > bestScore Then
            secondScore = bestScore
            bestScore = score
            bestRow = row
        ElseIf score > secondScore Then
            secondScore = score
        End If
    Next row
    If bestScore >= 80 And bestScore - secondScore >= 12 Then
        result = "MATCH NORMALIZADO"
        Set FindImportedProduct = source.Cells(bestRow, 1)
    ElseIf bestScore >= 80 Then
        result = "AMBIGUO"
        Set FindImportedProduct = Nothing
    Else
        result = "NO ENCONTRADO"
        Set FindImportedProduct = Nothing
    End If
End Function

Private Function MatchScore(ByVal importBrand As String, ByVal importText As String, ByVal siteBrand As String, ByVal siteText As String, ByVal fullName As String, ByVal siteDetail As String) As Long
    Dim score As Long, token As Variant, tokens() As String, sourceText As String, importBrandKey As String, siteBrandKey As String
    importBrandKey = NormalizeMatch(importBrand): siteBrandKey = NormalizeMatch(siteBrand)
    If Len(importBrandKey) > 0 And Len(siteBrandKey) > 0 Then
        If InStr(1, importBrandKey, siteBrandKey, vbBinaryCompare) = 0 And InStr(1, siteBrandKey, importBrandKey, vbBinaryCompare) = 0 Then Exit Function
        If importBrandKey = siteBrandKey Then score = score + 100 Else score = score + 60
    End If
    If importText = siteText Then MatchScore = score + 1000: Exit Function
    If Len(importText) > 0 And (InStr(1, siteText, importText, vbBinaryCompare) > 0 Or InStr(1, importText, siteText, vbBinaryCompare) > 0) Then score = score + 500
    sourceText = NormalizeMatch(fullName & " " & siteDetail)
    If Len(importText) > 0 And InStr(1, sourceText, importText, vbBinaryCompare) > 0 Then score = score + 350
    tokens = Split(importText, " ")
    For Each token In tokens
        If Len(CStr(token)) >= 4 And InStr(1, siteText, CStr(token), vbBinaryCompare) > 0 Then score = score + 8
    Next token
    MatchScore = score
End Function

Public Sub ValidarIdsPrecios()
    Dim sh As Object, seen As Object, row As Long, last As Long, productId As String, eventsEnabled As Boolean
    eventsEnabled = Application.EnableEvents
    Application.EnableEvents = False
    Set sh = ThisWorkbook.Worksheets("PRECIOS")
    Set seen = CreateObject("Scripting.Dictionary")
    last = sh.Cells(sh.Rows.Count, 3).End(-4162).Row
    For row = 4 To last
        If Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 And Len(Trim$(CStr(sh.Cells(row, 1).Value))) = 0 Then
            sh.Cells(row, 2).ClearContents
        ElseIf Len(Trim$(CStr(sh.Cells(row, 1).Value))) > 0 Then
            productId = Trim$(CStr(sh.Cells(row, 2).Value))
            If Len(productId) > 0 Then
                If seen.Exists(productId) Then
                    sh.Cells(row, 2).ClearContents
                    sh.Cells(row, 2).Interior.Color = RGB(255, 220, 180)
                Else
                    seen.Add productId, True
                End If
            End If
        End If
    Next row
    Application.EnableEvents = eventsEnabled
End Sub

Private Sub CrearBackupPrecios()
    Dim source As Object, backup As Object, last As Long, row As Long, outRow As Long
    On Error Resume Next
    Set backup = ThisWorkbook.Worksheets("BACKUP_PRECIOS")
    On Error GoTo 0
    If backup Is Nothing Then
        Set backup = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        backup.Name = "BACKUP_PRECIOS"
    End If
    Set source = ThisWorkbook.Worksheets("PRECIOS")
    backup.Cells.ClearContents
    backup.Range("A1:G1").Value = Array("FECHA", "ACTIVO", "ID", "DETALLE / VARIEDAD", "PUBLICO", "DESCUENTO", "FILA ORIGEN")
    last = source.Cells(source.Rows.Count, 3).End(-4162).Row
    outRow = 2
    For row = 3 To last
        If Len(Trim$(CStr(source.Cells(row, 3).Value))) > 0 Then
            backup.Cells(outRow, 1).Value = Now
            backup.Cells(outRow, 2).Value = source.Cells(row, 1).Value
            backup.Cells(outRow, 3).Value = source.Cells(row, 2).Value
            backup.Cells(outRow, 4).Value = source.Cells(row, 3).Value
            backup.Cells(outRow, 5).Value = source.Cells(row, 4).Value
            backup.Cells(outRow, 6).Value = source.Cells(row, 5).Value
            backup.Cells(outRow, 7).Value = row
            outRow = outRow + 1
        End If
    Next row
End Sub

Private Function NewProductsJson() As String
    Dim sh As Object, row As Long, last As Long, brand As String, s As String, q As String, item As String
    q = Chr$(34)
    Set sh = ThisWorkbook.Worksheets("PRECIOS")
    last = sh.Cells(sh.Rows.Count, 3).End(-4162).Row
    For row = 4 To last
        If Len(Trim$(CStr(sh.Cells(row, 1).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 2).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 Then
            brand = Trim$(CStr(sh.Cells(row, 3).Value))
        ElseIf Len(Trim$(CStr(sh.Cells(row, 1).Value))) > 0 And Len(Trim$(CStr(sh.Cells(row, 2).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 And Len(brand) > 0 Then
            If Len(s) > 0 Then s = s & ","
            item = "{" & q & "name" & q & ":" & q & Json(sh.Cells(row, 3).Value) & q
            item = item & "," & q & "detail" & q & ":" & q & Json(sh.Cells(row, 3).Value) & q
            item = item & "," & q & "brand" & q & ":" & q & Json(brand) & q
            item = item & "," & q & "publicPrice" & q & ":" & MoneyOrNull(sh.Cells(row, 4).Value)
            item = item & "," & q & "memberPrice" & q & ":" & MoneyOrNull(sh.Cells(row, 5).Value)
            item = item & "," & q & "status" & q & ":" & q & IIf(UCase$(Trim$(CStr(sh.Cells(row, 1).Value))) = "NO", "inactive", "published") & q & "}"
            s = s & item
        End If
    Next row
    NewProductsJson = s
End Function

Private Sub AsignarIdsNuevos(ByVal response As String)
    Dim sh As Object, marker As String, startAt As Long, endAt As Long, raw As String
    Dim ids() As String, row As Long, last As Long, index As Long, brand As String, value As String
    marker = """createdProductIds"":["
    startAt = InStr(1, response, marker, vbBinaryCompare)
    If startAt = 0 Then Exit Sub
    startAt = startAt + Len(marker)
    endAt = InStr(startAt, response, "]", vbBinaryCompare)
    If endAt = 0 Then Exit Sub
    raw = Mid$(response, startAt, endAt - startAt)
    If Len(Trim$(raw)) = 0 Then Exit Sub
    ids = Split(raw, ",")
    Set sh = ThisWorkbook.Worksheets("PRECIOS")
    last = sh.Cells(sh.Rows.Count, 3).End(-4162).Row
    index = 0
    For row = 4 To last
        If Len(Trim$(CStr(sh.Cells(row, 1).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 2).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 Then
            brand = Trim$(CStr(sh.Cells(row, 3).Value))
        ElseIf Len(Trim$(CStr(sh.Cells(row, 1).Value))) > 0 And Len(Trim$(CStr(sh.Cells(row, 2).Value))) = 0 And Len(Trim$(CStr(sh.Cells(row, 3).Value))) > 0 And Len(brand) > 0 Then
            If index <= UBound(ids) Then
                value = Trim$(ids(index))
                If IsNumeric(value) Then sh.Cells(row, 2).Value = CLng(value)
                index = index + 1
            End If
        End If
    Next row
End Sub

Private Sub ActualizarProductosDesdePrecios()
    Dim source As Object, target As Object, found As Object
    Dim row As Long, last As Long, productName As String
    Set source = ThisWorkbook.Worksheets("PRODUCTOS")
    Set target = ThisWorkbook.Worksheets("PRECIOS")
    last = target.Cells(target.Rows.Count, 3).End(-4162).Row
    For row = 2 To last
        productName = Trim$(CStr(target.Cells(row, 3).Value))
        If Len(productName) > 0 And Len(Trim$(CStr(target.Cells(row, 2).Value))) > 0 Then
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
    text = Replace(text, ChrW(&HE1), "a"): text = Replace(text, ChrW(&HE9), "e"): text = Replace(text, ChrW(&HED), "i")
    text = Replace(text, ChrW(&HF3), "o"): text = Replace(text, ChrW(&HFA), "u"): text = Replace(text, ChrW(&HF1), "n")
    text = Replace(text, ChrW(&HC1), "a"): text = Replace(text, ChrW(&HC9), "e"): text = Replace(text, ChrW(&HCD), "i")
    text = Replace(text, ChrW(&HD3), "o"): text = Replace(text, ChrW(&HDA), "u"): text = Replace(text, ChrW(&HD1), "n")
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
    names = Array("PRECIOS", "PRODUCTOS", "MARCAS", "CATEGORIAS", "CONFIGURACION", "BACKUP_PRECIOS")
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
            item = item & "," & q & "publicPrice" & q & ":" & MoneyOrNull(sh.Cells(r, 7).Value)
            item = item & "," & q & "memberPrice" & q & ":" & MoneyOrNull(sh.Cells(r, 8).Value)
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
Private Function MoneyOrNull(ByVal value As Variant) As String
    Dim formatted As String
    If IsNumeric(value) And Len(Trim$(CStr(value))) > 0 Then
        formatted = Format$(CDbl(value), "0.00")
        formatted = Replace(formatted, Application.DecimalSeparator, ".")
        MoneyOrNull = formatted
    Else
        MoneyOrNull = "null"
    End If
End Function
