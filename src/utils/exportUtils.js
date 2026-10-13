import * as XLSX from 'xlsx'

/**
 * Veri dizisini Excel (.xlsx) dosyası olarak dışa aktarır.
 * @param {Array<Object>} data 
 * @param {String} fileName 
 * @param {String} sheetName 
 */
export function exportToExcel(data, fileName = 'rapor', sheetName = 'Sayfa1') {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    return true
  } catch (error) {
    console.error('Excel export hatası:', error)
    return false
  }
}

/**
 * Veri dizisini CSV (.csv) dosyası olarak dışa aktarır.
 * @param {Array<Object>} data 
 * @param {String} fileName 
 */
export function exportToCSV(data, fileName = 'rapor') {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet)
    const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (error) {
    console.error('CSV export hatası:', error)
    return false
  }
}
