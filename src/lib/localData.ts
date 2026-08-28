import { BUDGET_STORAGE_KEYS } from './budgetStore';
import { TEMPLATE_STORAGE_KEYS } from './templateStore';

/** 설정 창에서 저장하는 값들 */
export const SETTINGS_STORAGE_KEYS = ['school_name', 'gemini_api_key'];

/**
 * 이 앱이 브라우저에 남기는 모든 키.
 * 각 스토어가 자기 키를 내보내므로, 스토어에 키를 추가해도 여기서 누락되지 않는다.
 */
export const ALL_LOCAL_DATA_KEYS = [
  ...SETTINGS_STORAGE_KEYS,
  ...BUDGET_STORAGE_KEYS,
  ...TEMPLATE_STORAGE_KEYS,
];

/**
 * 브라우저에 저장된 앱 데이터를 전부 지운다.
 *
 * 스토어들이 모듈 싱글턴이라 키만 지워서는 이미 메모리에 올라온 상태와
 * 각 페이지의 React state가 그대로 남는다. 그래서 지운 뒤 반드시 새로고침해야
 * 진짜 초기 상태가 된다. 호출부에서 location.reload()를 부를 것.
 */
export function clearAllLocalData() {
  ALL_LOCAL_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
}
