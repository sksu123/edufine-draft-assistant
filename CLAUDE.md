# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

한국 학교 교사가 에듀파인(K-에듀파인) 지출 품의를 작성할 때 쓰는 브라우저 전용 도구다. 장바구니 캡처나 견적서 이미지를 Gemini로 스캔해 품목 표를 만들고, 사용자가 표를 손보면 (1) 에듀파인 붙여넣기용 엑셀과 (2) 복사용 품의서 본문 텍스트를 뽑아준다.

`요구사항.txt`가 품의서 본문 생성 기능의 원본 스펙이다. 본문 포맷을 건드릴 때는 이 파일을 먼저 읽을 것. 루트의 PDF/XLS 파일들(`2026학년도 강사수당 지침.pdf`, `품목내역 양식.xlsx` 등)은 코드가 참조하지 않는 도메인 참고자료다.

## 명령어

```bash
npm run dev        # Vite 개발 서버
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # 빌드 결과 미리보기
```

테스트 프레임워크는 없다. 검증 게이트는 **`npx tsc -b`** 로 잡을 것 (현재 통과).

`npm run lint`는 **기존에 이미 실패**한다 (현재 24 errors, 대부분 `no-explicit-any`). 내 변경 때문에 깨진 게 아니므로 exit code만 보고 판단하지 말고, 변경한 파일에 새 에러가 늘었는지로 판단한다. 남은 에러는 `DraftGeneratorModal` / `SettingsModal` / `InstructorFee` / `gemini.ts`의 `RequestQueue` / `App.tsx`와, tsconfig가 커버하지 않는 `supabase/functions/`(Deno 코드)에 있다.

## 아키텍처

### 백엔드가 없다

전부 브라우저에서 돈다. 서버, 인증, DB 연결이 없고 상태는 React state + `localStorage`가 전부다. 새로고침하면 입력한 품목은 사라진다 (단, 예산 데이터는 `localStorage`에 남는다 — 아래 참조).

`database/schema.sql`과 `supabase/functions/ocr-worker/`는 **연결되지 않은 잔재**다. `src/` 어디서도 참조하지 않고 `@supabase/supabase-js`는 설치조차 되어 있지 않다. 원래 Supabase 기반 설계(역할 분리, 서버 측 OCR 큐)를 클라이언트 전용으로 축소한 것이 이 "lite" 버전이다. Supabase를 되살리는 작업이 아니라면 이 두 경로는 건드리지 말고, 스키마를 근거로 코드 동작을 추론하지도 말 것.

### 예산 기능 (`/budget`)

원본(`../run-local-server`)의 서버 기반 예산 차감을 **1인용 localStorage 전용**으로 옮긴 것이다. 사업관리카드 엑셀은 브라우저 밖으로 나가지 않는다.

- `budgetCardParser.ts` — 에듀파인 사업관리카드(.xls) 파싱. 열 위치는 고정(0:비목명, 1:산출내역, 2:예산현액, 3:지출품의금액, 4:원인행위금액)이고 **계층은 A열의 들여쓰기 깊이**로 판별한다. 실제 샘플 기준 340개 항목/34개 세부사업이 나온다.
- 항목 ID는 `세부사업+세부항목+비목+산출내역`을 공백 정규화해 만든 **결정적 키**다. UUID로 바꾸면 재업로드마다 차감 기록이 전부 고아가 된다.
- **품의 대기액은 저장하지 않고 파생한다**: `가용잔액 = 예산현액 − 원인행위금액 − Σ(연결된 대기기록)`. 이 구조 덕분에 재업로드가 기록을 깨지 않고 기록 삭제가 잔액을 정확히 원복한다. 대기액을 필드로 저장하는 형태로 되돌리지 말 것.
- `지출품의금액`(3열)은 **표시 전용**이고 잔액 공식에 넣지 않는다. 원본과 동일한 계산식이다.
- 상태 공유는 `budgetStore.ts`(모듈 싱글턴) + `useBudget.ts`(`useSyncExternalStore`). `getSnapshot()`은 **참조가 안정된 객체**를 반환해야 한다 — 파생값을 거기서 만들면 무한 렌더가 난다.
- localStorage 키 3개(`budget_card_v1` / `budget_pendings_v1` / `budget_selection_v1`)는 **분리 저장**이다. 카드 덮어쓰기가 기록을 건드리면 안 되기 때문이다.
- 예산 초과는 **소프트 블록**(확인 후 진행 가능)이다. 카드가 없어도 세 품의 페이지는 온전히 동작해야 한다.

