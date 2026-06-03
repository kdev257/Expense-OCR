import * as XLSX from 'xlsx';

/**
 * Exports invoice records to a styled Excel file.
 * @param {Array} records - List of processed invoice records
 * @param {string} filename - Output name for the excel sheet
 */
export function exportToExcel(records, filename = 'ocr_expenses_report.xlsx') {
  if (!records || records.length === 0) {
    throw new Error('No records available to export.');
  }

  // Format data for standard table view in Excel
  const formattedData = records.map((record, idx) => ({
    'Serial No.': idx + 1,
    'Supplier Name': record.supplier_name || 'N/A',
    'Bill Number': record.bill_number || 'N/A',
    'Bill Date': record.bill_date || 'N/A',
    'Amount (INR/USD)': record.amount !== '' ? Number(record.amount) : 0,
    'Expense Type': record.expense_type || 'Unclassified'
  }));

  // Create worksheet from JSON
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Define column widths for beautiful spreadsheet presentation
  const columnWidths = [
    { wch: 12 }, // Serial No.
    { wch: 30 }, // Supplier Name
    { wch: 20 }, // Bill Number
    { wch: 18 }, // Bill Date
    { wch: 18 }, // Amount
    { wch: 20 }  // Expense Type
  ];
  worksheet['!cols'] = columnWidths;

  // Create a new workbook and add the worksheet to it
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Summary');

  // Generate Excel file and trigger download
  XLSX.writeFile(workbook, filename);
}
