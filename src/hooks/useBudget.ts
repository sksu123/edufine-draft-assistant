import { useMemo, useSyncExternalStore } from 'react';
import { budgetStore } from '../lib/budgetStore';
import type { BudgetItem, BudgetItemView, PendingRecord } from '../lib/budgetTypes';

const EMPTY_ITEMS: BudgetItem[] = [];

export interface UseBudget {
  hasCard: boolean;
  uploadedAt?: string;
  sourceFileName?: string;
  items: BudgetItem[];
  itemViews: BudgetItemView[];
  pendings: PendingRecord[];
  orphanPendings: PendingRecord[];
  selectedItem: BudgetItemView | null;
  availableBalance: number;
}

export function useBudget(): UseBudget {
  const state = useSyncExternalStore(budgetStore.subscribe, budgetStore.getSnapshot);

  const items = state.card?.items ?? EMPTY_ITEMS;

  const pendingByItem = useMemo(() => {
    const totals = new Map<string, number>();
    state.pendings.forEach((record) => {
      totals.set(record.itemId, (totals.get(record.itemId) ?? 0) + record.amount);
    });
    return totals;
  }, [state.pendings]);

  const itemViews = useMemo<BudgetItemView[]>(() => items.map((item) => {
    const pendingAmount = pendingByItem.get(item.id) ?? 0;
    return {
      ...item,
      pendingAmount,
      // 가용잔액 = 예산현액 − 원인행위금액 − 로컬 품의 대기액
      availableBalance: item.totalBudget - item.committedAmount - pendingAmount,
    };
  }), [items, pendingByItem]);

  const orphanPendings = useMemo(() => {
    if (!state.card) return state.pendings;
    const ids = new Set(items.map((item) => item.id));
    return state.pendings.filter((record) => !ids.has(record.itemId));
  }, [state.card, state.pendings, items]);

  const selectedItem = useMemo(
    () => itemViews.find((item) => item.id === state.selectedItemId) ?? null,
    [itemViews, state.selectedItemId],
  );

  return {
    hasCard: Boolean(state.card),
    uploadedAt: state.card?.uploadedAt,
    sourceFileName: state.card?.sourceFileName,
    items,
    itemViews,
    pendings: state.pendings,
    orphanPendings,
    selectedItem,
    availableBalance: selectedItem?.availableBalance ?? 0,
  };
}
