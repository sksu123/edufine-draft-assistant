import { useMemo, useState } from 'react';
import { Card, Typography, Upload, Button, Table, InputNumber, Input, Row, Col, message, Tag, Tooltip, Modal, Divider } from 'antd';
import { SaveOutlined, DownloadOutlined, PlusOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { DraftGeneratorModal } from '../components/DraftGeneratorModal';
import { BudgetSelector } from '../components/BudgetSelector';
import { extractItemsFromImage, extractItemsFromText } from '../lib/gemini';
import { exportItemsToExcel } from '../lib/excelExport';
import { budgetStore } from '../lib/budgetStore';
import { useScanUpload } from '../hooks/useScanUpload';
import { useBudget } from '../hooks/useBudget';
import { useDraftGuard, buildSignature } from '../hooks/useDraftGuard';
import * as XLSX from 'xlsx';

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
const dupKey = (item: RequestItem) => `${item.item_name.trim()} ${item.specification.trim()}`;
/** 병합 가능 키: 단가까지 같아야 수량 합산이 금액을 바꾸지 않는다 */
const mergeKey = (item: RequestItem) => `${dupKey(item)} ${item.unit_price}`;

export const SimplePurchase = () => {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isTextScanning, setIsTextScanning] = useState(false);
  const [textInput, setTextInput] = useState('');
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

  const processExtractedItems = (parsedItems: any) => {
    const initializedItems: RequestItem[] = [];
    let totalShippingFee = 0;

    (parsedItems as unknown[]).forEach((raw, index: number) => {
      const item = raw as Record<string, unknown>;
      const qty = Math.max(1, toInt(item.quantity, 1));
      const orderPrice = toInt(item.order_price, 0);

      const rawUnitPrice = orderPrice / qty;
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
    message.success('분석 결과를 바탕으로 표를 구성했습니다! 내역을 확인하고 수정해주세요.');
  };

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
      processExtractedItems(parsedItems);
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : '';
      message.error(reason || '이미지 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleTextScan = async () => {
    if (!textInput.trim()) {
      message.warning('텍스트를 입력해주세요.');
      return;
    }
    setIsTextScanning(true);
    message.info('텍스트를 AI로 분석합니다...');
    try {
      const parsedItems = await extractItemsFromText(textInput);
      processExtractedItems(parsedItems);
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : '';
      message.error(reason || '텍스트 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsTextScanning(false);
    }
  };

  const excelUploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file: File) => {
      message.info('엑셀 파일을 읽고 분석합니다...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          
          if (!csv.trim()) {
            message.warning('엑셀 파일에 데이터가 없습니다.');
            return;
          }
          
          const parsedItems = await extractItemsFromText(csv);
          processExtractedItems(parsedItems);
        } catch (error) {
          console.error(error);
          message.error('엑셀 파일 분석에 실패했습니다.');
        }
      };
      reader.onerror = () => {
        message.error('파일을 읽는 중 오류가 발생했습니다.');
      };
      reader.readAsArrayBuffer(file);
      return false; // Prevent auto upload
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
            >
              엑셀(.xlsx) 다운로드
            </Button>
          </div>
        }
        style={{ borderColor: '#1E3A8A' }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>자료 넣기</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 'bold' }}>이미지 업로드</span>} size="small" type="inner" style={{ height: '100%' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: '13px' }}>
                  장바구니 캡처를 올리거나 Ctrl+V로 붙여넣으면 Gemini가 품목을 읽어옵니다.
                </Text>
                <Dragger {...uploadProps} showUploadList={false}>
                  {previewUrl ? (
                    <div style={{ padding: '8px 0' }}>
                      <img
                        src={previewUrl}
                        alt="preview"
                        style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
                      />
                      <p style={{ marginTop: 8, color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '13px' }}>
                        총 {fileList.length}장의 이미지 업로드 됨
                      </p>
                    </div>
                  ) : fileList.length > 0 ? (
                    <div style={{ padding: '16px 0' }}>
                      <p style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '13px' }}>
                        총 {fileList.length}개의 파일 업로드 됨
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 0' }}>
                      <p style={{ color: '#595959', fontWeight: 'bold', fontSize: '14px', marginBottom: 4 }}>
                        + 캡처 이미지 업로드 또는 붙여넣기
                      </p>
                      <p style={{ color: '#8c8c8c', fontSize: '12px', margin: 0 }}>
                        여러 장 가능 • 최대 6장
                      </p>
                    </div>
                  )}
                </Dragger>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 16 }}>
                  <Button
                    type="default"
                    onClick={handleScan}
                    loading={isScanning}
                    disabled={fileList.length === 0}
                    style={{ fontWeight: 'bold' }}
                  >
                    Gemini로 캡처 분석하기
                  </Button>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {fileList.length > 0 ? '준비 완료! 분석을 시작하세요.' : '이미지를 넣으면 분석을 시작할 수 있어요.'}
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 'bold' }}>텍스트 붙여넣기</span>} size="small" type="inner" style={{ height: '100%' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: '13px' }}>
                  쇼핑몰에서 복사한 텍스트를 붙여넣으면 Gemini가 품목으로 정리합니다.
                </Text>
                <Input.TextArea 
                  rows={4} 
                  placeholder="예:&#10;A4 복사용지 80g 1박스 24,900원&#10;클리어파일 40매 3개 12,600원"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <Button type="default" onClick={handleTextScan} loading={isTextScanning} style={{ fontWeight: 'bold' }}>
                  Gemini로 텍스트 분석하기
                </Button>
                
                <Divider style={{ margin: '16px 0', fontSize: 12, color: '#8c8c8c' }}>또는 엑셀로 정리했다면?</Divider>
                
                <Dragger {...excelUploadProps}>
                  <div style={{ padding: '4px 0' }}>
                    <p style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '14px', marginBottom: 4 }}>
                      ↑ 엑셀 파일 업로드 (.xlsx • .xls)
                    </p>
                    <p style={{ color: '#8c8c8c', fontSize: '12px', margin: 0 }}>
                      팀별 정리 파일, 물품신청서 등 어떤 양식이든
                    </p>
                  </div>
                </Dragger>
              </Card>
            </Col>
          </Row>
        </div>

        <Row>
          <Col xs={24}>
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
              style={{ marginTop: 16, height: '54px', fontSize: '16px', fontWeight: 'bold' }}
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
