import { GoogleGenAI, MediaResolution, ThinkingLevel } from '@google/genai';
import { SIMPLE_PURCHASE_SCHEMA, CONTRACT_PURCHASE_SCHEMA } from './geminiSchemas';

const MODEL_ID = 'gemini-3.5-flash';

// 밀집 문서(견적서 표, 장바구니 옵션)의 작은 글자 판독을 위해 고해상도로 처리한다.
// thinkingLevel은 단순 추출이므로 LOW. temperature는 Gemini 3 권장에 따라 설정하지 않는다(기본 1.0).
const EXTRACTION_CONFIG = {
  mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  responseMimeType: 'application/json',
} as const;

// --- Queue Manager ---
// 무료 API의 15 RPM 제한을 우회하기 위해 요청 간 최소 4초 대기 강제
class RequestQueue {
  private queue: Array<{ task: () => Promise<any>, resolve: (val: any) => void, reject: (err: any) => void }> = [];
  private isProcessing: boolean = false;
  private lastRequestTime: number = 0;
  private readonly INTERVAL = 4500; // 4.5 seconds to strictly obey 15 RPM
  private listeners: Array<(queueSize: number) => void> = [];

  subscribe(listener: (queueSize: number) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.queue.length));
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.notify();
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift()!;
      this.notify();
      
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.INTERVAL) {
        await new Promise(r => setTimeout(r, this.INTERVAL - timeSinceLast));
      }
      
      this.lastRequestTime = Date.now();
      
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempts < maxAttempts && !success) {
        try {
          const result = await task();
          resolve(result);
          success = true;
        } catch (error: any) {
          attempts++;
          const isOverloaded = error?.message?.includes('503') || error?.message?.includes('429');
          
          if (isOverloaded && attempts < maxAttempts) {
            console.warn(`[Gemini API] 서버 과부하 발생(${error.message}). 5초 후 ${attempts}번째 재시도...`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            reject(error);
            break;
          }
        }
      }
    }

    this.isProcessing = false;
  }
}

export const geminiQueue = new RequestQueue();

// --- Helper: Convert File to Generative Part ---
async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type
    },
  };
}

// --- API Functions ---

const getGenAI = () => {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다. 설정에서 키를 먼저 등록해주세요.');
  return new GoogleGenAI({ apiKey });
};

const parseJsonResponse = (text: string | undefined) => {
  if (!text) throw new Error('AI 응답이 비어 있습니다. 이미지를 확인하고 다시 시도해주세요.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
  }
};

const SIMPLE_PURCHASE_PROMPT = `
당신은 학교 행정실의 데이터 추출 전문 AI입니다.
업로드된 이미지는 교사가 제출한 '단순 물품 품의'를 위한 장바구니 혹은 견적서 스크린샷입니다.
이미지의 전체 문맥을 분석하여 구매할 물품의 목록을 추출하세요.

[필수 규칙 - 절대 위반 금지]
1. 사칙연산(단가 합산, 총액 계산, 부가세 연산 등)을 절대 하지 마세요. 오직 문서에 명시된 숫자만 그대로 추출하세요. 계산은 우리 시스템이 자바스크립트로 처리합니다.
2. 문맥상 '상품명', '옵션/규격', '수량', '주문금액(또는 상품금액)', '배송비'를 발라내세요. 화면 전체 결제 요약에 표시된 '총 배송비'가 있다면 첫 번째 품목의 배송비 항목에 넣거나, 품목별로 기재된 배송비 숫자를 정확히 추출하세요. 만약 배송비 텍스트가 없으면 0을 넣으세요.

[옵션 구분 - 매우 중요]
3. 같은 상품을 옵션(색상/사이즈/종류 등)만 다르게 여러 개 담은 경우, 옵션마다 별도의 항목으로 각각 추출하세요. 절대 하나로 합치지 마세요.
4. 이때 specification에는 그 항목을 다른 항목과 구분해 주는 옵션 텍스트를 반드시 채우세요. 옵션이 정말 없을 때만 빈 문자열로 두세요.
5. 상품명 안에 옵션이 붙어 있으면(예: "네임펜 (검정)") 상품명과 옵션을 분리해서 name과 specification에 나누어 넣으세요.

[금액 판별]
6. 정가(할인 전)와 판매가(할인 적용)가 함께 보이면, 실제로 결제할 금액인 할인 적용가를 order_price에 넣으세요. 취소선이 그어진 금액은 정가이므로 쓰지 마세요.
7. 수량 표기는 '2', '2개', 'x2', '수량 2' 등 다양합니다. 숫자만 뽑아 quantity에 넣으세요.

[제외 대상]
8. 품절 표시된 항목, 체크가 해제되어 주문에서 빠진 항목, 광고나 추천 상품 영역은 추출하지 마세요.
`;

