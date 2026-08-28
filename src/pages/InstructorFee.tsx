import { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, InputNumber, Input, Row, Col, Select, message } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { DraftGeneratorModal } from '../components/DraftGeneratorModal';
import { BudgetSelector } from '../components/BudgetSelector';
import { budgetStore } from '../lib/budgetStore';
import { useBudget } from '../hooks/useBudget';
import { useDraftGuard, buildSignature } from '../hooks/useDraftGuard';
import { rateStore } from '../lib/rateStore';
import type { RateItem } from '../lib/rateStore';

const { Title, Text } = Typography;

interface LectureSession {
  id: string;
  day_label: string;
  hours: number;
  manuscript_type: string;
  manuscript_pages: number;
  calculated_fee: number;
}

interface InstructorGroup {
  id: string;
  name: string;
  category_id: string;
  sessions: LectureSession[];
}

interface FlatRecord {
  key: string;
  groupId: string;
  name: string;
  category_id: string;
  rowSpan: number;
  
  sessionId: string;
  day_label: string;
  hours: number;
  manuscript_type: string;
  manuscript_pages: number;
  calculated_fee: number;
}

export const InstructorFee = () => {
  const [rates, setRates] = useState<RateItem[]>([]);
  const [msRates, setMsRates] = useState<RateItem[]>([]);
  const [instructors, setInstructors] = useState<InstructorGroup[]>([]);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const { selectedItem } = useBudget();
  const guard = useDraftGuard();

  useEffect(() => {
    const update = () => {
      const snap = rateStore.getSnapshot();
      setRates(snap.instructorRates);
      setMsRates(snap.manuscriptRates);
    };
    update();
    return rateStore.subscribe(update);
  }, []);

  const calculateInstructorFee = (categoryId: string, hours: number) => {
    const rate = rates.find(r => r.id === categoryId);
    if (!rate || hours <= 0) return 0;
    if (hours === 1) return rate.base_rate;
    return rate.base_rate + (rate.excess_rate * (hours - 1));
  };

  const calculateManuscriptFee = (typeId: string, pages: number, hours: number) => {
    if (typeId === 'NONE' || pages <= 0 || hours <= 0) return 0;
    
    const rate = msRates.find(r => r.id === typeId);
    if (!rate) return 0;

    let maxPagesPerHour = 0;
    
    if (rate.category.includes('A4')) {
      maxPagesPerHour = 2.5;
    } else if (rate.category.includes('PPT')) {
      maxPagesPerHour = 9;
    } else {
      maxPagesPerHour = 5; // default
    }
    
    const maxAllowedPages = maxPagesPerHour * hours;
    const billablePages = Math.min(pages, maxAllowedPages);
    return billablePages * rate.base_rate;
  };

  const calculateTotalFee = (categoryId: string, hours: number, msType: string, msPages: number) => {
    return calculateInstructorFee(categoryId, hours) + calculateManuscriptFee(msType, msPages, hours);
  };

  const handleAddInstructor = () => {
    if (rates.length === 0) return;
    setInstructors([...instructors, { 
      id: Date.now().toString(), 
      name: '', 
      category_id: rates[0].id, 
      sessions: [{
        id: Date.now().toString() + '_1',
        day_label: '1일차',
        hours: 1,
        manuscript_type: 'NONE',
        manuscript_pages: 0,
        calculated_fee: calculateTotalFee(rates[0].id, 1, 'NONE', 0)
      }]
    }]);
  };

  const handleAddSession = (groupId: string) => {
    const newData = instructors.map(inst => {
      if (inst.id === groupId) {
        const nextDay = inst.sessions.length + 1;
        const newSession: LectureSession = {
          id: Date.now().toString() + '_' + nextDay,
          day_label: `${nextDay}일차`,
          hours: 1,
          manuscript_type: 'NONE',
          manuscript_pages: 0,
          calculated_fee: calculateTotalFee(inst.category_id, 1, 'NONE', 0)
        };
        return { ...inst, sessions: [...inst.sessions, newSession] };
      }
      return inst;
    });
    setInstructors(newData);
  };

  const handleInstructorChange = (groupId: string, field: 'name' | 'category_id', value: any) => {
    const newData = instructors.map(inst => {
      if (inst.id === groupId) {
        const updatedInst = { ...inst, [field]: value };
        if (field === 'category_id') {
          updatedInst.sessions = updatedInst.sessions.map(sess => ({
            ...sess,
            calculated_fee: calculateTotalFee(value, sess.hours, sess.manuscript_type, sess.manuscript_pages)
          }));
        }
        return updatedInst;
      }
      return inst;
    });
    setInstructors(newData);
  };

  const handleSessionChange = (groupId: string, sessionId: string, field: keyof LectureSession, value: any) => {
    const newData = instructors.map(inst => {
      if (inst.id === groupId) {
        const updatedSessions = inst.sessions.map(sess => {
          if (sess.id === sessionId) {
            const updatedSess = { ...sess, [field]: value };
            if (['hours', 'manuscript_type', 'manuscript_pages'].includes(field)) {
               updatedSess.calculated_fee = calculateTotalFee(inst.category_id, updatedSess.hours, updatedSess.manuscript_type, updatedSess.manuscript_pages);
            }
            return updatedSess;
          }
          return sess;
        });
        return { ...inst, sessions: updatedSessions };
      }
      return inst;
    });
    setInstructors(newData);
  };

  const handleDeleteSession = (groupId: string, sessionId: string) => {
    const newData = instructors.map(inst => {
      if (inst.id === groupId) {
        return { ...inst, sessions: inst.sessions.filter(s => s.id !== sessionId) };
      }
      return inst;
    }).filter(inst => inst.sessions.length > 0); 
    setInstructors(newData);
  };

  const flatData: FlatRecord[] = [];
  instructors.forEach(inst => {
    inst.sessions.forEach((sess, sessIdx) => {
      flatData.push({
        key: sess.id,
        groupId: inst.id,
        name: inst.name,
        category_id: inst.category_id,
        rowSpan: sessIdx === 0 ? inst.sessions.length : 0,
        sessionId: sess.id,
        day_label: sess.day_label,
        hours: sess.hours,
        manuscript_type: sess.manuscript_type,
        manuscript_pages: sess.manuscript_pages,
        calculated_fee: sess.calculated_fee,
      });
    });
  });

  const totalAmount = flatData.reduce((acc, curr) => acc + curr.calculated_fee, 0);

  const draftSignature = () => buildSignature(
    instructors.map(group => ({
      c: group.category_id,
      s: group.sessions.map(sess => [sess.hours, sess.manuscript_type, sess.manuscript_pages]),
    })),
  );

  const handleSave = async () => {
    if (!(await guard.check(draftSignature(), totalAmount))) return;
    setIsDraftModalOpen(true);
  };

  const handleDraftConfirmed = () => {
    setIsDraftModalOpen(false);
    guard.markSubmitted(draftSignature());

    if (selectedItem) {
      const sessionCount = instructors.reduce((acc, group) => acc + group.sessions.length, 0);
      budgetStore.addPending({
        item: selectedItem,
        amount: totalAmount,
        source: 'INSTRUCTOR',
        title: `강사비 ${instructors.length}명 / ${sessionCount}회`,
      });
      message.success('강사비 품의 초안 생성 완료. 예산에 품의 대기액으로 기록했습니다.');
    } else {
      message.success('품의 초안 생성이 완료되었습니다.');
      message.info('예산 항목을 선택하지 않아 차감 기록은 남기지 않았습니다.');
    }
  };

  const columns = [
    {
      title: '강사명',
      dataIndex: 'name',
      width: '150px',
      onCell: (record: FlatRecord) => ({ rowSpan: record.rowSpan }),
      render: (text: string, record: FlatRecord) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Input placeholder="예: 김*수" value={text} onChange={(e) => handleInstructorChange(record.groupId, 'name', e.target.value)} />
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => handleAddSession(record.groupId)}>
            강의일 추가
          </Button>
        </div>
      )
    },
    {
      title: '강사 등급',
      dataIndex: 'category_id',
      width: '130px',
      onCell: (record: FlatRecord) => ({ rowSpan: record.rowSpan }),
      render: (val: string, record: FlatRecord) => {
        return (
          <Select 
            value={val} 
            onChange={(v) => handleInstructorChange(record.groupId, 'category_id', v)}
            options={rates.map(r => ({ 
              value: r.id, 
              label: r.category
            }))}
            style={{ width: '100%' }}
          />
        );
      }
    },
    {
      title: '출강일',
      dataIndex: 'day_label',
      width: '90px',
      render: (text: string, record: FlatRecord) => (
        <Input value={text} onChange={(e) => handleSessionChange(record.groupId, record.sessionId, 'day_label', e.target.value)} />
      )
    },
    {
      title: '강의(시)',
      dataIndex: 'hours',
      width: '80px',
      render: (val: number, record: FlatRecord) => (
        <InputNumber min={1} value={val} onChange={(v) => handleSessionChange(record.groupId, record.sessionId, 'hours', v || 1)} style={{ width: '100%' }} />
      )
    },
    {
      title: '원고 구분',
      dataIndex: 'manuscript_type',
      width: '110px',
      render: (val: string, record: FlatRecord) => (
        <Select 
          value={val} 
          onChange={(v) => handleSessionChange(record.groupId, record.sessionId, 'manuscript_type', v)}
          options={[
            { label: '없음', value: 'NONE' },
            ...msRates.map(r => ({ label: r.category, value: r.id }))
          ]}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '페이지',
      dataIndex: 'manuscript_pages',
      width: '80px',
      render: (val: number, record: FlatRecord) => (
        <InputNumber 
          min={0} 
          disabled={record.manuscript_type === 'NONE'} 
          value={val} 
          onChange={(v) => handleSessionChange(record.groupId, record.sessionId, 'manuscript_pages', v || 0)} 
          style={{ width: '100%' }} 
        />
      )
    },
    {
      title: '일별 산출 수당',
      dataIndex: 'calculated_fee',
      width: '130px',
      render: (val: number, record: FlatRecord) => {
         const msFee = calculateManuscriptFee(record.manuscript_type, record.manuscript_pages, record.hours);
         return (
           <div style={{ display: 'flex', flexDirection: 'column' }}>
             <Text strong style={{ color: '#1E3A8A', fontSize: '14px' }}>{val.toLocaleString()}원</Text>
             {msFee > 0 && <Text type="secondary" style={{ fontSize: '11px' }}>(원고: {msFee.toLocaleString()}원)</Text>}
           </div>
         );
      }
    },
    {
      title: '관리',
      key: 'action',
      width: '60px',
      render: (_: any, record: FlatRecord) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSession(record.groupId, record.sessionId)} />
      )
    }
  ];

  return (
    <div style={{ padding: '32px' }}>
      <BudgetSelector plannedAmount={totalAmount} />
      <Card title={<Title level={4} style={{ margin: 0, color: '#1E3A8A' }}>👨‍🏫 강사비 지출 품의 (마스터 단가 및 원고료 연동형)</Title>} style={{ borderColor: '#1E3A8A' }}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">동일 강사가 여러 날에 걸쳐 출강할 경우, 이름 아래의 [강의일 추가] 버튼을 눌러 일차별로 개별 행을 관리하세요.</Text>
        </div>

        <Button 
          type="primary" 
          block 
          icon={<PlusOutlined />} 
          onClick={handleAddInstructor} 
          style={{ marginBottom: 16, height: '48px', fontSize: '15px', backgroundColor: '#38BDF8', color: '#12304A', fontWeight: 'bold', border: 'none' }}
        >
          + 새 강사 추가하기
        </Button>

        <Table 
          dataSource={flatData} 
          columns={columns} 
          rowKey="key" 
          pagination={false}
          bordered
          size="small"
        />

        <Card size="small" style={{ marginTop: 16, background: '#F5F7FA' }}>
          <Row justify="space-between" align="middle">
            <Col><Text style={{ fontSize: 16 }}>지출 예정 총액:</Text></Col>
            <Col>
              <Text strong style={{ fontSize: 24, color: '#1E3A8A' }}>
                {totalAmount.toLocaleString()}원
              </Text>
            </Col>
          </Row>
        </Card>

        <Button 
          type="primary" 
          size="large" 
          block 
          icon={<SaveOutlined />}
          style={{ marginTop: 16, height: '54px', fontSize: '16px', fontWeight: 'bold' }}
          disabled={instructors.length === 0}
          onClick={handleSave}
        >
          기안문 초안 작성하기
        </Button>
      </Card>
      
      <DraftGeneratorModal
        open={isDraftModalOpen}
        onCancel={() => setIsDraftModalOpen(false)}
        onConfirm={handleDraftConfirmed}
        totalAmount={totalAmount}
      />
    </div>
  );
};
