export type DraftSource = 'SIMPLE' | 'CONTRACT' | 'INSTRUCTOR';

export const SOURCE_LABEL: Record<DraftSource, string> = {
  SIMPLE: '단순물품',
  CONTRACT: '견적계약',
  INSTRUCTOR: '강사비',
};

/** 사업관리카드에서 파싱한 예산 항목 (원가통계비목 리프) */
export interface BudgetItem {
  id: string;               // 내용 기반 결정적 키 (재업로드해도 동일)
  subProjectName: string;   // 세부사업
  categoryName: string;     // 세부항목
  accountName: string;      // 원가통계비목
  detailName: string;       // 산출내역
  totalBudget: number;      // 예산현액(A)
  draftedAmount: number;    // 지출품의금액 — 표시 전용, 잔액 공식에 미포함
  committedAmount: number;  // 원인행위금액(B)
  rowIndex: number;         // 원본 시트 행 번호
}

/** 앱에서 초안을 확정할 때 남기는 로컬 차감 기록 */
export interface PendingRecord {
  id: string;
  itemId: string;           // → BudgetItem.id
  itemLabel: string;        // 스냅샷. 항목이 사라져도 읽을 수 있도록
  subProjectLabel: string;
  amount: number;
  source: DraftSource;
  title: string;
  createdAt: string;
}

export interface BudgetSnapshot {
  schemaVersion: 1;
  uploadedAt: string;
  sourceFileName: string;
  items: BudgetItem[];
}

/** BudgetItem + 로컬에서 파생한 값. 저장하지 않는다. */
export interface BudgetItemView extends BudgetItem {
  pendingAmount: number;
  availableBalance: number;
}

export const itemLabelOf = (item: BudgetItem) =>
  item.detailName ? `${item.accountName} › ${item.detailName}` : item.accountName;