### Gemini 호출 경로

`페이지 → src/lib/gemini.ts → geminiQueue → @google/generative-ai`

- **API 키는 `localStorage['gemini_api_key']`** 에 있고 호출 시점에 `getGenAI()`가 매번 읽는다. 환경변수나 `.env`를 쓰지 않는다. 교사가 각자 발급받은 무료 키를 `SettingsModal`에서 직접 넣는 구조이므로 빌드 타임 주입으로 바꾸지 말 것.
- `RequestQueue`(gemini.ts)가 모든 요청을 직렬화해 **최소 4.5초 간격**을 강제한다. 무료 티어 15 RPM 제한 때문이다. 503/429는 5초 대기 후 최대 3회 재시도한다. 새 Gemini 호출을 추가한다면 반드시 `geminiQueue.enqueue()`를 거칠 것.
- SDK는 **`@google/genai`**, 모델은 `gemini-3.5-flash`. 구버전 `@google/generative-ai`는 2025-11-30자로 지원이 끝나 교체했다. 모델 ID나 SDK를 바꿔야 하면 ai.google.dev에서 현행 지원 여부를 먼저 확인할 것.
- 추출 설정(`EXTRACTION_CONFIG`)은 `mediaResolution: MEDIA_RESOLUTION_HIGH`(견적서 표·장바구니 옵션의 작은 글자 판독) + `thinkingLevel: LOW`(단순 추출) + `responseMimeType: application/json`이다.
- **`temperature`를 설정하지 말 것.** Gemini 3 계열은 기본값 1.0을 유지하라는 게 공식 지침이고, 낮추면 looping·성능 저하가 난다. 추출 작업이라고 0으로 내리면 안 된다.
- 출력 형식은 `geminiSchemas.ts`의 `responseSchema`로 강제한다. 각 필드 `description`이 곧 추출 지침으로 작동하므로 프롬프트만 고치지 말고 스키마 쪽도 같이 볼 것. 스키마는 강제이지 보증이 아니므로 **기존 방어 파싱 코드를 걷어내지 말 것.**

### 가장 중요한 규칙: AI에게 계산을 시키지 않는다

두 프롬프트 모두 "사칙연산 절대 금지, 문서에 적힌 숫자만 추출"을 명시한다. 총액·단가·부가세는 전부 JS가 계산한다. 프롬프트를 수정할 때 이 제약을 약화시키면 안 된다 — 금액 오류가 곧바로 공문서 오류가 되는 도메인이다.

### 페이지별 도메인 계산 규칙

라우팅은 `App.tsx`에 있고 세 페이지 모두 독립적이다 (공유 상태 없음). 각 페이지의 계산식은 임의로 "개선"하면 안 되는 행정 규칙이다.

**`SimplePurchase`** (`/`) — 장바구니 캡처용.
- 단가 = `order_price / quantity`를 **5% 할증 후 100원 단위 올림** (`Math.ceil(raw * 1.05 / 100) * 100`). 발주 시점 가격 변동 대비용 의도적 할증이다.
- 배송비는 품목별로 합산해 `배송비`라는 별도 행 하나로 표 끝에 붙인다.

**`ContractPurchase`** (`/contract`) — 견적서용.
- 부가세 포함 여부를 자동 판별한다: 행 합계와 문서 총액 차이가 10원 미만이면 "포함", 행 합계 ×1.1이 문서 총액과 10원 미만 차이면 "별도". AI의 `is_vat_included_context`보다 이 수치 비교가 우선한다.
- 포함일 때 공급가액 = `round(total / 1.1)`, 별도일 때 세액 = `floor(supply * 0.1)`. 반올림 방향이 서로 다른 것은 의도된 것이다.
- 행별 `면세 여부` 스위치를 켜면 부가세 0원 (도서 등).

