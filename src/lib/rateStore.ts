import { message } from 'antd';

export interface RateItem {
  id: string;
  category: string;
  base_rate: number;
  excess_rate: number;
}

const RATES_KEY = 'draft_rates_v1';
const MANUSCRIPT_RATES_KEY = 'draft_manuscript_rates_v1';
const SCHEMA_VERSION = 1;

export interface RateState {
  instructorRates: RateItem[];
  manuscriptRates: RateItem[];
}

const SEED_INSTRUCTOR_RATES: RateItem[] = [
  { id: '1', category: '특별강사 I', base_rate: 400000, excess_rate: 200000 },
  { id: '2', category: '특별강사 II', base_rate: 300000, excess_rate: 150000 },
  { id: '3', category: '일반강사 I', base_rate: 200000, excess_rate: 100000 },
  { id: '4', category: '일반강사 II', base_rate: 150000, excess_rate: 70000 },
  { id: '5', category: '일반강사 III (공직자 등)', base_rate: 120000, excess_rate: 0 },
];

const SEED_MANUSCRIPT_RATES: RateItem[] = [
  { id: '1', category: 'A4 1매 기준', base_rate: 15000, excess_rate: 0 },
  { id: '2', category: 'PPT 1매 기준', base_rate: 10000, excess_rate: 0 },
];

const readKey = <T,>(key: string, seed: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed?.rates)) {
      return seed;
    }
    return parsed.rates as T[];
  } catch {
    return seed;
  }
};

const writeKey = (key: string, rates: RateItem[]) => {
  try {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, rates }));
  } catch {
    message.error('저장 공간이 부족합니다.');
  }
};

const hydrate = (): RateState => Object.freeze({
  instructorRates: readKey<RateItem>(RATES_KEY, SEED_INSTRUCTOR_RATES),
  manuscriptRates: readKey<RateItem>(MANUSCRIPT_RATES_KEY, SEED_MANUSCRIPT_RATES),
});

let state: RateState = hydrate();
const listeners = new Set<() => void>();

const setState = (next: RateState) => {
  state = Object.freeze(next);
  listeners.forEach((listener) => listener());
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === RATES_KEY || event.key === MANUSCRIPT_RATES_KEY) {
      setState(hydrate());
    }
  });
}

export const rateStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  getSnapshot(): RateState {
    return state;
  },

  saveInstructorRates(rates: RateItem[]) {
    writeKey(RATES_KEY, rates);
    setState({ ...state, instructorRates: rates });
  },

  saveManuscriptRates(rates: RateItem[]) {
    writeKey(MANUSCRIPT_RATES_KEY, rates);
    setState({ ...state, manuscriptRates: rates });
  },

  reset() {
    this.saveInstructorRates(SEED_INSTRUCTOR_RATES);
    this.saveManuscriptRates(SEED_MANUSCRIPT_RATES);
    message.success('단가가 기본값으로 복원되었습니다.');
  }
};
