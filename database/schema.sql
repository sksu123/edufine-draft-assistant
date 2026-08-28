-- 1. 사용자(Users) 테이블 확장 (Supabase Auth와 조인 목적)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TEACHER', 'ADMIN')) DEFAULT 'TEACHER',
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 사업/예산 테이블 (projects) - 실시간 잔액 연산의 기준점
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_project_name TEXT,
  project_name TEXT NOT NULL,
  detail_name TEXT,
  total_budget INTEGER NOT NULL DEFAULT 0,
  committed_amount INTEGER NOT NULL DEFAULT 0, -- 행정실 주무관이 에듀파인 엑셀로 확정시킨 금액
  pending_amount INTEGER NOT NULL DEFAULT 0,   -- 웹앱 내부에서 승인 대기 중인 금액 (차감 용도)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 지출 품의 메인 테이블 (expenditure_requests)
CREATE TABLE public.expenditure_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('SIMPLE', 'INSTRUCTOR', 'ESTIMATE')),
  total_calculated_amount INTEGER NOT NULL DEFAULT 0, -- JS에서 연산 후 확정된 초안 총액
  final_approved_amount INTEGER, -- 행정실에서 지출결의로 확정한 최종 금액
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')) DEFAULT 'DRAFT',
  image_urls JSONB, -- 스캔 및 뷰어용 원본 이미지 주소 배열
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 품의 상세 항목 테이블 (request_items) - OCR 검증 후 저장되는 곳
CREATE TABLE public.request_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.expenditure_requests(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  spec TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  is_tax_included BOOLEAN DEFAULT false
);

-- 5. 강사비 단가 마스터 테이블 (instructor_rates)
CREATE TABLE public.instructor_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('SPECIAL_1', 'SPECIAL_2', 'GENERAL_1', 'GENERAL_2', 'ASSISTANT')),
  base_rate INTEGER NOT NULL,
  excess_rate_per_hour INTEGER NOT NULL,
  manuscript_rate_per_page INTEGER NOT NULL,
  valid_year INTEGER NOT NULL
);

-- 6. 백엔드 큐 테이블 (ocr_queue)
CREATE TABLE public.ocr_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.expenditure_requests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'QUEUED',
  extracted_data JSONB, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. 품의서 본문 양식 마스터 (draft_templates)
CREATE TABLE public.draft_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,          -- 템플릿명 (예: 과학과제연구 물품구입)
  title TEXT NOT NULL,         -- 품의 제목
  start_text TEXT,             -- 시작문구
  purpose TEXT,                -- 목적
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. 품의서 양식 관련문서 (draft_related_docs)
CREATE TABLE public.draft_related_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.draft_templates(id) ON DELETE CASCADE,
  doc_number TEXT NOT NULL,    -- 관련문서번호 (예: 교육혁신과-1234)
  doc_date TEXT NOT NULL,      -- 결재일 (예: 2024.03.01.)
  sort_order INTEGER DEFAULT 0
);

-- 9. 자주 쓰는 구매처 마스터 (vendors)
CREATE TABLE public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,          -- 구매처명 (예: 11번가, G마켓, S2B)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Realtime 활성화: 프론트엔드가 대기열(ocr_queue) 상태를 실시간으로 구독하기 위함
alter publication supabase_realtime add table public.ocr_queue;


-- ==========================================
-- RLS (Row Level Security) 설정 추가
-- ==========================================

-- 모든 테이블에 행 수준 보안(RLS) 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenditure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_related_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- [초기 개발용 임시 정책]
-- ※ 익명(외부) 사용자의 접근을 차단하고, 로그인(인증)된 사용자만 접근할 수 있도록 기본 방어막 설정.
-- ※ 3단계(Auth)에서 Teacher(교사)와 Admin(행정실) 역할에 따라 권한을 엄격하게 쪼갤 예정입니다.
CREATE POLICY "Allow authenticated access" ON public.users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.projects FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.expenditure_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.request_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.instructor_rates FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.ocr_queue FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.draft_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.draft_related_docs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.vendors FOR ALL TO authenticated USING (true);

-- 11. 학년별 학급 수 테이블
CREATE TABLE public.school_classes (
  grade INTEGER PRIMARY KEY,
  class_count INTEGER NOT NULL DEFAULT 10
);

INSERT INTO public.school_classes (grade, class_count) VALUES (1, 10), (2, 10), (3, 10);
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON public.school_classes FOR ALL TO authenticated USING (true);