**`InstructorFee`** (`/instructor`) — 강사비용. 이미지 스캔 없이 수기 입력만.
- 단가표는 `useEffect` 안에 하드코딩되어 있다 (특별강사 I/II, 일반강사 I/II, 보조강사). `2026학년도 강사수당 지침.pdf`가 근거다.
- 수당 = `base_rate + excess_rate × (hours - 1)`. 즉 1시간은 기본액, 이후 시간당 초과액.
- 원고료는 **시간당 페이지 상한**이 있다: 국문 15,000원/p·2.5p/h, 외국어 13,000원/p·2.5p/h, PPT 5,000원/p·9p/h. 상한 초과분은 지급하지 않는다.
- 한 강사가 여러 날 출강하는 구조라 `InstructorGroup → LectureSession` 중첩 데이터를 `flatData`로 펴서 `rowSpan`으로 셀 병합해 렌더링한다.

### 품의서 본문 생성 (`DraftGeneratorModal`)

세 페이지가 공유하는 유일한 컴포넌트로, 총액만 prop으로 받는다. `updateGeneratedText()`가 폼 값을 한국 공문서 서식 문자열로 조립하며, 규칙은 `요구사항.txt` 11~28행에 정의되어 있다:

- 항목(행사명/일시/장소/대상/금액/목적/구매처) 중 **비어 있는 것은 건너뛰고 `가./나./다.` 색인을 당긴다.** 그래서 `items` 배열에 값이 있는 것만 push한 뒤 인덱스로 색인을 붙이는 구조다.
- **최상위 번호(`1.`, `2.`)도 같은 방식으로 당긴다.** 관련문서가 없으면 시작문구가 `1.`이 된다 (`sectionNo` 카운터). 번호를 문자열에 하드코딩하지 말 것 — 예전엔 `1.` 없이 `2.`부터 시작하는 본문이 나왔다. 문서번호·결재일이 모두 빈 관련문서 행(+ 버튼만 누른 행)은 관련문서로 세지 않는다.
- 대상 표기: **설정된 학년 전체** + 반 미선택 → `전교생`, 학년만 → `1학년`, 반 선택 → `1-2, 1-3` (항상 오름차순). 로직은 `templateTypes.ts`의 `formatTargetLabel()` 한 곳에 있다. 학년 수가 설정값이므로 `=== 3` 같은 상수 비교로 되돌리지 말 것. **학년이 0개일 때 `전교생`이 되면 안 된다**(가드 있음 — 지우면 공문서 오류).
- 붙임이 없으면 마지막 줄 끝에 `.  끝.`, 1개면 `붙임 X 1부.  끝.`, 2개 이상이면 번호 매기고 마지막 줄에만 `끝.`. **공백 개수가 서식의 일부**이므로 문자열 리터럴의 스페이스를 정리하지 말 것.
- 미리보기는 `white-space: pre-wrap` + Gulim 폰트로, 에듀파인에 붙여넣었을 때의 정렬을 재현하려는 것이다.

### 템플릿·구매처·학년 (`/templates`)

`DUMMY_TEMPLATES` / `DUMMY_VENDORS` / `schoolClasses` 하드코딩은 제거됐고, 전부 `templateStore`(localStorage)에서 온다. 키 3개: `draft_templates_v1` / `draft_vendors_v1` / `draft_school_classes_v1`.

- **템플릿에 날짜·시간을 넣지 말 것.** `date`/`start_time`/`end_date`/`end_time`은 dayjs 객체라 JSON 왕복이 깨지고, 건별 값이라 의미도 없다. `captureTemplate()`이 저장 항목을 **화이트리스트로 나열**하는 이유가 이것이다. 스프레드나 블랙리스트로 바꾸면 DatePicker가 추가되는 순간 조용히 깨진다.
- **템플릿 적용은 머지다** (`applyTemplate`). 템플릿에서 비어 있는 항목은 사용자가 이미 입력한 값을 덮어쓰지 않는다. 관련문서·붙임은 중복 제거하며 덧붙여서 같은 템플릿을 두 번 골라도 결과가 같다. `직접입력` 선택은 아무것도 지우지 않는다.
- **미리보기 갱신에 `setTimeout`을 쓰지 말 것.** 낡은 클로저가 방금 복원한 대상을 덮어쓴다. `regenTick` 카운터를 올려 effect가 state flush 이후에 돌게 되어 있다.
- 씨딩 규칙: **키가 없으면** 기본값을 심고, **빈 배열이면 그대로 둔다**(`Array.isArray` 판별). truthy 검사로 바꾸면 사용자가 전부 지워도 매번 되살아난다. 되돌릴 길은 탭마다 있는 `기본값 복원` 버튼이다.
- `templateStore.ts`는 `budgetStore.ts`와 달리 **import 시점에 localStorage에 쓸 수 있다.** 위 씨딩 규칙을 성립시키기 위한 의도다.
- 대상 선택 UI는 `components/TargetPicker.tsx` 하나를 품의서 생성기와 템플릿 편집 폼이 공유한다.

