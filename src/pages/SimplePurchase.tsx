import { useMemo, useState } from 'react';
import { Card, Typography, Upload, Button, Table, InputNumber, Input, Row, Col, message, Tag, Tooltip, Modal } from 'antd';
import { InboxOutlined, ScanOutlined, SaveOutlined, DownloadOutlined, PlusOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { DraftGeneratorModal } from '../components/DraftGeneratorModal';
import { BudgetSelector } from '../components/BudgetSelector';
import { extractItemsFromImage } from '../lib/gemini';
import { exportItemsToExcel } from '../lib/excelExport';
import { budgetStore } from '../lib/budgetStore';
import { useScanUpload } from '../hooks/useScanUpload';
import { useBudget } from '../hooks/useBudget';
import { useDraftGuard, buildSignature } from '../hooks/useDraftGuard';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface RequestItem {
  id: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

const toInt = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
};

/** 품명+규격 기준 중복 판별 키 */
const dupKey = (item: RequestItem) => `${item.item_name.trim()}${item.specification.trim()}`;
/** 병합 가능 키: 단가까지 같아야 수량 합산이 금액을 바꾸지 않는다 */
const mergeKey = (item: RequestItem) => `${dupKey(item)}${item.unit_price}`;

export const SimplePurchase = () => {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const { fileList, uploadProps, previewUrl, getFiles } = useScanUpload();
  const { selectedItem } = useBudget();
  const guard = useDraftGuard();

  const calculateTotal = (currentItems: RequestItem[]) =>
    currentItems.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
  const totalAmount = calculateTotal(items);

  // 품명+규격이 겹치는 행 표시용 카운트
  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = dupKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [items]);

  // 병합 시 사라질 행 수 (단가까지 동일한 행끼리만 합칠 수 있다)
  const mergeableCount = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = mergeKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let removable = 0;
    counts.forEach((count) => { if (count > 1) removable += count - 1; });
    return removable;
  }, [items]);

  const handleScan = async () => {
    if (fileList.length === 0) {
      message.warning('장바구니 이미지를 1장 이상 업로드해주세요.');
      return;
    }

    setIsScanning(true);
    message.info(`총 ${fileList.length}장의 이미지를 AI로 분석합니다...`);

    try {
      const files = getFiles();
      if (files.length === 0) {
        message.error('유효한 이미지 파일이 없습니다. 다시 업로드해주세요.');
        setIsScanning(false);
        return;
      }
      const parsedItems = await extractItemsFromImage(files);

      const initializedItems: RequestItem[] = [];
      let totalShippingFee = 0;

      (parsedItems as unknown[]).forEach((raw, index: number) => {
        const item = raw as Record<string, unknown>;
        const qty = Math.max(1, toInt(item.quantity, 1));
        const orderPrice = toInt(item.order_price, 0);

        const rawUnitPrice = orderPrice / qty;
        // 가격 변동성 반영: 5% 할증 후 100원 단위 올림
        const unitPrice = Math.ceil((rawUnitPrice * 1.05) / 100) * 100;

        const fee = toInt(item.shipping_fee, 0);
        if (fee > 0) totalShippingFee += fee;

        initializedItems.push({
          id: `${Date.now()}-${index}`,
          item_name: typeof item.name === 'string' && item.name ? item.name : '품명 미상',
          specification: typeof item.specification === 'string' ? item.specification : '',
          quantity: qty,
          unit_price: unitPrice,
          amount: qty * unitPrice,
        });
      });

      if (totalShippingFee > 0) {
        initializedItems.push({
          id: `${Date.now()}-shipping`,
          item_name: '배송비',
          specification: '',
          quantity: 1,
          unit_price: totalShippingFee,
          amount: totalShippingFee,
        });
      }

      setItems(initializedItems);
      message.success('여러 장의 영수증 분석 결과를 하나로 병합 완료! 표를 확인하고 수정해주세요.');
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : '';
      message.error(reason || '이미지 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleItemChange = (id: string, field: keyof RequestItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const handleAddRow = () => {
    setItems([...items, {
      id: `manual-${Date.now()}`,
      item_name: '',
      specification: '',
      quantity: 1,
      unit_price: 0,
      amount: 0,
    }]);
  };

  const handleDeleteRow = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleMergeDuplicates = () => {
    Modal.confirm({
      title: '중복 항목 합치기',
      content: `품명·규격·단가가 모두 같은 ${mergeableCount}개 행을 수량을 합산해 한 행으로 묶습니다. 총액은 변하지 않습니다.`,
      okText: '합치기',
      cancelText: '취소',
      onOk: () => {
        const merged: RequestItem[] = [];
        const indexByKey = new Map<string, number>();

        items.forEach((item) => {
          const key = mergeKey(item);
          const existingIndex = indexByKey.get(key);
          if (existingIndex === undefined) {
            indexByKey.set(key, merged.length);
            merged.push({ ...item });
          } else {
            const target = merged[existingIndex];
            target.quantity += item.quantity;
            target.amount = target.quantity * target.unit_price;
          }
        });

        setItems(merged);
        message.success('중복 항목을 합쳤습니다.');
      },
    });
  };

  const draftSignature = () => buildSignature(
    items.map(i => ({ n: i.item_name, s: i.specification, q: i.quantity, p: i.unit_price })),
  );

  const handleSave = async () => {
    if (!(await guard.check(draftSignature(), totalAmount))) return;
    setIsDraftModalOpen(true);
  };

  const handleDraftConfirmed = () => {
    setIsDraftModalOpen(false);
    guard.markSubmitted(draftSignature());

    if (selectedItem) {
      const head = items[0]?.item_name || '물품';
      budgetStore.addPending({
        item: selectedItem,
        amount: totalAmount,
        source: 'SIMPLE',
        title: items.length > 1 ? `${head} 외 ${items.length - 1}건` : head,
      });
      message.success('품의 초안 생성 완료. 예산에 품의 대기액으로 기록했습니다.');
    } else {
      message.success('품의 초안 생성이 완료되었습니다.');
      message.info('예산 항목을 선택하지 않아 차감 기록은 남기지 않았습니다.');
    }
  };

  const columns = [
    {
      title: '품명 (직접 수정 가능)',
      dataIndex: 'item_name',
      render: (text: string, record: RequestItem) => {
        const isDuplicate = (duplicateCounts.get(dupKey(record)) ?? 0) > 1;
        const needsSpec = isDuplicate && record.specification.trim() === '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Input value={text} onChange={(e) => handleItemChange(record.id, 'item_name', e.target.value)} />
            {isDuplicate && (
              <Tooltip title={needsSpec
                ? '품명이 같은 행이 또 있는데 규격/옵션이 비어 있습니다. 어떤 옵션인지 직접 채워주세요.'
                : '품명과 규격이 완전히 같은 행이 또 있습니다. 의도한 것인지 확인하세요.'}>
                <Tag color="orange" style={{ margin: 0, flexShrink: 0 }}>
                  {needsSpec ? '규격 확인' : '중복'}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: '규격/옵션',
      dataIndex: 'specification',
      width: '160px',
      render: (text: string, record: RequestItem) => (
        <Input
          value={text}
          placeholder="색상, 사이즈 등"
          onChange={(e) => handleItemChange(record.id, 'specification', e.target.value)}
        />
      ),
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      render: (val: number, record: RequestItem) => (
        <InputNumber min={1} value={val} onChange={(v) => handleItemChange(record.id, 'quantity', v || 0)} />
      ),
    },
    {
      title: '단가(원)',
      dataIndex: 'unit_price',
      render: (val: number, record: RequestItem) => (
        <InputNumber min={0} step={100} value={val} onChange={(v) => handleItemChange(record.id, 'unit_price', v || 0)} style={{ width: '100px' }} />
      ),
    },
    {
      title: '항목 총액(원)',
      dataIndex: 'amount',
      render: (val: number) => <Text strong>{val.toLocaleString()}원</Text>,
    },
    {
      title: '관리',
      key: 'action',
      render: (_: unknown, record: RequestItem) => (
        <Button danger type="text" onClick={() => handleDeleteRow(record.id)}>삭제</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', maxWidth: '100%' }}>
      <BudgetSelector plannedAmount={totalAmount} />
      <Card
        title={
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <Title level={4} style={{ margin: 0, color: '#1E3A8A' }}>🛒 단순 물품 품의 자동화</Title>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => exportItemsToExcel(items)}
              disabled={items.length === 0}
              style={{ background: '#3f8600' }}
            >
              엑셀(.xlsx) 다운로드
            </Button>
          </div>
        }
        style={{ borderColor: '#1E3A8A' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Dragger {...uploadProps} showUploadList={false}>
              {previewUrl ? (
                <div style={{ padding: '16px 0' }}>
                  <img
                    src={previewUrl}
                    alt="preview"
                    style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '4px' }}
                  />
                  <p style={{ marginTop: 12, color: '#1E3A8A', fontWeight: 'bold' }}>
                    총 {fileList.length}장의 이미지 업로드 됨
                  </p>
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    (클릭하거나 드래그하여 파일 다시 선택)
                  </p>
                </div>
              ) : fileList.length > 0 ? (
                <div style={{ padding: '16px 0' }}>
                  <p style={{ color: '#1E3A8A', fontWeight: 'bold' }}>
                    총 {fileList.length}개의 파일 업로드 됨
                  </p>
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    (클릭하거나 드래그하여 파일 다시 선택)
                  </p>
                </div>
              ) : (
                <>
                  <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1E3A8A' }} /></p>
                  <p className="ant-upload-text">장바구니 캡처 이미지를 올리거나<br /><strong style={{ color: '#1E3A8A' }}>Ctrl+V (붙여넣기)</strong> 하세요</p>
                </>
              )}
            </Dragger>
            <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: '8px' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: '8px', color: '#166534', fontWeight: 'bold' }}>
                ✅ AI 항목 자동 추출 기능이 준비되었습니다!
              </Text>
              <Button
                type="primary"
                icon={<ScanOutlined />}
                block
                size="large"
                style={{ background: '#1E3A8A', height: '50px', fontSize: '16px' }}
                onClick={handleScan}
                loading={isScanning}
                disabled={fileList.length === 0}
              >
                AI 스캔 시작 (총 {fileList.length}장 병합)
              </Button>
            </div>
          </Col>

          <Col xs={24} lg={16}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Text strong style={{ color: '#cf1322' }}>※ AI 추출 결과입니다. 내역을 확인하고 직접 수정하세요.</Text>
              {mergeableCount > 0 && (
                <Button size="small" icon={<MergeCellsOutlined />} onClick={handleMergeDuplicates}>
                  중복 항목 합치기 ({mergeableCount}건)
                </Button>
              )}
            </div>

            <Table
              columns={columns}
              dataSource={items}
              rowKey="id"
              pagination={false}
              bordered
              scroll={{ x: 900 }}
              footer={() => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />} style={{ width: '150px' }}>
                    수기 행 추가
                  </Button>
                  <Text strong style={{ fontSize: '16px' }}>총액: {totalAmount.toLocaleString()}원</Text>
                </div>
              )}
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<SaveOutlined />}
              style={{ marginTop: 16, background: '#3f8600' }}
              disabled={items.length === 0}
              onClick={handleSave}
            >
              기안문 초안 작성하기
            </Button>
          </Col>
        </Row>
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
