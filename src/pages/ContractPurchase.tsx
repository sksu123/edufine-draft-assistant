import { useState } from 'react';
import { Card, Typography, Upload, Button, Table, InputNumber, Input, Row, Col, message, Switch, Tooltip, Space, Alert } from 'antd';
import { FilePdfOutlined, ScanOutlined, SaveOutlined, DownloadOutlined } from '@ant-design/icons';
import { DraftGeneratorModal } from '../components/DraftGeneratorModal';
import { BudgetSelector } from '../components/BudgetSelector';
import { extractContractFromImage } from '../lib/gemini';
import { exportItemsToExcel } from '../lib/excelExport';
import { budgetStore } from '../lib/budgetStore';
import { useScanUpload } from '../hooks/useScanUpload';
import { useBudget } from '../hooks/useBudget';
import { useDraftGuard, buildSignature } from '../hooks/useDraftGuard';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface QuoteItem {
  id: string;
  item_name: string;
  specification: string;
  quantity: number;
  unit_price: number;
  is_tax_free: boolean;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
}

interface TotalMismatch {
  docTotal: number;
  rowSum: number;
}

export const ContractPurchase = () => {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isVatIncludedInput, setIsVatIncludedInput] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [totalMismatch, setTotalMismatch] = useState<TotalMismatch | null>(null);
  const { fileList, uploadProps, previewUrl, getFiles } = useScanUpload();
  const { selectedItem } = useBudget();
  const guard = useDraftGuard();

  const calculateItemAmounts = (quantity: number, price: number, isTaxFree: boolean, vatIncluded: boolean, forcedRawTotal?: number) => {
    const rawTotal = (forcedRawTotal !== undefined && forcedRawTotal > 0) ? forcedRawTotal : quantity * price;

    if (isTaxFree) {
      return { supply: rawTotal, vat: 0, total: rawTotal };
    }

    if (vatIncluded) {
      const supply = Math.round(rawTotal / 1.1);
      const vat = rawTotal - supply;
      return { supply, vat, total: rawTotal };
    } else {
      const supply = rawTotal;
      const vat = Math.floor(supply * 0.1);
      return { supply, vat, total: supply + vat };
    }
  };

  const handleScan = async () => {
    if (fileList.length === 0) {
      message.warning('견적서 파일(PDF/이미지)을 업로드해주세요.');
      return;
    }

    setIsScanning(true);
    message.info(`총 ${fileList.length}장의 이미지를 AI로 분석합니다...`);

    try {
      const files = getFiles();
      if (files.length === 0) {
        message.error('유효한 파일이 없습니다. 다시 업로드해주세요.');
        setIsScanning(false);
        return;
      }
      const parsedData = await extractContractFromImage(files);
      const parsedItems = Array.isArray(parsedData) ? parsedData : (parsedData.items || []);
      const totalFromDoc = parsedData.total_amount_from_document || 0;

      if (parsedItems.length === 0 && totalFromDoc > 0) {
        parsedItems.push({
          name: '합계 금액 (상세내역 없음)',
          quantity: 1,
          row_total_amount: totalFromDoc,
        });
      }

      const getRowTotal = (item: Record<string, unknown>) => {
        let rt = typeof item.row_total_amount === 'number' ? item.row_total_amount : 0;
        if (rt === 0) {
          const s = typeof item.supply_amount === 'number' ? item.supply_amount : 0;
          const v = typeof item.vat_amount === 'number' ? item.vat_amount : 0;
          rt = s + v;
        }
        if (rt === 0 && parsedItems.length === 1 && totalFromDoc > 0) {
          rt = totalFromDoc;
        }
        return rt;
      };

      let rawTotalSum = 0;
      parsedItems.forEach((item: Record<string, unknown>) => {
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        let unit_price = typeof item.unit_price === 'number' ? item.unit_price : 0;

        const row_total_amount = getRowTotal(item);
        if (unit_price === 0 && row_total_amount > 0) {
          unit_price = Math.round(row_total_amount / quantity);
        }

        rawTotalSum += (row_total_amount > 0 ? row_total_amount : quantity * unit_price);
      });

      let aiVatIncluded = parsedData.is_vat_included_context === true;
      let mismatch: TotalMismatch | null = null;

      if (totalFromDoc > 0 && rawTotalSum > 0) {
        if (Math.abs(rawTotalSum - totalFromDoc) < 10) {
          aiVatIncluded = true;
        } else if (Math.abs(Math.round(rawTotalSum * 1.1) - totalFromDoc) < 10) {
          aiVatIncluded = false;
        } else {
          // 어느 쪽으로도 맞아떨어지지 않음 = 행 누락이나 오인식 신호
          mismatch = { docTotal: totalFromDoc, rowSum: rawTotalSum };
        }
      }

      setIsVatIncludedInput(aiVatIncluded);
      setTotalMismatch(mismatch);

      const initializedItems = parsedItems.map((item: Record<string, unknown>, index: number) => {
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        let unit_price = typeof item.unit_price === 'number' ? item.unit_price : 0;

        const row_total_amount = getRowTotal(item);
        if (unit_price === 0 && row_total_amount > 0) {
          unit_price = Math.round(row_total_amount / quantity);
        }

        const is_tax_free = (item.vat_amount === 0 && typeof item.supply_amount === 'number' && item.supply_amount > 0);
        const calc = calculateItemAmounts(quantity, unit_price, is_tax_free, aiVatIncluded, row_total_amount);

        return {
          id: `${Date.now()}-${index}`,
          item_name: typeof item.name === 'string' && item.name ? item.name : '품명 미상',
          specification: typeof item.specification === 'string' ? item.specification : '',
          quantity,
          unit_price,
          is_tax_free,
          supply_amount: calc.supply,
          vat_amount: calc.vat,
          total_amount: calc.total,
        };
      });

      setItems(initializedItems);
      message.success('견적서 분석 완료! 부가세 판별 결과를 확인해주세요.');
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : '';
      message.error(reason || '이미지 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleItemChange = (id: string, field: keyof QuoteItem, value: string | number | boolean) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price' || field === 'is_tax_free') {
        const calc = calculateItemAmounts(updated.quantity, updated.unit_price, updated.is_tax_free, isVatIncludedInput);
        updated.supply_amount = calc.supply;
        updated.vat_amount = calc.vat;
        updated.total_amount = calc.total;
      }
      return updated;
    }));
  };

  const handleVatToggle = (checked: boolean) => {
    setIsVatIncludedInput(checked);
    setItems(items.map(item => {
      const calc = calculateItemAmounts(item.quantity, item.unit_price, item.is_tax_free, checked);
      return { ...item, supply_amount: calc.supply, vat_amount: calc.vat, total_amount: calc.total };
    }));
  };

  const totalSupply = items.reduce((acc, curr) => acc + curr.supply_amount, 0);
  const totalVat = items.reduce((acc, curr) => acc + curr.vat_amount, 0);
  const grandTotal = items.reduce((acc, curr) => acc + curr.total_amount, 0);

  const draftSignature = () => buildSignature({
    vatIncluded: isVatIncludedInput,
    rows: items.map(i => ({ n: i.item_name, s: i.specification, q: i.quantity, p: i.unit_price, f: i.is_tax_free })),
  });

  const handleSave = async () => {
    if (!(await guard.check(draftSignature(), grandTotal))) return;
    setIsDraftModalOpen(true);
  };

  const handleDraftConfirmed = () => {
    setIsDraftModalOpen(false);
    guard.markSubmitted(draftSignature());

    if (selectedItem) {
      const head = items[0]?.item_name || '계약';
      budgetStore.addPending({
        item: selectedItem,
        amount: grandTotal,
        source: 'CONTRACT',
        title: items.length > 1 ? `${head} 외 ${items.length - 1}건` : head,
      });
      message.success('계약 품의서 생성 완료. 예산에 품의 대기액으로 기록했습니다.');
    } else {
      message.success('계약 품의서 내역이 성공적으로 생성되었습니다.');
      message.info('예산 항목을 선택하지 않아 차감 기록은 남기지 않았습니다.');
    }
  };

  const columns = [
    {
      title: '품명',
      dataIndex: 'item_name',
      width: '170px',
      render: (text: string, record: QuoteItem) => (
        <Input value={text} onChange={(e) => handleItemChange(record.id, 'item_name', e.target.value)} />
      ),
    },
    {
      title: '규격/사양',
      dataIndex: 'specification',
      width: '150px',
      render: (text: string, record: QuoteItem) => (
        <Input
          value={text}
          placeholder="모델, 사양 등"
          onChange={(e) => handleItemChange(record.id, 'specification', e.target.value)}
        />
      ),
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      width: '80px',
      render: (val: number, record: QuoteItem) => (
        <InputNumber min={1} value={val} onChange={(v) => handleItemChange(record.id, 'quantity', v || 0)} style={{ width: '100%' }} />
      ),
    },
    {
      title: '입력 단가',
      dataIndex: 'unit_price',
      width: '110px',
      render: (val: number, record: QuoteItem) => (
        <InputNumber min={0} step={100} value={val} onChange={(v) => handleItemChange(record.id, 'unit_price', v || 0)} style={{ width: '100%' }} />
      ),
    },
    {
      title: '면세 여부',
      dataIndex: 'is_tax_free',
      width: '90px',
      render: (val: boolean, record: QuoteItem) => (
        <Tooltip title="체크 시 부가세가 0원으로 처리됩니다 (도서 등)">
          <Switch checked={val} onChange={(checked) => handleItemChange(record.id, 'is_tax_free', checked)} />
        </Tooltip>
      ),
    },
    {
      title: '공급가액',
      dataIndex: 'supply_amount',
      width: '110px',
      render: (val: number) => <Text>{val.toLocaleString()}원</Text>,
    },
    {
      title: '세액(VAT)',
      dataIndex: 'vat_amount',
      width: '100px',
      render: (val: number) => <Text>{val.toLocaleString()}원</Text>,
    },
    {
      title: '합계',
      dataIndex: 'total_amount',
      width: '120px',
      render: (val: number) => <Text strong style={{ color: '#1E3A8A' }}>{val.toLocaleString()}원</Text>,
    },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <BudgetSelector plannedAmount={grandTotal} />
      <Card
        title={<Title level={4} style={{ margin: 0, color: '#1E3A8A' }}>📑 견적서 계약 품의 (부가세 연동형)</Title>}
        style={{ borderColor: '#1E3A8A' }}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => exportItemsToExcel(items)}
            disabled={items.length === 0}
            style={{ background: '#3f8600' }}
          >
            엑셀(.xlsx) 다운로드
          </Button>
        }
      >
        <Row gutter={32}>
          <Col span={8}>
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
                  <p className="ant-upload-drag-icon"><FilePdfOutlined style={{ color: '#1E3A8A' }} /></p>
                  <p className="ant-upload-text">견적서를 드래그하거나<br /><strong style={{ color: '#1E3A8A' }}>Ctrl+V (붙여넣기)</strong>로 추가하세요</p>
                  <p className="ant-upload-hint" style={{ fontSize: '12px' }}>비정형 문서의 문맥을 읽어 항목을 추출합니다.</p>
                </>
              )}
            </Dragger>
            <Button
              type="primary"
              icon={<ScanOutlined />}
              block
              size="large"
              style={{ marginTop: 16, background: '#1E3A8A' }}
              onClick={handleScan}
              loading={isScanning}
              disabled={fileList.length === 0}
            >
              AI 견적서 스캔 시작
            </Button>
          </Col>

          <Col span={16}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
              <Col>
                <Text strong style={{ color: '#cf1322' }}>※ 견적서 상의 부가세 포함 여부를 선택하세요.</Text>
              </Col>
              <Col>
                <Switch
                  checkedChildren="단가에 부가세 이미 포함됨"
                  unCheckedChildren="단가 외 부가세 10% 별도 가산"
                  checked={isVatIncludedInput}
                  onChange={handleVatToggle}
                />
              </Col>
            </Row>

            {totalMismatch && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={() => setTotalMismatch(null)}
                style={{ marginBottom: 12 }}
                message="견적서 총액과 항목 합계가 맞지 않습니다"
                description={`문서에 적힌 총액은 ${totalMismatch.docTotal.toLocaleString()}원인데 추출된 항목 합계는 ${totalMismatch.rowSum.toLocaleString()}원입니다. 누락되거나 잘못 인식된 행이 있는지 확인하세요.`}
              />
            )}

            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={false}
              bordered
              size="small"
              scroll={{ x: 1000 }}
            />

            <Card size="small" style={{ marginTop: 16, background: '#F5F7FA' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">공급가액 총액: {totalSupply.toLocaleString()}원</Text>
                    <Text type="secondary">부가세 총액: {totalVat.toLocaleString()}원</Text>
                  </Space>
                </Col>
                <Col>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ fontSize: 14, marginRight: 8 }}>계약(지출) 예정 총액:</Text>
                    <Text strong style={{ fontSize: 24, color: '#1E3A8A' }}>
                      {grandTotal.toLocaleString()}원
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>

            <Button
              type="primary"
              size="large"
              block
              icon={<SaveOutlined />}
              style={{ marginTop: 16, background: '#1E3A8A' }}
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
        totalAmount={grandTotal}
      />
    </div>
  );
};
