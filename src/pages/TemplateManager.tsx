import { useState } from 'react';
import {
  Card, Typography, Button, Table, Modal, Form, Input, InputNumber, Space, Tabs,
  message, Alert, Row, Col, Divider,
} from 'antd';
import {
  ProfileOutlined, PlusOutlined, MinusCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { templateStore } from '../lib/templateStore';
import type { SeedScope } from '../lib/templateStore';
import { formatTargetLabel, toNumericClasses, toStoredClasses } from '../lib/templateTypes';
import type { Attachment, DraftTemplate, RelatedDoc, SchoolClass } from '../lib/templateTypes';
import { useTemplates } from '../hooks/useTemplates';
import { TargetPicker } from '../components/TargetPicker';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface TemplateFormValues {
  name: string;
  event_name?: string;
  start_text?: string;
  purpose?: string;
  location?: string;
  relatedDocs?: (RelatedDoc | undefined)[];
  attachments?: (Attachment | undefined)[];
}

const cleanDocs = (rows: (RelatedDoc | undefined)[] = []): RelatedDoc[] => rows
  .filter((d): d is RelatedDoc => Boolean(d && (d.doc_number?.trim() || d.doc_date?.trim())))
  .map((d) => ({ doc_number: d.doc_number ?? '', doc_date: d.doc_date ?? '' }));

const cleanAttachments = (rows: (Attachment | undefined)[] = []): Attachment[] => rows
  .filter((a): a is Attachment => Boolean(a?.filename?.trim()))
  .map((a) => ({ filename: a.filename }));

const confirmReset = (scope: SeedScope, label: string) => Modal.confirm({
  title: `${label} 기본값 복원`,
  content: '현재 목록을 기본 제공 항목으로 되돌립니다. 직접 등록한 내용은 사라집니다.',
  okText: '복원', okType: 'danger', cancelText: '취소',
  onOk: () => {
    templateStore.resetToSeed(scope);
    message.success('기본값으로 되돌렸습니다.');
  },
});

export const TemplateManager = () => {
  const { templates, classes, grades, classCountByGrade, customNamesByGrade } = useTemplates();
  const [form] = Form.useForm<TemplateFormValues>();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGrades, setEditGrades] = useState<number[]>([]);
  const [editClasses, setEditClasses] = useState<Record<number, string[]>>({});

  const [newGrade, setNewGrade] = useState<number | null>(null);
  const [newClassCount, setNewClassCount] = useState<number>(10);
  const [newCustomNames, setNewCustomNames] = useState<string>(''); // comma separated

  // ---------- 템플릿 ----------
  const openEditor = (record?: DraftTemplate) => {
    setEditingId(record?.id ?? null);
    setEditGrades(record?.targetGrades ?? []);
    setEditClasses(record ? toNumericClasses(record.targetClasses) : {});
    form.setFieldsValue({
      name: record?.name ?? '',
      event_name: record?.event_name ?? '',
      start_text: record?.start_text ?? '',
      purpose: record?.purpose ?? '',
      location: record?.location ?? '',
      relatedDocs: record?.relatedDocs ?? [],
      attachments: record?.attachments ?? [],
    });
    setEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    let values: TemplateFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    templateStore.saveTemplate({
      id: editingId ?? undefined,
      name: values.name.trim(),
      event_name: values.event_name?.trim() ?? '',
      start_text: values.start_text ?? '',
      purpose: values.purpose ?? '',
      location: values.location?.trim() ?? '',
      relatedDocs: cleanDocs(values.relatedDocs),
      attachments: cleanAttachments(values.attachments),
      targetGrades: [...editGrades].sort((a, b) => a - b),
      targetClasses: toStoredClasses(editGrades, editClasses),
    });

    setEditorOpen(false);
    message.success(editingId ? '템플릿을 수정했습니다.' : '템플릿을 등록했습니다.');
  };

  const templateTab = (
    <Card
      title={<Text type="secondary" style={{ fontSize: 13 }}>자주 쓰는 품의 내용을 등록해두면 품의서 생성기에서 바로 불러올 수 있습니다.</Text>}
      extra={(
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => confirmReset('templates', '품의 템플릿')}>
            기본값 복원
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            템플릿 추가
          </Button>
        </Space>
      )}
    >
      <Table
        dataSource={templates}
        rowKey="id"
        size="small"
        bordered
        pagination={false}
        scroll={{ x: 1000 }}
        locale={{ emptyText: '등록된 템플릿이 없습니다.' }}
        columns={[
          {
            title: '템플릿명', dataIndex: 'name', width: 160,
            render: (text: string) => <Text strong style={{ color: '#1E3A8A' }}>{text}</Text>,
          },
          { title: '행사명', dataIndex: 'event_name', width: 140, render: (v: string) => v || '-' },
          { title: '시작문구', dataIndex: 'start_text', ellipsis: true, render: (v: string) => v || '-' },
          {
            title: '대상', key: 'target', width: 140,
            render: (_: unknown, record: DraftTemplate) => (
              record.targetGrades.length
                ? formatTargetLabel(record.targetGrades, toNumericClasses(record.targetClasses), grades)
                : '-'
            ),
          },
          {
            title: '관련문서·붙임', key: 'counts', width: 120,
            render: (_: unknown, record: DraftTemplate) => (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.relatedDocs.length}건 · {record.attachments.length}건
              </Text>
            ),
          },
          {
            title: '관리', key: 'action', width: 120,
            render: (_: unknown, record: DraftTemplate) => (
              <Space size={0}>
                <Button type="link" size="small" onClick={() => openEditor(record)}>수정</Button>
                <Button
                  type="link" size="small" danger
                  onClick={() => Modal.confirm({
                    title: '템플릿을 삭제할까요?',
                    content: `'${record.name}'을(를) 삭제합니다.`,
                    okText: '삭제', okType: 'danger', cancelText: '취소',
                    onOk: () => templateStore.removeTemplate(record.id),
                  })}
                >
                  삭제
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );

  // ---------- 학년·학급 ----------
  const addGrade = () => {
    if (newGrade === null || newGrade < 0) return;
    const customNames = newGrade === 0 && newCustomNames.trim() ? newCustomNames.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    templateStore.upsertSchoolClass(newGrade, newClassCount, customNames);
    setNewGrade(null);
    setNewCustomNames('');
    message.success(`${newGrade === 0 ? '유치원' : newGrade + '학년'}을 저장했습니다.`);
  };

  const classTab = (
    <Card
      title={<Text type="secondary" style={{ fontSize: 13 }}>품의서 생성기의 '대상' 선택에 쓰입니다. 유치원은 학년을 0으로 입력하세요.</Text>}
      extra={(
        <Button icon={<ReloadOutlined />} onClick={() => confirmReset('classes', '학년·학급')}>
          기본값 복원
        </Button>
      )}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="여기 등록된 학년을 모두 선택하고 반을 하나도 고르지 않으면 대상이 '전원'으로 표기됩니다."
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <InputNumber
          min={0} max={12} placeholder="학년 (0=유치원)"
          value={newGrade} onChange={(v) => setNewGrade(v)} style={{ width: 130 }}
        />
        {newGrade === 0 ? (
          <Input 
            placeholder="반 이름 쉼표(,) 구분" 
            value={newCustomNames} 
            onChange={(e) => setNewCustomNames(e.target.value)} 
            style={{ width: 200 }} 
          />
        ) : (
          <InputNumber
            min={1} max={30} placeholder="학급 수"
            value={newClassCount} onChange={(v) => setNewClassCount(v ?? 1)} style={{ width: 110 }}
            addonAfter="반"
          />
        )}
        <Button type="primary" onClick={addGrade} disabled={newGrade === null}>추가 / 수정</Button>
      </Space>

      <Table
        dataSource={classes}
        rowKey="grade"
        size="small"
        bordered
        pagination={false}
        locale={{ emptyText: '등록된 학년이 없습니다.' }}
        columns={[
          { title: '학년', dataIndex: 'grade', width: 100, render: (g: number) => g === 0 ? '유치원' : `${g}학년` },
          {
            title: '학급 정보', dataIndex: 'classCount', width: 260,
            render: (count: number, record: SchoolClass) => (
              record.grade === 0 ? (
                <Input
                  value={record.customNames?.join(', ')}
                  onChange={(e) => {
                    const names = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    templateStore.upsertSchoolClass(record.grade, count, names);
                  }}
                  placeholder="쉼표로 구분 (예: 햇살,달빛)"
                />
              ) : (
                <InputNumber
                  min={1} max={30} value={count} addonAfter="반"
                  onChange={(v) => templateStore.upsertSchoolClass(record.grade, v ?? 1)}
                />
              )
            ),
          },
          {
            title: '관리', key: 'action',
            render: (_: unknown, record: SchoolClass) => (
              <Button
                type="link" size="small" danger
                onClick={() => Modal.confirm({
                  title: '학년을 삭제할까요?',
                  content: `${record.grade === 0 ? '유치원' : record.grade + '학년'}을 대상 선택에서 제외합니다.`,
                  okText: '삭제', okType: 'danger', cancelText: '취소',
                  onOk: () => templateStore.removeSchoolClass(record.grade),
                })}
              >
                삭제
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: '#1E3A8A' }}>
            <ProfileOutlined style={{ marginRight: 8 }} />
            템플릿 등록
          </Title>
          <Text type="secondary">
            등록한 내용은 서버로 전송되지 않고 이 브라우저에만 저장됩니다.
          </Text>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="templates"
        items={[
          { key: 'templates', label: '품의 템플릿', children: templateTab },
          { key: 'classes', label: '학년·학급', children: classTab },
        ]}
      />

      <Modal
        title={editingId ? '템플릿 수정' : '템플릿 추가'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSaveTemplate}
        okText="저장"
        cancelText="취소"
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="템플릿명"
            name="name"
            rules={[{ required: true, message: '템플릿명을 입력하세요' }]}
          >
            <Input placeholder="예: 과학과제연구 물품구입" />
          </Form.Item>

          <Form.Item label="시작문구" name="start_text">
            <TextArea rows={2} placeholder="다음과 같이 물품을 구입하고자 합니다." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="행사명" name="event_name">
                <Input placeholder="비워두면 본문에서 생략됩니다" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="장소" name="location">
                <Input placeholder="예: 본교 과학실" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="목적" name="purpose">
            <TextArea rows={2} placeholder="예: 원활한 교육활동 지원" />
          </Form.Item>

          <Form.Item label="대상">
            <TargetPicker
              grades={grades}
              classCountByGrade={classCountByGrade}
              customNamesByGrade={customNamesByGrade}
              selectedGrades={editGrades}
              selectedClasses={editClasses}
              onChange={(g, c) => { setEditGrades(g); setEditClasses(c); }}
            />
          </Form.Item>

          <Divider titlePlacement="start" plain>관련문서</Divider>
          <Form.List name="relatedDocs">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, 'doc_number']} noStyle>
                      <Input placeholder="문서번호 (예: 기획과-123)" style={{ width: 240 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'doc_date']} noStyle>
                      <Input placeholder="결재일 (예: 2024.03.01.)" style={{ width: 200 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                  관련문서 추가
                </Button>
              </>
            )}
          </Form.List>

          <Divider titlePlacement="start" plain>붙임 파일</Divider>
          <Form.List name="attachments">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, 'filename']} noStyle>
                      <Input placeholder="파일명 (예: 견적서)" style={{ width: 300 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                  붙임 추가
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};
