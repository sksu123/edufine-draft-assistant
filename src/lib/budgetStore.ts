import { message } from 'antd';
import type { BudgetItem, BudgetSnapshot, DraftSource, PendingRecord } from './budgetTypes';
import { itemLabelOf } from './budgetTypes';

const CARD_KEY = 'budget_card_v1';
const PENDINGS_KEY = 'budget_pendings_v1';
const SELECTION_KEY = 'budget_selection_v1';
const SCHEMA_VERSION = 1;

/** 이 스토어가 쓰는 localStorage 키. 전체 삭제 기능이 참조하므로 키를 늘리면 여기에도 넣을 것. */
export const BUDGET_STORAGE_KEYS = [CARD_KEY, PENDINGS_KEY, SELECTION_KEY];

export interface BudgetState {
  card: BudgetSnapshot | null;
  pendings: PendingRecord[];
  selectedItemId: string | null;
}

/** 손상된 키가 앱 전체를 죽이지 않도록 절대 throw하지 않는다. */
const readKey = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { schemaVersion?: number };
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[budget] ${key}의 schemaVersion이 맞지 않아 무시합니다.`);
      return null;
    }
    return parsed as T;
  } catch (error) {
    console.warn(`[budget] ${key}를 읽지 못했습니다.`, error);
    return null;
  }
};

const writeKey = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[budget] ${key} 저장 실패`, error);
    message.error('브라우저 저장 공간이 부족해 예산 정보를 저장하지 못했습니다.');
  }
};

const hydrate = (): BudgetState => {
  const card = readKey<BudgetSnapshot>(CARD_KEY);
  const pendings = readKey<{ records: PendingRecord[] }>(PENDINGS_KEY);
  const selection = readKey<{ selectedItemId: string | null }>(SELECTION_KEY);
  return Object.freeze({
    card,
    pendings: pendings?.records ?? [],
    selectedItemId: selection?.selectedItemId ?? null,
  });
};

let state: BudgetState = hydrate();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const setState = (next: BudgetState) => {
  state = Object.freeze(next);
  notify();
};

const persistCard = (card: BudgetSnapshot | null) => {
  if (card) writeKey(CARD_KEY, card);
  else localStorage.removeItem(CARD_KEY);
};
const persistPendings = (records: PendingRecord[]) =>
  writeKey(PENDINGS_KEY, { schemaVersion: SCHEMA_VERSION, records });
const persistSelection = (selectedItemId: string | null) =>
  writeKey(SELECTION_KEY, { schemaVersion: SCHEMA_VERSION, selectedItemId });

// 다른 탭에서 바뀌면 따라간다 (자기 탭에서는 발생하지 않는 이벤트)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && ![CARD_KEY, PENDINGS_KEY, SELECTION_KEY].includes(event.key)) return;
    setState(hydrate());
  });
}

export const budgetStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  /** 참조가 안정적이어야 한다. 파생값을 여기서 만들면 무한 렌더가 난다. */
  getSnapshot(): BudgetState {
    return state;
  },

  /** 카드를 덮어쓴다. 차감 기록은 절대 건드리지 않는다. */
  commitCard(items: BudgetItem[], sourceFileName: string) {
    const card: BudgetSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      uploadedAt: new Date().toISOString(),
      sourceFileName,
      items,
    };
    const stillExists = state.selectedItemId !== null
      && items.some((item) => item.id === state.selectedItemId);
    const selectedItemId = stillExists ? state.selectedItemId : null;

    persistCard(card);
    persistSelection(selectedItemId);
    setState({ ...state, card, selectedItemId });
  },

  clearCard() {
    persistCard(null);
    persistSelection(null);
    setState({ ...state, card: null, selectedItemId: null });
  },

  selectItem(selectedItemId: string | null) {
    persistSelection(selectedItemId);
    setState({ ...state, selectedItemId });
  },

  addPending(input: { item: BudgetItem; amount: number; source: DraftSource; title: string }) {
    const record: PendingRecord = {
      id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId: input.item.id,
      itemLabel: itemLabelOf(input.item),
      subProjectLabel: input.item.subProjectName,
      amount: input.amount,
      source: input.source,
      title: input.title,
      createdAt: new Date().toISOString(),
    };
    const pendings = [record, ...state.pendings];
    persistPendings(pendings);
    setState({ ...state, pendings });
    return record;
  },

  removePending(recordId: string) {
    const pendings = state.pendings.filter((record) => record.id !== recordId);
    persistPendings(pendings);
    setState({ ...state, pendings });
  },

  relinkPending(recordId: string, item: BudgetItem) {
    const pendings = state.pendings.map((record) =>
      record.id === recordId
        ? { ...record, itemId: item.id, itemLabel: itemLabelOf(item), subProjectLabel: item.subProjectName }
        : record,
    );
    persistPendings(pendings);
    setState({ ...state, pendings });
  },

  clearPendings() {
    persistPendings([]);
    setState({ ...state, pendings: [] });
  },
};
