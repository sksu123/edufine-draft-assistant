import { message } from 'antd';
import type {
  DraftTemplate, DraftTemplateInput, SchoolClass,
} from './templateTypes';

const TEMPLATES_KEY = 'draft_templates_v1';
const CLASSES_KEY = 'draft_school_classes_v1';
const SCHEMA_VERSION = 1;

export const TEMPLATE_STORAGE_KEYS = [TEMPLATES_KEY, CLASSES_KEY];
const ALL_KEYS = TEMPLATE_STORAGE_KEYS;

export interface TemplateState {
  templates: DraftTemplate[];
  classes: SchoolClass[];
}

export type SeedScope = 'templates' | 'classes';

const readKey = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { schemaVersion?: number };
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }
    return parsed as T;
  } catch (error) {
    return null;
  }
};

const writeKey = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    message.error('브라우저 저장 공간이 부족해 템플릿을 저장하지 못했습니다.');
  }
};

const SEED_TEMPLATES: DraftTemplate[] = [
  {
    id: 'tpl_seed_1', name: '일반 행사 기안', event_name: '',
    start_text: '다음과 같이 행사를 진행하고자 합니다.',
    purpose: '학생들의 창의력 증진 및 화합 도모',
    location: '', 
    relatedDocs: [], attachments: [], targetGrades: [], targetClasses: {},
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_seed_2', name: '일반 물품 구입', event_name: '',
    start_text: '다음과 같이 물품을 구입하고자 합니다.',
    purpose: '원활한 교육활동 지원',
    location: '', 
    relatedDocs: [], attachments: [], targetGrades: [], targetClasses: {},
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_seed_3', name: '강사 초빙', event_name: '',
    start_text: '다음과 같이 강사를 초빙하여 특강을 진행하고자 합니다.',
    purpose: '학생 진로 탐색 및 전문지식 함양',
    location: '', 
    relatedDocs: [], attachments: [], targetGrades: [], targetClasses: {},
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
];

const SEED_CLASSES: SchoolClass[] = [
  { grade: 0, classCount: 0, customNames: ['햇살', '달빛', '별빛'] }, // 유치원
  { grade: 1, classCount: 10 },
  { grade: 2, classCount: 10 },
  { grade: 3, classCount: 10 },
];

const hydrateCollection = <T,>(key: string, field: string, seed: T[]): T[] => {
  const stored = readKey<Record<string, T[]>>(key);
  if (stored && Array.isArray(stored[field])) return stored[field];
  writeKey(key, { schemaVersion: SCHEMA_VERSION, [field]: seed });
  return seed;
};

const sortClasses = (classes: SchoolClass[]) => [...classes].sort((a, b) => a.grade - b.grade);

const hydrate = (): TemplateState => Object.freeze({
  templates: hydrateCollection(TEMPLATES_KEY, 'templates', SEED_TEMPLATES),
  classes: sortClasses(hydrateCollection(CLASSES_KEY, 'classes', SEED_CLASSES)),
});

let state: TemplateState = hydrate();
const listeners = new Set<() => void>();

const setState = (next: TemplateState) => {
  state = Object.freeze(next);
  listeners.forEach((listener) => listener());
};

const persistTemplates = (templates: DraftTemplate[]) =>
  writeKey(TEMPLATES_KEY, { schemaVersion: SCHEMA_VERSION, templates });
const persistClasses = (classes: SchoolClass[]) =>
  writeKey(CLASSES_KEY, { schemaVersion: SCHEMA_VERSION, classes });

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && !ALL_KEYS.includes(event.key)) return;
    setState(hydrate());
  });
}

export const templateStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  getSnapshot(): TemplateState {
    return state;
  },

  saveTemplate(input: DraftTemplateInput): DraftTemplate {
    const saved: DraftTemplate = {
      ...input,
      id: input.id ?? makeId('tpl'),
      updatedAt: new Date().toISOString(),
    };
    const exists = state.templates.some((t) => t.id === saved.id);
    const templates = exists
      ? state.templates.map((t) => (t.id === saved.id ? saved : t))
      : [...state.templates, saved];

    persistTemplates(templates);
    setState({ ...state, templates });
    return saved;
  },

  removeTemplate(id: string) {
    const templates = state.templates.filter((t) => t.id !== id);
    persistTemplates(templates);
    setState({ ...state, templates });
  },

  upsertSchoolClass(grade: number, classCount: number, customNames?: string[]) {
    const exists = state.classes.some((c) => c.grade === grade);
    const classes = sortClasses(exists
      ? state.classes.map((c) => (c.grade === grade ? { grade, classCount, customNames } : c))
      : [...state.classes, { grade, classCount, customNames }]);

    persistClasses(classes);
    setState({ ...state, classes });
  },

  removeSchoolClass(grade: number) {
    const classes = state.classes.filter((c) => c.grade !== grade);
    persistClasses(classes);
    setState({ ...state, classes });
  },

  resetToSeed(scope: SeedScope) {
    if (scope === 'templates') {
      persistTemplates(SEED_TEMPLATES);
      setState({ ...state, templates: SEED_TEMPLATES });
    } else {
      persistClasses(SEED_CLASSES);
      setState({ ...state, classes: SEED_CLASSES });
    }
  },
};