export async function extractItemsFromImage(files: File[]) {
  const ai = getGenAI();
  return geminiQueue.enqueue(async () => {
    const imageParts = await Promise.all(files.map(f => fileToGenerativePart(f)));
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [SIMPLE_PURCHASE_PROMPT, ...imageParts],
      config: { ...EXTRACTION_CONFIG, responseSchema: SIMPLE_PURCHASE_SCHEMA },
    });

    return parseJsonResponse(response.text);
  });
}

const CONTRACT_PURCHASE_PROMPT = `
당신은 학교 행정실의 데이터 추출 전문 AI입니다.
업로드된 이미지/PDF는 교사가 제출한 '계약(견적서)'입니다. 여러 장이 올라온 경우 같은 견적서의 연속된 페이지로 취급하세요.
문서의 표와 문맥을 분석하여 물품 목록을 추출하세요.

[필수 규칙 - 절대 위반 금지]
1. 사칙연산(총액 계산, 부가세 연산, 공급가액 계산 등)을 절대 하지 마세요. 오직 문서에 명시된 숫자만 그대로 추출하세요.
2. 만약 문서에 '공급가액'과 '세액'이 개별 품목별로 명시되어 있지 않고 총액만 있다면, 개별 항목의 공급가액과 세액은 0으로 두고 단가와 수량만 추출하세요.

[표 읽기 - 매우 중요]
3. 업체마다 열 이름이 다릅니다. 아래를 같은 뜻으로 취급하세요.
   - 품명 = 품목 / 제품명 / 내역 / 상품명
   - 규격 = 사양 / 모델 / 규격및사양 / SPEC
   - 수량 = 수 / 개수
   - 단가 = 단가(원) / 공급단가
   - 합계 = 금액 / 공급대가 / 계
   - 세액 = 부가세 / VAT / 부가가치세
4. 소계, 합계, 총계, 부가세, 공급가액계 같은 요약 행은 items에 절대 넣지 마세요. 그 숫자는 total_amount_from_document에만 반영하세요.
5. 표의 각 행을 문서에 나타난 순서 그대로 추출하세요. 행을 병합하거나 생략하지 마세요. 빈 행은 건너뛰세요.
6. 규격/사양 열이 따로 있으면 그 내용을 specification에 넣으세요. 없으면 빈 문자열로 두세요.
7. 문서 머리말(업체명, 주소, 사업자등록번호, 견적일자, 담당자)과 하단 안내문은 품목이 아닙니다. 추출하지 마세요.

[부가세]
8. vat_note에는 부가세 관련 문구를 문서에 적힌 그대로 옮기세요 (예: "부가세 별도", "VAT 포함"). 관련 문구가 없으면 빈 문자열로 두세요.
9. is_vat_included_context는 연산 없이 문구와 문맥으로만 판단하세요.
`;

export async function extractContractFromImage(files: File[]) {
  const ai = getGenAI();
  return geminiQueue.enqueue(async () => {
    const imageParts = await Promise.all(files.map(f => fileToGenerativePart(f)));
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [CONTRACT_PURCHASE_PROMPT, ...imageParts],
      config: { ...EXTRACTION_CONFIG, responseSchema: CONTRACT_PURCHASE_SCHEMA },
    });

    return parseJsonResponse(response.text);
  });
}
