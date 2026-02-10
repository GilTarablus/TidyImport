import ExcelJS from 'exceljs';
import { sanitizeForExport, formatPhoneNumber } from './cleaningEngine';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
}

export type ExportFormat = 'xlsx' | 'csv';

export async function parseFile(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  
  // Determine file type and read accordingly
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.csv')) {
    // For CSV files, read as text and parse
    const text = new TextDecoder().decode(arrayBuffer);
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return { headers: [], rows: [], fileName: file.name };
    }
    
    // Parse CSV manually
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return { headers, rows, fileName: file.name };
  } else {
    // For Excel files
    await workbook.xlsx.load(arrayBuffer);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in file');
    }
    
    const rows: Record<string, any>[] = [];
    let headers: string[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      // ExcelJS row.values is 1-indexed, first element is undefined
      const cellValues = values.slice(1);
      
      if (rowNumber === 1) {
        // First row is headers
        headers = cellValues.map(v => getCellValue(v));
      } else {
        // Data rows
        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = getCellValue(cellValues[index]);
        });
        rows.push(rowData);
      }
    });
    
    return { headers, rows, fileName: file.name };
  }
}

// Helper to extract cell value from ExcelJS cell
function getCellValue(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    // Handle rich text, formulas, etc.
    if (cell.text) return String(cell.text);
    if (cell.result) return String(cell.result);
    if (cell.richText) return cell.richText.map((r: any) => r.text).join('');
    return '';
  }
  return String(cell);
}

// Sanitize data for export (prevent CSV injection)
function sanitizeData(
  data: Record<string, string>[], 
  headers: string[]
): Record<string, string>[] {
  return data.map(row => {
    const sanitizedRow: Record<string, string> = {};
    headers.forEach(header => {
      let value = row[header] || '';
      
      // Apply phone formatting if this is the Phone column
      if (header === 'Phone' && value) {
        value = formatPhoneNumber(value);
      }
      
      // Sanitize to prevent CSV injection
      sanitizedRow[header] = sanitizeForExport(value);
    });
    return sanitizedRow;
  });
}

export async function generateExcel(
  data: Record<string, string>[], 
  headers: string[]
): Promise<Blob> {
  // Sanitize data before export
  const sanitizedData = sanitizeData(data, headers);
  
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cleaned Data');
  
  // Add headers
  worksheet.columns = headers.map(header => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 15),
  }));
  
  // Add data rows
  sanitizedData.forEach(row => {
    worksheet.addRow(row);
  });
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  
  // Generate the Excel file as a blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function generateCSV(
  data: Record<string, string>[], 
  headers: string[]
): Promise<Blob> {
  // Sanitize data before export
  const sanitizedData = sanitizeData(data, headers);
  
  // Create CSV manually to ensure proper formatting
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = sanitizedData.map(row => 
    headers.map(header => escapeCSV(row[header] || '')).join(',')
  );
  
  const csvString = [headerLine, ...dataLines].join('\n');
  
  return new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
}
