import * as XLSX from 'xlsx';
import { BookData } from '../types';

export const exportBookToExcel = (book: BookData) => {
  // Map pages to rows with specific column order
  const rows = book.pages.map((page) => ({
    "Número da Página": page.pageNumber,
    "Capítulo": page.chapterTitle || "Geral",
    "Conteúdo (Markdown)": page.content
  }));

  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Create a worksheet
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths for better readability
  const wscols = [
    { wch: 15 }, // Col A: Page Number
    { wch: 40 }, // Col B: Chapter
    { wch: 100 }, // Col C: Content
  ];
  ws['!cols'] = wscols;

  // Append sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Conteúdo do Livro");

  // Generate file name
  const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `${safeTitle}_export.xlsx`;

  // Write file
  XLSX.writeFile(wb, fileName);
};