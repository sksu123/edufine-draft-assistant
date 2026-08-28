import { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Input, InputNumber, Tabs, Row, Col } from 'antd';
import { SettingOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { rateStore } from '../lib/rateStore';
import type { RateItem } from '../lib/rateStore';

const { Title, Text } = Typography;

export const RateSettings = () => {
  const [instructorRates, setInstructorRates] = useState<RateItem[]>([]);
  const [manuscriptRates, setManuscriptRates] = useState<RateItem[]>([]);

  useEffect(() => {
    const update = () => {
      const snap = rateStore.getSnapshot();
      setInstructorRates(snap.instructorRates);
      setManuscriptRates(snap.manuscriptRates);
    };
    update();
    return rateStore.subscribe(update);
  }, []);

  const handleSaveInstructor = (rates: RateItem[]) => {
    rateStore.saveInstructorRates(rates);
  };

  const handleSaveManuscript = (rates: RateItem[]) => {
    rateStore.saveManuscriptRates(rates);
  };

  const renderTable = (data: RateItem[], onSave: (d: RateItem[]) => void) => {
    const updateItem = (id: string, field: keyof RateItem, value: any) => {
      const newData = data.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      onSave(newData);
    };

    const deleteItem = (id: string) => {
      onSave(data.filter((item) => item.id !== id));
    };

    const addItem = () => {
      const newItem: RateItem = { id: Date.now().toString(), category: '새 카테고리', base_rate: 0, excess_rate: 0 };
      onSave([...data, newItem]);
    };

    return (
      <>
        <Table
          dataSource={data}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: '구분', dataIndex: 'category',
              render: (text: string, record: RateItem) => (
                <Input value={text} onChange={(e) => updateItem(record.id, 'category', e.target.value)} />
              ),
            },
            {
              title: '기본 단가 (원)', dataIndex: 'base_rate',
              render: (val: number, record: RateItem) => (
                <InputNumber value={val} min={0} step={1000} onChange={(v) => updateItem(record.id, 'base_rate', v || 0)} style={{ width: '100%' }} />
              ),
            },
            {
              title: '초과 단가 (원)', dataIndex: 'excess_rate',
              render: (val: number, record: RateItem) => (
                <InputNumber value={val} min={0} step={1000} onChange={(v) => updateItem(record.id, 'excess_rate', v || 0)} style={{ width: '100%' }} />
              ),
            },
            {
              title: '관리', key: 'action', width: 80,
              render: (_: unknown, record: RateItem) => (
                <Button type="link" danger onClick={() => deleteItem(record.id)}>삭제</Button>
              ),
            },
          ]}
        />
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addItem} style={{ marginTop: 16 }}>항목 추가</Button>
      </>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: '#1E3A8A' }}>
            <SettingOutlined style={{ marginRight: 8 }} />
            단가 설정
          </Title>
          <Text type="secondary">강사 수당 및 원고료 등 지출 품의에서 사용할 단가를 관리합니다.</Text>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => rateStore.reset()}>
            기본값 복원
          </Button>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'instructor',
            label: '강사 수당',
            children: (
              <Card title={<Text type="secondary">강사 초빙 등에서 사용하는 강사 등급별 수당을 설정합니다.</Text>}>
                {renderTable(instructorRates, handleSaveInstructor)}
              </Card>
            )
          },
          {
            key: 'manuscript',
            label: '원고료',
            children: (
              <Card title={<Text type="secondary">원고 작성 등에서 사용하는 원고료 단가를 설정합니다.</Text>}>
                {renderTable(manuscriptRates, handleSaveManuscript)}
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};
