import { Typography, Card, Row, Col, Alert, Steps } from 'antd';
import { 
  FileTextOutlined, 
  FileExcelOutlined, 
  AppstoreAddOutlined, 
  CalculatorOutlined, 
  SettingOutlined,
  SafetyCertificateOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export const UserGuide = () => {
  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <Title level={2} style={{ color: 'var(--color-primary)', marginBottom: 8 }}>📖 품의뚝딱 사용설명서</Title>
        <Text type="secondary" style={{ fontSize: 16 }}>에듀파인 지출 품의, 이제 스트레스 받지 마세요! AI가 다 알아서 정리해 드립니다.</Text>
      </div>

      <Alert
        message={<Text strong>이 도구는 왜 만들어졌나요?</Text>}
        description={
          <Paragraph style={{ margin: 0, marginTop: 8 }}>
            에듀파인에 지출 품의를 올릴 때마다 수많은 품목을 하나하나 직접 타이핑해서 옮겨 적는 것이 너무 번거로우셨죠? <br />
            <strong>품의뚝딱</strong>은 선생님께서 캡처한 장바구니나 견적서 이미지를 AI가 읽어내어 표로 깔끔하게 정리해주고, 
            내역 확인 후 <strong>클릭 두 번</strong>이면 품의서 본문과 엑셀 파일을 모두 완성해 주는 똑똑한 도우미입니다.
          </Paragraph>
        }
        type="info"
        showIcon
        style={{ marginBottom: 32, padding: 20, borderRadius: 12, border: '1px solid #38BDF8', backgroundColor: '#F0F9FF' }}
      />

      <Title level={3} style={{ color: 'var(--color-primary)' }}>✨ 무엇을 도와주나요?</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} md={12}>
          <Card title={<><FileTextOutlined style={{ color: '#0E7490' }}/> 품의서 본문 자동 생성</>} bordered={false} style={{ height: '100%' }}>
            행사명, 일시, 장소, 대상 등 빈칸만 채우시면 공문서 서식에 맞춰 완벽한 본문을 만들어 드립니다. 
            '가/나/다' 색인이나 '붙임 1부. 끝.' 같은 까다로운 공문서 규칙도 알아서 척척! 비워둔 항목은 건너뛰고 번호를 깔끔하게 당겨주니, 복사해서 에듀파인에 <strong>그대로 붙여넣기만</strong> 하세요.
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<><FileExcelOutlined style={{ color: '#0E7490' }}/> 에듀파인 전용 엑셀 다운로드</>} bordered={false} style={{ height: '100%' }}>
            에듀파인 업로드 양식(내용/규격/단위/수량/예상단가)에 한 치의 오차도 없이 딱 맞춘 엑셀 파일을 버튼 하나로 바로 내려받을 수 있습니다.
          </Card>
        </Col>
        <Col xs={24} md={24}>
          <Card title={<><AppstoreAddOutlined style={{ color: '#0E7490' }}/> 세 가지 맞춤형 품의 유형</>} bordered={false}>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: '2' }}>
              <li><strong>단순 물품 품의:</strong> 쇼핑몰 장바구니 캡처를 스캔합니다. 같은 상품을 옵션만 다르게 담아도 AI가 똑똑하게 규격/옵션으로 분리해 줍니다.</li>
              <li><strong>견적서 계약 품의:</strong> 견적서 PDF나 사진을 스캔합니다. 총액과 공급가액을 비교하여 <strong>부가세 포함/별도 여부까지 알아서 판별</strong>해 냅니다.</li>
              <li><strong>강사비 지출 품의:</strong> 강사 등급별 수당 단가와 원고료 시간당 페이지 상한을 규칙에 맞게 자동 계산해 줍니다.</li>
            </ul>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<><CalculatorOutlined style={{ color: '#0E7490' }}/> 예산 잔액 실시간 확인 (선택)</>} bordered={false} style={{ height: '100%' }}>
            에듀파인에서 내려받은 [사업관리카드] 엑셀을 등록하면 산출내역별 잔액을 한눈에 볼 수 있습니다. 
            품의 초안을 만들면 '품의 대기액'으로 임시 기록되어 잔액에서 미리 빼서 보여주니 예산 관리가 훨씬 수월해집니다. (기록을 지우면 잔액도 원래대로 돌아옵니다!)
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<><SettingOutlined style={{ color: '#0E7490' }}/> 나만의 맞춤 템플릿 등록</>} bordered={false} style={{ height: '100%' }}>
            자주 쓰는 품의 문구(목적, 장소, 대상 등)를 저장해두고 클릭 한 번에 불러오세요! 
            우리 학교에 맞는 학년/학급 수나 단가 설정도 한 번만 맞춰두면 계속 편하게 쓸 수 있습니다.
          </Card>
        </Col>
      </Row>

      <Title level={3} style={{ color: 'var(--color-primary)', marginTop: 40 }}>🚀 이렇게 사용해 보세요</Title>
      <Card bordered={false} style={{ marginBottom: 40 }}>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: <Text strong style={{ fontSize: 16 }}>초기 설정하기</Text>,
              description: '왼쪽 ⚙️ 학교 API 설정 메뉴에서 학교 이름을 적고, 무료로 발급받은 Gemini API 키를 등록합니다. (구글 AI Studio에서 1분이면 발급 가능해요!)',
            },
            {
              title: <Text strong style={{ fontSize: 16 }}>캡처하고 스캔하기</Text>,
              description: '장바구니나 견적서 이미지를 화면에 올리거나 단축키(Ctrl+V)로 붙여넣고 [AI 스캔 시작] 버튼을 누릅니다.',
            },
            {
              title: <Text strong style={{ fontSize: 16 }}>확인하고 뚝딱!</Text>,
              description: 'AI가 추출해 준 표를 눈으로 가볍게 확인하며 필요한 부분을 수정한 뒤, [엑셀 다운로드]와 [기안문 초안 작성하기] 버튼을 누르면 완성입니다!',
            },
          ]}
        />
      </Card>

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card 
            title={<><SafetyCertificateOutlined /> 데이터는 어디에 저장되나요?</>} 
            style={{ borderColor: '#52c41a', height: '100%' }}
            headStyle={{ backgroundColor: '#f6ffed', color: '#389e0d' }}
          >
            <Paragraph>
              <strong>서버가 전혀 없습니다!</strong> 선생님의 예산 내역, 템플릿, API 키 등 모든 정보는 
              <strong>오직 지금 사용 중인 브라우저(내 PC)에만 안전하게 저장</strong>됩니다.
            </Paragraph>
            <ul style={{ paddingLeft: 20, marginBottom: 0, color: '#595959' }}>
              <li>따라서 다른 사람은 절대 내 예산이나 템플릿을 훔쳐볼 수 없습니다.</li>
              <li>반대로 <strong>다른 PC를 쓰시거나 브라우저 캐시를 지우면</strong> 등록해 둔 내용이 초기화되니 주의해 주세요.</li>
              <li>예산 차감 기능은 이 도구 안에서만 편의상 보여드리는 '개인 메모장' 같은 기능이므로, <strong>실제 에듀파인과 연동되지는 않습니다.</strong></li>
            </ul>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card 
            title={<><WarningOutlined /> 사용 전 꼭! 미리 알아두세요</>} 
            style={{ borderColor: '#faad14', height: '100%' }}
            headStyle={{ backgroundColor: '#fffbe6', color: '#d48806' }}
          >
            <ul style={{ paddingLeft: 20, marginBottom: 0, color: '#595959', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>개인정보 주의:</strong> 업로드하신 이미지는 표를 읽기 위해 구글 Gemini 인공지능으로 잠시 전송됩니다. 
                <Text type="danger">학생이나 교직원의 민감한 인적사항이 보이는 화면은 절대 캡처해서 올리지 마세요!</Text>
              </li>
              <li>
                <strong>최종 확인 필수:</strong> 모든 금액 계산은 정확한 수식으로 프로그램이 직접 하지만, AI가 원본 이미지의 글자 자체를 잘못 읽어내는 실수를 할 때가 종종 있습니다. <strong>추출된 결과물은 꼭 눈으로 한 번 더 확인해 주세요.</strong>
              </li>
              <li>
                <strong>단가 할증 안내:</strong> '단순 물품 품의'의 경우, 실제 발주를 넣을 때 가격이 오를 것을 대비하여 <strong>단가가 자동으로 5% 할증된 후 100원 단위로 올림 처리</strong>되어 나타납니다. 원치 않으시면 표에서 직접 수정하실 수 있습니다.
              </li>
              <li>
                <strong>단가표 기준:</strong> 강사비 단가는 기본적으로 2026학년도 강사수당 지침을 따르고 있습니다.
              </li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
