import * as XLSX from 'xlsx';
import { message } from 'antd';

// K-에듀파인 '품목내역 양식.xlsx' 규격. 열 구성은 고정이므로 바꾸지 말 것.
const EXCEL_HEADER = ['내용', '규격', '단위', '수량', '예상단가'];
const COLUMN_WIDTHS = [
  { wch: 40 }, // 내용
  { wch: 15 }, // 규격
  { wch: 8 },  // 단위
  { wch: 8 },  // 수량
  { wch: 15 }, // 예상단가
];
const DEFAULT_FILE_NAME = '품목내역(통합).xls';

export interface ExcelItemRow {
  item_name: string;
  specification?: string;
  quantity: number;
  unit_price: number;
}

export function exportItemsToExcel(rows: ExcelItemRow[], fileName: string = DEFAULT_FILE_NAME) {
  const excelData: (string | number)[][] = [EXCEL_HEADER];

  rows.forEach((row) => {
    excelData.push([
      row.item_name,              // 내용
      row.specification || '',    // 규격
      '선택',                      // 단위
      row.quantity,               // 수량
      row.unit_price,             // 예상단가
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);
  worksheet['!cols'] = COLUMN_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '품목내역');
  XLSX.writeFile(workbook, fileName);
  message.success('엑셀 파일이 다운로드 되었습니다.');
}
