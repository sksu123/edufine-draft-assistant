// supabase/functions/ocr-worker/index.ts
// [핵심 로직] 15 RPM 제한을 지키기 위해, pg_cron 스케줄러가 이 함수를 규칙적으로 호출합니다.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  // 1. 대기열(ocr_queue)에서 가장 오래된 QUEUED 상태의 작업 1개만 딱 가져옵니다.
  const { data: queueItem } = await supabase
    .from('ocr_queue')
    .select('*')
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!queueItem) {
    return new Response(JSON.stringify({ message: "대기열이 비어있습니다." }), { headers: { "Content-Type": "application/json" } });
  }

  // 2. 다른 워커가 중복 접근하지 못하도록 즉시 PROCESSING 상태로 Lock(잠금) 처리합니다.
  await supabase.from('ocr_queue').update({ status: 'PROCESSING' }).eq('id', queueItem.id);

  try {
    // 3. (실제 구현 시) Storage에서 영수증/견적서 이미지의 Signed URL을 발급받습니다.
    
    // 4. 비정형 문맥 분석 프롬프트 세팅 (Rule 1 & Rule 3 적용)
    const prompt = `첨부된 이미지에서 품명, 규격, 수량, 단가 텍스트를 추출하세요. 
    주의: 절대 금액을 스스로 합산하거나 계산하지 말고 문서에 적힌 텍스트만 추출할 것.`;
    
    // API 호출 대기 시뮬레이션 (약 3초 소요)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 추출된 더미 JSON 데이터
    const extractedData = [
      { item_name: "A4 복사용지 (Double A)", quantity: 10, unit_price: 15000, amount: 150000 },
      { item_name: "화이트보드 마카 (흑/적/청)", quantity: 3, unit_price: 2500, amount: 7500 }
    ];

    // 5. 작업이 끝나면 상태를 COMPLETED로 바꾸고 결과 데이터를 삽입합니다.
    await supabase.from('ocr_queue').update({ 
      status: 'COMPLETED',
      extracted_data: extractedData
    }).eq('id', queueItem.id);

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    // 에러 발생 시 FAILED 처리하여 큐가 막히지 않도록 합니다.
    await supabase.from('ocr_queue').update({ status: 'FAILED' }).eq('id', queueItem.id);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
