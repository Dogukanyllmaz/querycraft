'use strict';

const { createObjectCsvStringifier } = require('csv-writer');
const XLSX = require('xlsx');

function exportToCSV(rows) {
  if (!rows || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvStringifier = createObjectCsvStringifier({
    header: headers.map((h) => ({ id: h, title: h })),
  });

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
}

function exportToExcel(rows, sheetName = 'Report') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { exportToCSV, exportToExcel };
