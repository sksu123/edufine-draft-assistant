import { useCallback, useRef } from 'react';
import { Modal } from 'antd';
import { useBudget } from './useBudget';

export const buildSignature = (payload: unknown): string => JSON.stringify(payload);

export interface DraftGuard {
  /** 통과하면 true. 중복 기안이면 차단, 예산 초과면 확인 후 진행(소프트 블록). */
  check: (signature: string, plannedAmount: number) => Promise<boolean>;
  markSubmitted: (signature: string) => void;
}

/**
 * 초안 확정 직전에 거치는 두 가지 검사.
 * - 중복 기안 방지: 직전에 확정한 것과 내용이 완전히 같으면 차단
 * - 예산 초과: 선택한 항목의 가용 잔액을 넘으면 경고 후 사용자 판단에 맡김
 */
export function useDraftGuard(): DraftGuard {
  const { selectedItem, availableBalance } = useBudget();
  const lastSignature = useRef<string | null>(null);

  const check = useCallback((signature: string, plannedAmount: number): Promise<boolean> => {
    if (lastSignature.current === signature) {
      Modal.warning({
        title: '중복 기안 경고',
        content: '방금 전 확정한 기안과 완벽하게 동일한 데이터입니다. 중복 상신을 방지하기 위해 차단되었습니다. 새로운 물품을 기안하시려면 내용을 변경해주세요.',
        okText: '확인',
      });
      return Promise.resolve(false);
    }

    // 예산 항목을 고르지 않았으면 예산 검사를 건너뛴다 (카드 없이도 앱은 온전히 쓸 수 있어야 한다)
    if (!selectedItem || plannedAmount <= availableBalance) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '가용 예산 초과 경고',
        content: `지출 예정 총액 ${plannedAmount.toLocaleString()}원이 가용 잔액 ${availableBalance.toLocaleString()}원을 초과합니다. 그래도 기안을 진행하시겠습니까?`,
        okText: '예, 진행합니다',
        okType: 'danger',
        cancelText: '취소',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [selectedItem, availableBalance]);

  const markSubmitted = useCallback((signature: string) => {
    lastSignature.current = signature;
  }, []);

  return { check, markSubmitted };
}
