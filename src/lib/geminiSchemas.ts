import { Type } from '@google/genai';
import type { Schema } from '@google/genai';

// responseSchema는 모델에 그대로 전달되므로, description이 곧 추출 지침으로 작동한다.
// 프롬프트보다 잘 지켜지는 편이라 핵심 규칙은 여기에도 중복해서 적는다.

export const SIMPLE_PURCHASE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: '상품명. 옵션 텍스트는 여기에 넣지 말고 specification으로 분리할 것.',
      },
      specification: {
        type: Type.STRING,
        description:
          '이 항목을 같은 상품의 다른 항목과 구분해 주는 옵션/규격 텍스트(색상, 사이즈, 종류 등). 같은 상품을 옵션만 다르게 여러 개 담은 경우 반드시 채울 것. 옵션이 정말 없을 때만 빈 문자열.',
      },
      quantity: {
        type: Type.INTEGER,
        description: "수량. '2개', 'x2', '수량 2' 등에서 숫자만 추출. 표기가 없으면 1.",
      },
      order_price: {
        type: Type.INTEGER,
        description:
          '해당 품목의 주문금액(상품금액) 전체. 수량이 이미 곱해진 금액을 그대로 옮길 것. 정가와 할인가가 함께 보이면 실제 결제할 할인 적용가를 쓸 것. 직접 계산하지 말 것.',
      },
      shipping_fee: {
        type: Type.INTEGER,
        description: "배송비. '무료배송' 등 0원이거나 표기가 없으면 0.",
      },
    },
    required: ['name', 'specification', 'quantity', 'order_price', 'shipping_fee'],
    propertyOrdering: ['name', 'specification', 'quantity', 'order_price', 'shipping_fee'],
  },
};

export const CONTRACT_PURCHASE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    total_amount_from_document: {
      type: Type.INTEGER,
      description: '문서 하단 등에 기재된 최종 합계(견적) 총액. 없으면 0. 직접 계산하지 말 것.',
    },
    is_vat_included_context: {
      type: Type.BOOLEAN,
      description:
        "문맥상 '부가세 포함', 'VAT 포함' 등의 표현이 있거나 단가에 부가세가 이미 합산된 형태로 보이면 true. 연산 없이 문구로만 판별할 것.",
    },
    vat_note: {
      type: Type.STRING,
      description:
        "부가세 관련 문구를 문서에 적힌 그대로 옮길 것 (예: '부가세 별도', 'VAT 포함'). 관련 문구가 없으면 빈 문자열.",
    },
    items: {
      type: Type.ARRAY,
      description:
        '품목 행 목록. 소계/합계/총계/부가세 같은 요약 행과 머리말·안내문은 절대 포함하지 말 것. 문서에 나타난 순서를 유지할 것.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: '품명(품목/제품명/내역).' },
          specification: {
            type: Type.STRING,
            description: '규격/사양/모델 열의 내용. 없으면 빈 문자열.',
          },
          quantity: { type: Type.INTEGER, description: '수량. 표기가 없으면 1.' },
          unit_price: { type: Type.INTEGER, description: '단가. 문서에 없으면 0.' },
          row_total_amount: {
            type: Type.INTEGER,
            description: '품목별 합계(금액) 열의 값. 문서에 없으면 0. 직접 계산하지 말 것.',
          },
          supply_amount: {
            type: Type.INTEGER,
            description: '개별 공급가액이 행별로 명시되어 있을 때만 추출. 없으면 0.',
          },
          vat_amount: {
            type: Type.INTEGER,
            description: '개별 부가세(세액)가 행별로 명시되어 있을 때만 추출. 없으면 0.',
          },
        },
        required: [
          'name',
          'specification',
          'quantity',
          'unit_price',
          'row_total_amount',
          'supply_amount',
          'vat_amount',
        ],
        propertyOrdering: [
          'name',
          'specification',
          'quantity',
          'unit_price',
          'row_total_amount',
          'supply_amount',
          'vat_amount',
        ],
      },
    },
  },
  required: ['total_amount_from_document', 'is_vat_included_context', 'vat_note', 'items'],
  propertyOrdering: ['total_amount_from_document', 'is_vat_included_context', 'vat_note', 'items'],
};
