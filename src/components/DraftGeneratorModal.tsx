import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Space, Row, Col, DatePicker, TimePicker, Typography, message, Divider, Radio } from 'antd';
import { PlusOutlined, MinusCircleOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TargetPicker } from './TargetPicker';
import { useTemplates } from '../hooks/useTemplates';
import { templateStore } from '../lib/templateStore';
import { formatTargetLabel, toNumericClasses, toStoredClasses } from '../lib/templateTypes';
import type { Attachment, DraftTemplate, RelatedDoc } from '../lib/templateTypes';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface DraftGeneratorModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  totalAmount: number;
}

export const DraftGeneratorModal: React.FC<DraftGeneratorModalProps> = ({ open, onCancel, onConfirm, totalAmount }) => {
  const [form] = Form.useForm();

  const { templates, grades, classCountByGrade, customNamesByGrade } = useTemplates();

  const [generatedText, setGeneratedText] = useState('');

  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Record<number, string[]>>({});

  const [regenTick, setRegenTick] = useState(0);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [overwriteId, setOverwriteId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSelectedGrades([]);
      setSelectedClasses({});
      setGeneratedText('');
      form.setFieldsValue({
        template_id: 'manual',
        relatedDocs: [],
        attachments: []
      });
    }
  }, [open, form]);

  useEffect(() => {
    if (open) {
      updateGeneratedText();
    }
  }, [selectedGrades, selectedClasses, regenTick]);

  const applyTemplate = (template: DraftTemplate) => {
    const current = form.getFieldsValue();
    const patch: Record<string, unknown> = {};

    (['event_name', 'start_text', 'purpose', 'location'] as const).forEach((key) => {
      const value = template[key];
      if (value && value.trim()) patch[key] = value;
    });

    if (template.relatedDocs.length > 0) {
      const seen = new Set<string>();
      patch.relatedDocs = [...(current.relatedDocs ?? []), ...template.relatedDocs]
        .filter((d: RelatedDoc | undefined): d is RelatedDoc => Boolean(d && (d.doc_number || d.doc_date)))
        .filter((d) => {
          const key = `${d.doc_number} ${d.doc_date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    if (template.attachments.length > 0) {
      const seen = new Set<string>();
      patch.attachments = [...(current.attachments ?? []), ...template.attachments]
        .filter((a: Attachment | undefined): a is Attachment => Boolean(a?.filename))
        .filter((a) => {
          if (seen.has(a.filename)) return false;
          seen.add(a.filename);
          return true;
        });
    }

    if (template.targetGrades.length > 0) {
      const stored = toNumericClasses(template.targetClasses);
      const nextGrades = template.targetGrades.filter((g) => classCountByGrade.has(g) || customNamesByGrade.has(g));
      const nextClasses: Record<number, string[]> = {};
      nextGrades.forEach((g) => {
        const customNames = customNamesByGrade.get(g);
        const max = classCountByGrade.get(g) ?? 0;
        const currentSelected = stored[g] ?? [];
        if (customNames?.length) {
           nextClasses[g] = currentSelected.filter(c => customNames.includes(c));
        } else {
           nextClasses[g] = currentSelected.filter((c) => {
             const num = Number(c);
             return !isNaN(num) && num >= 1 && num <= max;
           });
        }
      });
      setSelectedGrades(nextGrades);
      setSelectedClasses(nextClasses);
    }

    form.setFieldsValue(patch);
    setRegenTick((t) => t + 1);
  };

  const handleTemplateChange = (value: string) => {
    if (value === 'manual') {
      setRegenTick((t) => t + 1);
      return;
    }
    const template = templates.find((t) => t.id === value);
    if (template) applyTemplate(template);
    else setRegenTick((t) => t + 1);
  };

  const generateTargetString = () => formatTargetLabel(selectedGrades, selectedClasses, grades);

  const updateGeneratedText = () => {
    const values = form.getFieldsValue();
    let lines: string[] = [];

    let sectionNo = 1;

    const docs = ((values.relatedDocs || []) as (RelatedDoc | undefined)[])
      .filter((d): d is RelatedDoc => Boolean(d && (d.doc_number?.trim() || d.doc_date?.trim())));

    if (docs.length === 1) {
      lines.push(`${sectionNo}. 관련: ${docs[0].doc_number}(${docs[0].doc_date})`);
      sectionNo += 1;
    } else if (docs.length > 1) {
      lines.push(`${sectionNo}. 관련: `);
      sectionNo += 1;
      const chars = ['가', '나', '다', '라', '마', '바'];
      docs.forEach((doc, idx) => {
        lines.push(` ${chars[idx] || '?'}. ${doc.doc_number}(${doc.doc_date})`);
      });
    }

    const startText = values.start_text || '';
    if (startText) {
      lines.push(`${sectionNo}. ${startText}`);
      sectionNo += 1;
    }

    const items = [];
    
    if (values.event_name) items.push({ label: '행사명', val: values.event_name });
    
    let timeStr = '';
    const formatWithDay = (d: any) => `${dayjs(d).format('YYYY.MM.DD.')}(${['일', '월', '화', '수', '목', '금', '토'][dayjs(d).day()]})`;

    let startPart = '';
    if (values.date) {
      startPart = formatWithDay(values.date);
      if (values.start_time) startPart += ' ' + dayjs(values.start_time).format('HH:mm');
    }

    let endPart = '';
    if (values.end_date) {
      endPart = formatWithDay(values.end_date);
      if (values.end_time) endPart += ' ' + dayjs(values.end_time).format('HH:mm');
    } else if (values.end_time) {
      endPart = dayjs(values.end_time).format('HH:mm');
    }

    if (startPart && endPart) {
      timeStr = `${startPart} ~ ${endPart}`;
    } else if (startPart) {
      timeStr = startPart;
    }

    if (values.manual_time) {
      timeStr = values.manual_time;
    }
    if (timeStr) items.push({ label: '일시', val: timeStr.trim() });

    if (values.location) items.push({ label: '장소', val: values.location });
    
    const targetStr = generateTargetString();
    if (targetStr) items.push({ label: '대상', val: targetStr });
    
    if (totalAmount > 0) items.push({ label: '금액', val: `${totalAmount.toLocaleString()}원` });
    if (values.purpose) items.push({ label: '목적', val: values.purpose });

    const chars = ['가', '나', '다', '라', '마', '바', '사', '아', '자'];
    items.forEach((item, idx) => {
      lines.push(` ${chars[idx]}. ${item.label}: ${item.val}`);
    });

    const atts = (values.attachments || []).map((a: any) => a.filename).filter(Boolean);
    if (atts.length === 0) {
      if (lines.length > 0) {
        lines[lines.length - 1] += '.  끝.';
      } else {
        lines.push('  끝.');
      }
    } else if (atts.length === 1) {
      lines.push('');
      lines.push(`붙임 ${atts[0]} 1부.  끝.`);
    } else {
      lines.push('');
      atts.forEach((a: string, idx: number) => {
        if (idx === 0) {
          lines.push(`붙임 1. ${a} 1부.`);
        } else if (idx === atts.length - 1) {
          lines.push(`     ${idx + 1}. ${a} 1부.  끝.`);
        } else {
          lines.push(`     ${idx + 1}. ${a} 1부.`);
        }
      });
    }

    setGeneratedText(lines.join('\n'));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    message.success('품의서 본문이 클립보드에 복사되었습니다.');
  };

  const openSaveModal = () => {
    const currentId = form.getFieldValue('template_id');
    const editing = typeof currentId === 'string' && currentId !== 'manual'
      ? templates.find((t) => t.id === currentId)
      : undefined;

    setSaveMode(editing ? 'overwrite' : 'new');
    setOverwriteId(editing?.id);
    setSaveName(editing?.name || form.getFieldValue('event_name') || '');
    setSaveOpen(true);
  };

  const captureTemplate = (name: string, id?: string) => {
    const values = form.getFieldsValue();
    return {
      id,
      name: name.trim(),
      event_name: values.event_name ?? '',
      start_text: values.start_text ?? '',
      purpose: values.purpose ?? '',
      location: values.location ?? '',
      relatedDocs: ((values.relatedDocs ?? []) as (RelatedDoc | undefined)[])
        .filter((d): d is RelatedDoc => Boolean(d && (d.doc_number?.trim() || d.doc_date?.trim())))
        .map((d) => ({ doc_number: d.doc_number ?? '', doc_date: d.doc_date ?? '' })),
      attachments: ((values.attachments ?? []) as (Attachment | undefined)[])
        .filter((a): a is Attachment => Boolean(a?.filename?.trim()))
        .map((a) => ({ filename: a.filename })),
      targetGrades: [...selectedGrades].sort((a, b) => a - b),
      targetClasses: toStoredClasses(selectedGrades, selectedClasses),
    };
  };

  const handleSaveTemplate = () => {
    const name = saveName.trim();
    if (!name) {
      message.warning('템플릿명을 입력해주세요.');
      return;
    }
    const targetId = saveMode === 'overwrite' ? overwriteId : undefined;
    if (saveMode === 'overwrite' && !targetId) {
      message.warning('덮어쓸 템플릿을 선택해주세요.');
      return;
    }

    const saved = templateStore.saveTemplate(captureTemplate(name, targetId));
    form.setFieldsValue({ template_id: saved.id });
    setSaveOpen(false);
    message.success(targetId ? '템플릿을 덮어썼습니다.' : '템플릿으로 저장했습니다.');
  };

  const duplicateName = saveMode === 'new'
    && templates.some((t) => t.name === saveName.trim())
    && saveName.trim() !== '';

  return (
    <Modal
      title="품의서 본문 자동 생성기"
      open={open}
      onCancel={onCancel}
      width={1100}
      footer={[
        <Button key="cancel" onClick={onCancel}>취소</Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
          복사하기
        </Button>,
        <Button key="submit" type="primary" onClick={onConfirm} style={{ background: '#52c41a' }}>
          에듀파인 품의서 초안 확정 완료
        </Button>
      ]}
    >
      <Row gutter={24}>
        <Col span={14} style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '16px' }}>
          <Form form={form} layout="vertical" onValuesChange={updateGeneratedText}>
            
            <Form.Item label="품의 템플릿 선택">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="template_id" noStyle>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    onChange={handleTemplateChange}
                    options={[
                      { label: '직접입력', value: 'manual' },
                      ...templates.map((t) => ({ label: t.name, value: t.id })),
                    ]}
                  />
                </Form.Item>
                <Button icon={<SaveOutlined />} onClick={openSaveModal}>
                  템플릿으로 저장
                </Button>
              </Space.Compact>
            </Form.Item>

            <Divider>1. 관련문서</Divider>
            <Form.List name="relatedDocs">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={[name, 'doc_number']} rules={[{ required: true, message: '문서번호 입력' }]}>
                        <Input placeholder="문서번호 (예: 기획과-123)" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'doc_date']} rules={[{ required: true, message: '결재일 입력' }]}>
                        <Input placeholder="결재일 (예: 2024.03.01.)" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      관련문서 추가
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>

            <Form.Item label="2. 품의 시작문구" name="start_text">
              <TextArea rows={2} placeholder="예: 과학과제연구 실험물품을 구입하고자 합니다." />
            </Form.Item>

            <Divider>가~사. 상세 내역</Divider>
            <Form.Item label="행사명" name="event_name">
              <Input placeholder="행사명이 있는 경우 입력" />
            </Form.Item>

            <Form.Item label="일시 (날짜 및 시간)">
              <Space>
                <Form.Item name="date" noStyle><DatePicker placeholder="시작 날짜" style={{ width: 120 }} /></Form.Item>
                <Form.Item name="start_time" noStyle><TimePicker format="HH:mm" minuteStep={5} placeholder="시작시간" style={{ width: 100 }} /></Form.Item>
                <Text>~</Text>
                <Form.Item name="end_date" noStyle><DatePicker placeholder="종료 날짜" style={{ width: 120 }} /></Form.Item>
                <Form.Item name="end_time" noStyle><TimePicker format="HH:mm" minuteStep={5} placeholder="종료시간" style={{ width: 100 }} /></Form.Item>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Form.Item name="manual_time" noStyle><Input placeholder="수동입력 (예: 2024.05.01. ~ 2024.05.03.)" /></Form.Item>
              </div>
            </Form.Item>

            <Form.Item label="장소" name="location">
              <Input placeholder="장소 입력" />
            </Form.Item>

            <Form.Item label="대상">
              <TargetPicker
                grades={grades}
                classCountByGrade={classCountByGrade}
                customNamesByGrade={customNamesByGrade}
                selectedGrades={selectedGrades}
                selectedClasses={selectedClasses}
                onChange={(g, c) => { setSelectedGrades(g); setSelectedClasses(c); }}
              />
            </Form.Item>

            <Form.Item label="총 금액">
              <Input value={`${totalAmount.toLocaleString()}원`} readOnly style={{ background: '#f5f5f5' }} />
            </Form.Item>

            <Form.Item label="목적" name="purpose">
              <TextArea rows={2} placeholder="목적 입력" />
            </Form.Item>

            <Divider>붙임 파일</Divider>
            <Form.List name="attachments">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={[name, 'filename']} rules={[{ required: true, message: '파일명 입력' }]} style={{ width: 300 }}>
                        <Input placeholder="파일명 (예: 견적서)" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      붙임 파일 추가
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>

          </Form>
        </Col>

        <Col span={10}>
          <div style={{ position: 'sticky', top: 0 }}>
            <Title level={5}>미리보기 (에듀파인 복사용)</Title>
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              minHeight: '400px',
              border: '1px solid #d9d9d9',
              whiteSpace: 'pre-wrap',
              fontFamily: 'Gulim, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              {generatedText || '왼쪽 양식을 채우면 이곳에 품의서 본문이 완성됩니다.'}
            </div>
          </div>
        </Col>
      </Row>

      <Modal
        title="현재 내용을 템플릿으로 저장"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={handleSaveTemplate}
        okText="저장"
        cancelText="취소"
        width={520}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          날짜·시간은 매번 달라지므로 저장하지 않습니다.
        </Text>

        <Radio.Group
          value={saveMode}
          onChange={(e) => setSaveMode(e.target.value)}
          style={{ display: 'block', margin: '16px 0 12px' }}
        >
          <Radio value="new">새 템플릿으로 저장</Radio>
          <Radio value="overwrite" disabled={templates.length === 0}>기존 템플릿 덮어쓰기</Radio>
        </Radio.Group>

        {saveMode === 'overwrite' && (
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="덮어쓸 템플릿을 선택하세요."
            value={overwriteId}
            onChange={(value) => {
              setOverwriteId(value);
              const found = templates.find((t) => t.id === value);
              if (found) setSaveName(found.name);
            }}
            options={templates.map((t) => ({ label: t.name, value: t.id }))}
          />
        )}

        <Input
          autoFocus
          placeholder="템플릿명 (예: 과학과제연구 물품구입)"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onPressEnter={handleSaveTemplate}
        />
        {duplicateName && (
          <Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            같은 이름의 템플릿이 이미 있습니다. 그대로 저장하면 두 개가 됩니다.
          </Text>
        )}
      </Modal>
    </Modal>
  );
};
