import { useMemo, useSyncExternalStore } from 'react';
import { templateStore } from '../lib/templateStore';
import type { DraftTemplate, SchoolClass } from '../lib/templateTypes';

export interface UseTemplates {
  templates: DraftTemplate[];
  classes: SchoolClass[];
  /** 설정된 학년 목록 (오름차순) */
  grades: number[];
  classCountByGrade: Map<number, number>;
  customNamesByGrade: Map<number, string[]>;
  templateById: Map<string, DraftTemplate>;
}

export function useTemplates(): UseTemplates {
  const state = useSyncExternalStore(templateStore.subscribe, templateStore.getSnapshot);

  const grades = useMemo(
    () => [...new Set(state.classes.map((c) => c.grade))].sort((a, b) => a - b),
    [state.classes],
  );

  const classCountByGrade = useMemo(
    () => new Map(state.classes.map((c) => [c.grade, c.classCount])),
    [state.classes],
  );

  const customNamesByGrade = useMemo(
    () =>
      state.classes.reduce((acc, curr) => {
        if (curr.customNames && curr.customNames.length > 0) {
          acc.set(curr.grade, curr.customNames);
        }
        return acc;
      }, new Map<number, string[]>()),
    [state.classes],
  );

  const templateById = useMemo(
    () => new Map(state.templates.map((t) => [t.id, t])),
    [state.templates],
  );

  return {
    templates: state.templates,
    classes: state.classes,
    grades,
    classCountByGrade,
    customNamesByGrade,
    templateById,
  };
}
