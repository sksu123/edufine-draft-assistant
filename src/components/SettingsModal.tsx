import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Typography, Divider, Alert, message } from 'antd';
import { QuestionCircleOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { ApiKeyGuideModal } from './ApiKeyGuideModal';
import { clearAllLocalData } from '../lib/localData';

const { Title, Text } = Typography;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (schoolName: string, apiKey: string) => void;
  onClearApiKey: () => void;
  initialSchoolName: string;
  initialApiKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  onSave,
  onClearApiKey,
  initialSchoolName,
  initialApiKey
}) => {
  const [form] = Form.useForm();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        schoolName: initialSchoolName,
        apiKey: initialApiKey
      });
    }
  }, [open, initialSchoolName, initialApiKey, form]);

  const handleFinish = (values: any) => {
    onSave(values.schoolName, values.apiKey);
    onClose();
  };

  const handleClear = () => {
    Modal.confirm({
      title: '저장된 API 키를 지울까요?',
      content: '이 브라우저에 저장된 키가 삭제됩니다. AI 스캔을 다시 쓰려면 키를 새로 입력해야 합니다. 학교 이름과 예산·템플릿은 그대로 남습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => {
        onClearApiKey();
        form.setFieldValue('apiKey', '');
        message.success('저장된 API 키를 삭제했습니다.');
      },
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '이 브라우저의 내 데이터를 모두 지울까요?',
      icon: <WarningOutlined style={{ color: '#cf1322' }} />,
      width: 520,
      content: (
        <div>
          <p style={{ marginTop: 0 }}>아래 항목이 이 브라우저에서 지워집니다. <Text strong>되돌릴 수 없습니다.</Text></p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>Gemini API 키, 학교 이름</li>
            <li>업로드한 사업관리카드와 품의 대기 기록</li>
            <li>직접 등록한 템플릿·구매처·학년 설정 (기본값으로 돌아갑니다)</li>
          </ul>
          <Text type="secondary" style={{ fontSize: 12 }}>
            이미 내려받은 엑셀 파일과 복사해 둔 본문은 지워지지 않습니다.
            지운 뒤 화면이 처음 상태로 다시 시작됩니다.
          </Text>
        </div>
      ),
      okText: '모두 삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => {
        clearAllLocalData();
        // 스토어가 모듈 싱글턴이라 새로고침해야 화면 상태까지 초기화된다
        window.location.reload();
      },
    });
  };

  return (
    <Modal
      title={<Title level={4} style={{ margin: 0, color: '#1E3A8A' }}>⚙️ 설정 및 API 키 등록</Title>}
      open={open}
      onCancel={onClose}
      footer={null}
      maskClosable={false}
      width={600}
    >
      <Alert
        message="Gemini API 키가 필요합니다."
        description="이 도구는 기안문 작성을 도와주기 위해 Google의 인공지능(Gemini)을 사용합니다. AI 기능을 사용하려면 선생님 개인의 무료 API 키를 등록해야 합니다. 입력하신 키는 서버로 전송되지 않고 현재 브라우저(내 PC)에만 안전하게 저장됩니다."
        type="info"
        showIcon
        style={{ marginBottom: 24, marginTop: 16 }}
      />
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
      >
        <Form.Item
          name="schoolName"
          label={<Text strong>학교 이름</Text>}
          rules={[{ required: true, message: '학교 이름을 입력해주세요.' }]}
        >
          <Input placeholder="예: ○○고등학교" size="large" />
        </Form.Item>

        <Form.Item
          name="apiKey"
          label={
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text strong>Gemini API 키</Text>
                <Button
                  type="link"
                  size="small"
                  icon={<QuestionCircleOutlined />}
                  onClick={() => setIsGuideOpen(true)}
                  style={{ paddingRight: 0, fontWeight: 'normal' }}
                >
                  발급 방법 자세히 보기
                </Button>
              </div>
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                아직 키가 없다면 위 안내를 따라 무료로 발급받으세요. 1~2분이면 됩니다.
              </Text>
            </div>
          }
          rules={[{ required: true, message: 'API 키를 입력해주세요.' }]}
        >
          <Input.Password placeholder="AIzaSy..." size="large" />
        </Form.Item>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          {initialApiKey ? (
            <Button danger icon={<DeleteOutlined />} onClick={handleClear} size="large">
              저장된 키 삭제
            </Button>
          ) : <span />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={onClose} size="large">취소</Button>
            <Button type="primary" htmlType="submit" size="large" style={{ background: '#1E3A8A' }}>
              저장하기
            </Button>
          </div>
        </div>
      </Form>

      <Divider style={{ margin: '20px 0 12px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          공용 PC에서 쓰셨다면 자리를 뜨기 전에 정리해주세요.
        </Text>
        <Button type="link" danger size="small" onClick={handleClearAll} style={{ padding: 0 }}>
          이 브라우저의 내 데이터 모두 지우기
        </Button>
      </div>

      <ApiKeyGuideModal open={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </Modal>
  );
};
