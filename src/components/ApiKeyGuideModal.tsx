import { Modal, Typography, Alert, Button, Space, Divider } from 'antd';
import { KeyOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

interface ApiKeyGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: '개인 Google 계정으로 로그인합니다',
    body: (
      <>
        학교·교육청 계정(<Text code>@···.go.kr</Text> 등)은 기관 정책으로 막혀 있는 경우가 많습니다.
        <Text strong> 개인 Gmail 계정을 쓰시는 편이 확실합니다.</Text>
      </>
    ),
  },
  {
    title: 'Google AI Studio의 API 키 화면으로 들어갑니다',
    body: (
      <>
        아래 버튼을 누르면 새 창으로 열립니다. 주소는{' '}
        <Text code>aistudio.google.com/apikey</Text> 입니다.
      </>
    ),
  },
  {
    title: '처음이라면 약관에 동의합니다',
    body: '약관 동의를 마치면 필요한 Google Cloud 프로젝트가 자동으로 만들어집니다. 따로 프로젝트를 만들 필요는 없습니다.',
  },
  {
    title: "'API 키 만들기(Create API key)' 버튼을 누릅니다",
    body: '프로젝트를 고르라고 나오면 자동으로 만들어진 것을 그대로 선택하면 됩니다.',
  },
  {
    title: '만들어진 키를 복사합니다',
    body: (
      <>
        <Text code>AIzaSy</Text> 로 시작하는 긴 문자열입니다. 복사 아이콘을 눌러 그대로 복사하세요.
      </>
    ),
  },
  {
    title: '이 앱의 설정 창에 붙여넣고 [저장하기]를 누릅니다',
    body: '이제 AI 스캔 기능을 쓸 수 있습니다. 키는 한 번만 등록하면 됩니다.',
  },
];

export const ApiKeyGuideModal = ({ open, onClose }: ApiKeyGuideModalProps) => (
  <Modal
    title={<Title level={5} style={{ margin: 0, color: '#1E3A8A' }}>🔑 Gemini API 키 발급 방법</Title>}
    open={open}
    onCancel={onClose}
    width={640}
    footer={[
      <Button key="close" onClick={onClose}>닫기</Button>,
      <Button
        key="open"
        type="primary"
        icon={<KeyOutlined />}
        style={{ background: '#1E3A8A' }}
        href={AI_STUDIO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google AI Studio 열기
      </Button>,
    ]}
    styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
  >
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 20 }}
      title="무료로 발급받을 수 있습니다"
      description="신용카드 등록 없이 무료 등급으로 사용할 수 있습니다. 발급에는 보통 1~2분이면 충분합니다."
    />

    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {STEPS.map((step, index) => (
        <div key={step.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
              background: '#1E3A8A', color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 'bold', lineHeight: 1,
            }}
          >
            {index + 1}
          </div>
          <div style={{ flex: 1 }}>
            <Text strong style={{ display: 'block', marginBottom: 2 }}>{step.title}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>{step.body}</Text>
          </div>
        </div>
      ))}
    </Space>

    <Divider style={{ margin: '20px 0 16px' }} />

    <Title level={5} style={{ fontSize: 14, marginTop: 0 }}>알아두실 점</Title>
    <Paragraph style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        · <Text strong>키는 비밀번호처럼 다뤄주세요.</Text> 다른 분께 알려주거나 화면을 공유할 때 노출되지 않도록 주의하세요.
      </Text>
    </Paragraph>
    <Paragraph style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        · 입력한 키는 <Text strong>이 브라우저 안에만</Text> 저장되고 서버로 전송되지 않습니다.
        다만 그렇기 때문에 공용 PC에서는 쓰고 나서 설정 창 왼쪽 아래의{' '}
        <Text strong>[저장된 키 삭제]</Text> 버튼으로 지우시는 편이 안전합니다.
        (입력칸을 비우고 저장하는 방법으로는 지워지지 않습니다.)
      </Text>
    </Paragraph>
    <Paragraph style={{ marginBottom: 8 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        · 브라우저를 바꾸거나 인터넷 사용 기록을 지우면 키가 사라집니다. 그때는 AI Studio에서 기존 키를 다시 복사해 오면 됩니다.
      </Text>
    </Paragraph>
    <Paragraph style={{ marginBottom: 0 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        · 무료 등급은 분당 요청 수에 제한이 있습니다. 이 앱은 요청 간격을 자동으로 조절하므로
        여러 장을 한 번에 올려도 순서대로 처리됩니다. 조금 기다리시면 됩니다.
      </Text>
    </Paragraph>
  </Modal>
);
