import * as XLSX from 'xlsx';
import type { BudgetItem } from './budgetTypes';

const HEADER_LITERAL = '세부사업/세부항목/원가통계비목';

// 에듀파인 사업관리카드 열 위치 (0-indexed). 실제 파일로 검증한 값이다.
const COL_NAME = 0;        // 비목명 (들여쓰기로 계층 표현)
const COL_DETAIL = 1;      // 산출내역
const COL_TOTAL = 2;       // 예산현액(A)
const COL_DRAFTED = 3;     // 지출품의금액
const COL_COMMITTED = 4;   // 원인행위금액(B)

export interface ParseResult {
  items: BudgetItem[];
  warnings: string[];
  headRows: unknown[][];
}

/** 공백 흔들림(이중 공백 등)을 흡수해 재업로드 시에도 같은 키가 나오게 한다. */
export const normalizeLabel = (value: unknown): string =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const makeItemId = (sub: string, category: string, account: string, detail: string): string =>
  [sub, category, account, detail].map(normalizeLabel).join('');

/** 원본 AdminSync.tsx의 숫자 파싱을 그대로 옮긴 것. 금액 처리라 변경하지 않는다. */
const parseNumber = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val.replace(/,/g, ''), 10) || 0;
  return 0;
};

interface RawNode {
  rowIndex: number;
  indent: number;
  name: string;
  detail: string;
  totalBudget: number;
  draftedAmount: number;
  committedAmount: number;
}

export function parseBudgetCard(buffer: ArrayBuffer): ParseResult {
  const warnings: string[] = [];
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  const nodes: RawNode[] = [];
  let sawTotalRow = false;

  rows.forEach((row, rowIndex) => {
    const nameRaw = row[COL_NAME];
    if (typeof nameRaw !== 'string') return;

    const name = nameRaw.trim();
    if (!name) return;
    if (name === HEADER_LITERAL) return;
    // '합 계' / '합  계' / '합계' 전부 대응 (원본은 '합 계' 리터럴에만 의존해 서식이 바뀌면 무너졌다)
    if (name.replace(/\s/g, '') === '합계') {
      sawTotalRow = true;
      return;
    }
    // 시트 제목 행 (들여쓰기 0, 최상단)
    if (rowIndex === 0) return;

    const detailRaw = row[COL_DETAIL];
    nodes.push({
      rowIndex,
      indent: nameRaw.search(/\S/),
      name,
      detail: typeof detailRaw === 'string' ? detailRaw.trim() : '',
      totalBudget: parseNumber(row[COL_TOTAL]),
      draftedAmount: parseNumber(row[COL_DRAFTED]),
      committedAmount: parseNumber(row[COL_COMMITTED]),
    });
  });

  if (!sawTotalRow) warnings.push("'합계' 행을 찾지 못했습니다. 에듀파인 양식이 맞는지 확인해주세요.");

  // 계층 판별: 들여쓰기 깊이를 모아 정렬하면 [세부사업, 세부항목, 비목] 순서가 된다.
  const levels = [...new Set(nodes.map((n) => n.indent))].sort((a, b) => a - b);
  if (levels.length < 3) {
    warnings.push(`들여쓰기 계층이 ${levels.length}단계뿐입니다. 세부사업 분류가 정확하지 않을 수 있습니다.`);
  }
  const subLevel = levels[0];
  const categoryLevel = levels[1];

  const items: BudgetItem[] = [];
  const seenIds = new Map<string, number>();
  let currentSub = '';
  let currentCategory = '';

  nodes.forEach((node, i) => {
    if (node.indent === subLevel) currentSub = node.name;
    if (node.indent === categoryLevel) currentCategory = node.name;

    // 다음 노드의 들여쓰기가 나보다 깊으면 나는 부모, 아니면 리프
    const next = nodes[i + 1];
    const isLeaf = !next || next.indent <= node.indent;
    if (!isLeaf || node.totalBudget <= 0) return;

    const baseId = makeItemId(currentSub, currentCategory, node.name, node.detail);
    const seen = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, seen + 1);
    if (seen > 0) {
      warnings.push(`중복된 항목 키가 있습니다: ${node.name} / ${node.detail}`);
    }

    items.push({
      id: seen > 0 ? `${baseId}#${seen + 1}` : baseId,
      subProjectName: currentSub,
      categoryName: currentCategory,
      accountName: node.name,
      detailName: node.detail,
      totalBudget: node.totalBudget,
      draftedAmount: node.draftedAmount,
      committedAmount: node.committedAmount,
      rowIndex: node.rowIndex,
    });
  });

  if (items.length === 0) {
    warnings.push('예산 항목을 하나도 읽지 못했습니다.');
  }

  return { items, warnings, headRows: rows.slice(0, 5) };
}
