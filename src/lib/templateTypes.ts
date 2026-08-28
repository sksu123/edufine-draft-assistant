export interface RelatedDoc { doc_number: string; doc_date: string; }
export interface Attachment { filename: string; }

/** 학년별 학급 수. grade가 사실상의 키다. 유치원 등은 grade: 0을 쓴다. */
export interface SchoolClass { grade: number; classCount: number; customNames?: string[]; }

/**
 * 품의 템플릿.
 *
 * 필드명은 DraftGeneratorModal의 Form name과 의도적으로 동일하다.
 * 적용 로직이 곧 setFieldsValue이므로 매핑 테이블을 두지 않기 위한 것.
 *
 * 날짜/시간(date, start_time, end_date, end_time, manual_time)은 dayjs 객체라
 * JSON 왕복이 불가능하고 건별로 달라지는 값이므로 여기에 절대 넣지 않는다.
 */
export interface DraftTemplate {
  id: string;
  name: string;                            // 템플릿명 (필수, 드롭다운 표시용)
  event_name: string;
  start_text: string;
  purpose: string;
  location: string;
  relatedDocs: RelatedDoc[];
  attachments: Attachment[];
  targetGrades: number[];
  targetClasses: Record<string, string[]>; // JSON 키는 항상 string. 값은 학급명(string) 또는 번호(string 변환됨)로 변경
  updatedAt: string;
}

/** 저장 입력. id가 있으면 덮어쓰기, 없으면 신규. */
export type DraftTemplateInput = Omit<DraftTemplate, 'id' | 'updatedAt'> & { id?: string };

/**
 * 대상(학년/반) 표기 문자열. 공문서 서식 규칙이므로 임의로 바꾸지 말 것.
 * - 설정된 학년을 전부 선택하고 반을 하나도 고르지 않으면 '전교생'
 * - 반 미선택 학년은 'N학년', 반 선택 학년은 'N-M' (또는 유치원 반이름)
 */
export const formatTargetLabel = (
  grades: number[],
  classes: Record<number, string[]>,
  allGrades: number[],
): string => {
  if (allGrades.length > 0
    && grades.length === allGrades.length
    && grades.every((g) => !classes[g]?.length)) {
    return '전원'; // 전교생보다 전원이 더 포괄적
  }

  const results: string[] = [];
  [...grades].sort((a, b) => a - b).forEach((grade) => {
    const selected = classes[grade] || [];
    if (selected.length === 0) {
      results.push(grade === 0 ? `유치원` : `${grade}학년`);
    } else {
      results.push([...selected].sort().map((c) => grade === 0 ? `유치원 ${c}반` : `${grade}-${c}`).join(', '));
    }
  });

  return results.join(', ');
};

/** 저장 형식(string 키) → 화면 상태(number 키). */
export const toNumericClasses = (stored: Record<string, string[]>): Record<number, string[]> => {
  const out: Record<number, string[]> = {};
  Object.keys(stored).forEach((key) => {
    const grade = Number(key);
    if (!Number.isNaN(grade)) out[grade] = stored[key] ?? [];
  });
  return out;
};

/** 화면 상태(number 키) → 저장 형식(string 키). */
export const toStoredClasses = (
  grades: number[],
  classes: Record<number, string[]>,
): Record<string, string[]> => Object.fromEntries(
  grades.map((g) => [String(g), [...(classes[g] ?? [])].sort()]),
);