### 엑셀 내보내기

`src/lib/excelExport.ts`의 `exportItemsToExcel()` 하나를 두 페이지가 공유한다. 헤더는 `["내용", "규격", "단위", "수량", "예상단가"]` 고정, `단위`는 항상 `"선택"`, 파일명은 `품목내역(통합).xls`. 에듀파인 업로드 양식(`품목내역 양식.xlsx`)에 맞춘 것이므로 **열 구성을 바꾸면 안 된다.**

### 규격/옵션 (`specification`)

장바구니에서 같은 상품을 옵션만 다르게 여러 개 담으면 품명이 전부 같아진다. 이를 구분하는 유일한 근거가 `specification`이므로:

- 프롬프트와 `responseSchema` 모두 옵션을 **반드시** 채우도록 지시하고 있다. 약화시키지 말 것.
- 두 페이지 표의 `규격/옵션` 열과 엑셀 `규격` 열이 이 값을 그대로 쓴다.
- `품명+규격`이 겹치면 주황 `중복` 배지가 뜬다. 병합은 **품명·규격·단가가 모두 같을 때만** 수량을 합산하므로 총액이 바뀌지 않는다. 자동 병합은 하지 않는다 — 공문서 금액 구성을 사용자 확인 없이 바꾸면 안 된다.

## 공통 모듈

세 페이지가 중복으로 갖고 있던 로직은 아래로 합쳤다. 한쪽만 고치는 실수를 막기 위한 것이므로 다시 페이지 안으로 복사하지 말 것.

- `src/hooks/useScanUpload.ts` — 업로드 설정 + Ctrl+V 붙여넣기 + 미리보기 URL + `getFiles()`. 미리보기 objectURL은 여기서 해제한다(원본은 해제하지 않아 누수였다).
- `src/lib/excelExport.ts` — 엑셀 내보내기
- `src/hooks/useDraftGuard.ts` — 중복 기안 차단 + 예산 초과 확인
- `src/components/TargetPicker.tsx` — 대상(학년/반) 선택
- `src/lib/templateTypes.ts`의 `formatTargetLabel()` — 대상 표기 문자열(공문서 규칙)

## 알아둘 함정

- `README.md`는 Vite 템플릿 기본 파일이라 이 프로젝트 내용이 없다.
- 이 저장소는 git 저장소가 아니다. `dist/`에 빌드 산출물이 남아 있고, SPA 폴백은 `public/_redirects`가 담당한다.
- `xlsx@0.18.5`(SheetJS)는 npm 배포본에 알려진 취약점이 있다. 사업관리카드·엑셀 출력에 쓰이므로 교체하려면 SheetJS 공식 배포처 버전을 검토할 것.
- 번들이 2MB(gzip 600KB)로 크다. antd + xlsx + genai를 한 청크에 담은 결과이고 코드 스플리팅은 아직 없다.

## 개인정보 주의

업로드된 이미지는 그대로 Google Gemini API로 전송된다. 이미지에 학생·교사 인적사항이 포함될 수 있는 경로(견적서, 강사 명단 등)를 다룰 때는 전송 범위가 넓어지지 않는지 확인하고, 예시·테스트 데이터에는 실존 인물 정보를 쓰지 않는다. `InstructorFee`의 강사명 입력 placeholder가 `김*수`인 것도 마스킹 입력을 유도하기 위한 것이다.
