import { useMemo, useState } from 'react';
import {
  Card, Typography, Upload, Button, Table, message, Alert, Modal, Tag, Row, Col,
  Input, Progress, Statistic, Space, Checkbox, Select, Tooltip, Empty,
} from 'antd';
import {
  DatabaseOutlined, UploadOutlined, WarningOutlined, DeleteOutlined, SwapOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { parseBudgetCard } from '../lib/budgetCardParser';
import type { ParseResult } from '../lib/budgetCardParser';
import { budgetStore } from '../lib/budgetStore';
import { SOURCE_LABEL, itemLabelOf } from '../lib/budgetTypes';
import type { BudgetItem, PendingRecord } from '../lib/budgetTypes';
import { useBudget } from '../hooks/useBudget';

const { Title, Text } = Typography;
const { Dragger } = Upload;

type DiffStatus = 'NEW' | 'UPDATED' | 'UNCHANGED' | 'REMOVED';

interface DiffRow {
  key: string;
  status: DiffStatus;
  label: string;
  subProjectName: string;
  oldBudget: number;
  newBudget: number;
  oldCommitted: number;
  newCommitted: number;
}

const STATUS_TAG: Record<DiffStatus, { color: string; text: string }> = {
  NEW: { color: 'blue', text: '신규' },
  UPDATED: { color: 'orange', text: '금액 변동' },
  UNCHANGED: { color: 'default', text: '변동 없음' },
  REMOVED: { color: 'red', text: '사라짐' },
};

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('ko-KR');

export const BudgetManager = () => {
  const { hasCard, uploadedAt, sourceFileName, items, itemViews, pendings, orphanPendings } = useBudget();

  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parsedFileName, setParsedFileName] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [relinkTarget, setRelinkTarget] = useState<PendingRecord | null>(null);
  const [relinkItemId, setRelinkItemId] = useState<string | undefined>(undefined);

  // ---------- 업로드 ----------
  const uploadProps: UploadProps = {
    accept: '.xls,.xlsx',
    showUploadList: false,
    maxCount: 1,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseBudgetCard(e.target?.result as ArrayBuffer);
          setParsed(result);
          setParsedFileName(file.name);

          if (result.items.length === 0) {
            Modal.warning({
              title: '데이터를 찾을 수 없습니다 (진단용 알림)',
              width: 800,
              content: (
                <div>
                  <p>엑셀 파일의 구조가 예상과 달라서 데이터를 하나도 읽지 못했습니다.</p>
                  <p>파일의 첫 5줄 내용은 다음과 같습니다:</p>
                  <pre style={{ background: '#f5f5f5', padding: 10, fontSize: 11, overflowX: 'auto' }}>
                    {JSON.stringify(result.headRows, null, 2)}
                  </pre>
                </div>
              ),
            });
          } else {
            message.success(`총 ${result.items.length}개의 예산 항목을 읽었습니다.`);
          }
        } catch (error) {
          console.error(error);
          message.error('엑셀 파일을 파싱하는 중 오류가 발생했습니다. 에듀파인 양식이 맞는지 확인해주세요.');
        }
      };
      reader.readAsArrayBuffer(file);
      return Upload.LIST_IGNORE; // 서버로 보내지 않는다
    },
  };

  // ---------- 변동분 계산 ----------
  const diff = useMemo<DiffRow[]>(() => {
    if (!parsed) return [];
    const currentById = new Map(items.map((item) => [item.id, item]));
    const rows: DiffRow[] = [];

    parsed.items.forEach((next) => {
      const prev = currentById.get(next.id);
      if (!prev) {
        rows.push({
          key: next.id, status: 'NEW', label: itemLabelOf(next), subProjectName: next.subProjectName,
          oldBudget: 0, newBudget: next.totalBudget, oldCommitted: 0, newCommitted: next.committedAmount,
        });
        return;
      }
      const changed = prev.totalBudget !== next.totalBudget
        || prev.committedAmount !== next.committedAmount
        || prev.subProjectName !== next.subProjectName;
      rows.push({
        key: next.id, status: changed ? 'UPDATED' : 'UNCHANGED', label: itemLabelOf(next),
        subProjectName: next.subProjectName,
        oldBudget: prev.totalBudget, newBudget: next.totalBudget,
        oldCommitted: prev.committedAmount, newCommitted: next.committedAmount,
      });
    });

    const nextIds = new Set(parsed.items.map((item) => item.id));
    items.forEach((prev) => {
      if (nextIds.has(prev.id)) return;
      rows.push({
        key: prev.id, status: 'REMOVED', label: itemLabelOf(prev), subProjectName: prev.subProjectName,
        oldBudget: prev.totalBudget, newBudget: 0, oldCommitted: prev.committedAmount, newCommitted: 0,
      });
    });

    return rows;
  }, [parsed, items]);

  const counts = useMemo(() => ({
    NEW: diff.filter((r) => r.status === 'NEW').length,
    UPDATED: diff.filter((r) => r.status === 'UPDATED').length,
    UNCHANGED: diff.filter((r) => r.status === 'UNCHANGED').length,
    REMOVED: diff.filter((r) => r.status === 'REMOVED').length,
  }), [diff]);

  // 사라지는 항목에 걸린 차감 기록 = 커밋 전에 반드시 보여줘야 하는 정보
  const affectedPendings = useMemo(() => {
    const removedIds = new Set(diff.filter((r) => r.status === 'REMOVED').map((r) => r.key));
    return pendings.filter((record) => removedIds.has(record.itemId));
  }, [diff, pendings]);

  const visibleDiff = useMemo(
    () => (showUnchanged ? diff : diff.filter((r) => r.status !== 'UNCHANGED')),
    [diff, showUnchanged],
  );

  const handleCommit = () => {
    if (!parsed || parsed.items.length === 0) return;

    const apply = () => {
      budgetStore.commitCard(parsed.items, parsedFileName);
      setParsed(null);
      setParsedFileName('');
      message.success('예산 장부를 에듀파인 기준으로 갱신했습니다.');
    };

    if (affectedPendings.length > 0) {
      Modal.confirm({
        title: '사라지는 항목에 차감 기록이 있습니다',
        icon: <WarningOutlined style={{ color: '#cf1322' }} />,
        content: (
          <div>
            <p>다음 {affectedPendings.length}건의 차감 기록이 연결을 잃습니다. 기록은 지워지지 않고 목록에 남으며, 다른 항목에 다시 연결할 수 있습니다.</p>
            <ul style={{ paddingLeft: 18 }}>
              {affectedPendings.slice(0, 5).map((record) => (
                <li key={record.id}>{record.itemLabel} — {record.amount.toLocaleString()}원</li>
              ))}
            </ul>
          </div>
        ),
        okText: '그래도 덮어쓰기',
        okType: 'danger',
        cancelText: '취소',
        onOk: apply,
      });
      return;
    }
    apply();
  };

  // ---------- 항목 목록 ----------
  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return itemViews;
    return itemViews.filter((item) =>
      item.detailName.toLowerCase().includes(term)
      || item.accountName.toLowerCase().includes(term)
      || item.subProjectName.toLowerCase().includes(term));
  }, [itemViews, itemSearch]);

  // ---------- 세부사업별 집행률 ----------
  const subProjectSummary = useMemo(() => {
    const buckets = new Map<string, { total: number; committed: number; pending: number }>();
    itemViews.forEach((item) => {
      const key = item.subProjectName || '기타 사업';
      const bucket = buckets.get(key) ?? { total: 0, committed: 0, pending: 0 };
      bucket.total += item.totalBudget;
      bucket.committed += item.committedAmount;
      bucket.pending += item.pendingAmount;
      buckets.set(key, bucket);
    });
    return [...buckets.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [itemViews]);

  // ---------- 차감 기록 ----------
  const orphanIds = useMemo(() => new Set(orphanPendings.map((r) => r.id)), [orphanPendings]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  /** 카드를 다시 올린 뒤에도 남아 있는, 에듀파인에 이미 반영됐을 수 있는 기록 */
  const maybeReflected = useMemo(() => {
    if (!uploadedAt) return new Set<string>();
    const flagged = new Set<string>();
    pendings.forEach((record) => {
      const item = itemById.get(record.itemId);
      if (item && item.committedAmount > 0 && record.createdAt < uploadedAt) flagged.add(record.id);
    });
    return flagged;
  }, [pendings, itemById, uploadedAt]);

  const handleRelink = () => {
    if (!relinkTarget || !relinkItemId) return;
    const item = itemById.get(relinkItemId);
    if (!item) return;
    budgetStore.relinkPending(relinkTarget.id, item);
    setRelinkTarget(null);
    setRelinkItemId(undefined);
    message.success('차감 기록을 다시 연결했습니다.');
  };

  const totalPendingAmount = pendings.reduce((acc, record) => acc + record.amount, 0);

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: '#1E3A8A' }}>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            예산 관리
          </Title>
          <Text type="secondary">
            에듀파인에서 받은 [사업관리카드(예산)] 엑셀을 올려 내 예산 잔액을 확인합니다.
            파일은 서버로 전송되지 않고 이 브라우저에만 저장됩니다.
          </Text>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 1. 업로드 */}
        <Col xs={24} lg={8}>
          <Card title="1. 사업관리카드 업로드" style={{ height: '100%' }}>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon"><UploadOutlined style={{ color: '#1E3A8A' }} /></p>
              <p className="ant-upload-text">사업관리카드 드래그</p>
              <p className="ant-upload-hint" style={{ fontSize: '12px' }}>
                에듀파인에서 다운로드 받은 엑셀(.xls, .xlsx)을 그대로 올려주세요.
              </p>
            </Dragger>

            {hasCard && uploadedAt && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 16 }}
                message={<Text style={{ fontSize: 13 }}>{items.length}개 항목 보관 중</Text>}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {sourceFileName}<br />마지막 업로드: {formatDateTime(uploadedAt)}
                  </Text>
                }
              />
            )}

            {parsed && parsed.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
                message="파싱 경고"
                description={
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12 }}>
                    {parsed.warnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                }
              />
            )}

            {hasCard && (
              <Button
                danger
                block
                style={{ marginTop: 16 }}
                onClick={() => Modal.confirm({
                  title: '예산 카드를 삭제할까요?',
                  content: '차감 기록은 지워지지 않고 남습니다.',
                  okText: '삭제', okType: 'danger', cancelText: '취소',
                  onOk: () => budgetStore.clearCard(),
                })}
              >
                예산 카드 삭제
              </Button>
            )}
          </Card>
        </Col>

        {/* 2. 변동분 미리보기 */}
        <Col xs={24} lg={16}>
          <Card
            title="2. 덮어쓰기 미리보기"
            extra={
              <Space>
                <Checkbox checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)}>
                  변동 없음 함께 보기
                </Checkbox>
                <Button
                  type="primary"
                  disabled={!parsed || parsed.items.length === 0}
                  onClick={handleCommit}
                >
                  예산 장부 덮어쓰기 ({parsed?.items.length ?? 0}개)
                </Button>
              </Space>
            }
          >
            {parsed ? (
              <>
                <Space size={16} wrap style={{ marginBottom: 16 }}>
                  <Text>신규 <Text strong style={{ color: '#1677ff' }}>{counts.NEW}</Text></Text>
                  <Text>금액변동 <Text strong style={{ color: '#fa8c16' }}>{counts.UPDATED}</Text></Text>
                  <Text>변동없음 <Text strong type="secondary">{counts.UNCHANGED}</Text></Text>
                  <Text>사라짐 <Text strong style={{ color: '#cf1322' }}>{counts.REMOVED}</Text></Text>
                </Space>

                {affectedPendings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={`사라지는 항목에 차감 기록 ${affectedPendings.length}건이 연결되어 있습니다.`}
                    description="덮어쓰면 해당 기록은 '매칭 실패'로 표시되며, 아래 목록에서 다른 항목에 다시 연결할 수 있습니다."
                  />
                )}

                <Table
                  dataSource={visibleDiff}
                  rowKey="key"
                  size="small"
                  bordered
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  locale={{ emptyText: '변동된 항목이 없습니다.' }}
                  columns={[
                    {
                      title: '상태', dataIndex: 'status', width: 100,
                      render: (status: DiffStatus) => (
                        <Tag color={STATUS_TAG[status].color}>{STATUS_TAG[status].text}</Tag>
                      ),
                    },
                    {
                      title: '항목', dataIndex: 'label',
                      render: (label: string, row: DiffRow) => (
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{label}</Text>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{row.subProjectName}</div>
                        </div>
                      ),
                    },
                    {
                      title: '예산현액', key: 'budget', width: 200,
                      render: (_: unknown, row: DiffRow) => (
                        row.status === 'UNCHANGED'
                          ? <Text>{row.newBudget.toLocaleString()}원</Text>
                          : (
                            <Space size={4}>
                              <Text delete type="secondary">{row.oldBudget.toLocaleString()}</Text>
                              <span>→</span>
                              <Text strong style={{ color: '#cf1322' }}>{row.newBudget.toLocaleString()}원</Text>
                            </Space>
                          )
                      ),
                    },
                    {
                      title: '원인행위액', key: 'committed', width: 200,
                      render: (_: unknown, row: DiffRow) => (
                        row.status === 'UNCHANGED'
                          ? <Text>{row.newCommitted.toLocaleString()}원</Text>
                          : (
                            <Space size={4}>
                              <Text delete type="secondary">{row.oldCommitted.toLocaleString()}</Text>
                              <span>→</span>
                              <Text strong style={{ color: '#1E3A8A' }}>{row.newCommitted.toLocaleString()}원</Text>
                            </Space>
                          )
                      ),
                    },
                  ]}
                />
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="엑셀 파일을 올리면 지금 저장된 내용과의 차이가 여기에 표시됩니다."
                style={{ padding: '40px 0' }}
              />
            )}
          </Card>
        </Col>

        {/* 3. 예산 항목 목록 */}
        {hasCard && (
          <Col span={24}>
            <Card
              title="3. 예산 항목"
              extra={
                <Input.Search
                  placeholder="산출내역 · 비목 · 세부사업 검색"
                  allowClear
                  style={{ width: 280 }}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
              }
            >
              <Table
                dataSource={filteredItems}
                rowKey="id"
                size="small"
                bordered
                scroll={{ x: 1100 }}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                rowClassName={(record) => (record.availableBalance < 0 ? 'budget-row-negative' : '')}
                columns={[
                  { title: '세부사업', dataIndex: 'subProjectName', width: 150, ellipsis: true },
                  { title: '비목', dataIndex: 'accountName', width: 130, ellipsis: true },
                  { title: '산출내역', dataIndex: 'detailName', ellipsis: true },
                  {
                    title: '예산현액', dataIndex: 'totalBudget', width: 120, align: 'right' as const,
                    render: (v: number) => `${v.toLocaleString()}원`,
                  },
                  {
                    title: (
                      <Tooltip title="에듀파인에서 지출품의만 올라간 금액입니다. 잔액 계산에는 넣지 않습니다.">
                        <span>지출품의 (참고)</span>
                      </Tooltip>
                    ),
                    dataIndex: 'draftedAmount', width: 120, align: 'right' as const,
                    render: (v: number) => <Text type="secondary">{v.toLocaleString()}원</Text>,
                  },
                  {
                    title: '원인행위', dataIndex: 'committedAmount', width: 120, align: 'right' as const,
                    render: (v: number) => `${v.toLocaleString()}원`,
                  },
                  {
                    title: '품의대기 (내 기록)', dataIndex: 'pendingAmount', width: 130, align: 'right' as const,
                    render: (v: number) => (v > 0
                      ? <Text style={{ color: '#fa8c16' }}>{v.toLocaleString()}원</Text>
                      : <Text type="secondary">0원</Text>),
                  },
                  {
                    title: '가용잔액', dataIndex: 'availableBalance', width: 130, align: 'right' as const,
                    render: (v: number) => (
                      <Text strong style={{ color: v < 0 ? '#cf1322' : '#3f8600' }}>{v.toLocaleString()}원</Text>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {/* 4. 세부사업별 집행률 */}
        {hasCard && (
          <Col xs={24} lg={12}>
            <Card title="4. 세부사업별 집행률" style={{ height: '100%' }}>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {subProjectSummary.map((row) => {
                  const percent = row.total > 0 ? Math.round((row.committed / row.total) * 100) : 0;
                  const available = row.total - row.committed - row.pending;
                  return (
                    <div key={row.name} style={{ marginBottom: 16 }}>
                      <Row justify="space-between">
                        <Col><Text strong style={{ fontSize: 13 }}>{row.name}</Text></Col>
                        <Col><Text type="secondary" style={{ fontSize: 12 }}>{percent}%</Text></Col>
                      </Row>
                      <Progress percent={percent} strokeColor="#1E3A8A" showInfo={false} />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        예산 {row.total.toLocaleString()}원 · 가용 {available.toLocaleString()}원
                      </Text>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
        )}

        {/* 5. 품의 대기 기록 */}
        <Col xs={24} lg={hasCard ? 12 : 24}>
          <Card
            title="5. 품의 대기 기록 (내 로컬 기록)"
            style={{ height: '100%' }}
            extra={
              <Space>
                <Statistic
                  value={totalPendingAmount}
                  suffix="원"
                  valueStyle={{ fontSize: 14, color: '#fa8c16' }}
                />
                {pendings.length > 0 && (
                  <Button
                    danger
                    size="small"
                    onClick={() => Modal.confirm({
                      title: '차감 기록을 모두 지울까요?',
                      content: '되돌릴 수 없습니다.',
                      okText: '전체 삭제', okType: 'danger', cancelText: '취소',
                      onOk: () => budgetStore.clearPendings(),
                    })}
                  >
                    전체 초기화
                  </Button>
                )}
              </Space>
            }
          >
            <Table
              dataSource={pendings}
              rowKey="id"
              size="small"
              bordered
              pagination={{ pageSize: 8, showSizeChanger: false }}
              locale={{ emptyText: '아직 기록이 없습니다. 품의 초안을 확정하면 여기에 쌓입니다.' }}
              columns={[
                {
                  title: '일시', dataIndex: 'createdAt', width: 120,
                  render: (iso: string) => <Text style={{ fontSize: 12 }}>{formatDateTime(iso)}</Text>,
                },
                {
                  title: '구분', dataIndex: 'source', width: 90,
                  render: (source: PendingRecord['source']) => <Tag>{SOURCE_LABEL[source]}</Tag>,
                },
                {
                  title: '내용', dataIndex: 'title', ellipsis: true,
                  render: (title: string, record: PendingRecord) => (
                    <div>
                      <Text style={{ fontSize: 13 }}>{title}</Text>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{record.itemLabel}</div>
                      <Space size={4} style={{ marginTop: 2 }}>
                        {orphanIds.has(record.id) && <Tag color="red">매칭 실패</Tag>}
                        {maybeReflected.has(record.id) && (
                          <Tooltip title="이 기록보다 나중에 올린 카드에 원인행위액이 잡혀 있습니다. 에듀파인에 이미 반영된 건이라면 삭제해야 이중으로 차감되지 않습니다.">
                            <Tag color="gold">반영 여부 확인</Tag>
                          </Tooltip>
                        )}
                      </Space>
                    </div>
                  ),
                },
                {
                  title: '금액', dataIndex: 'amount', width: 110, align: 'right' as const,
                  render: (v: number) => <Text strong>{v.toLocaleString()}원</Text>,
                },
                {
                  title: '관리', key: 'action', width: 90,
                  render: (_: unknown, record: PendingRecord) => (
                    <Space size={0}>
                      {hasCard && (
                        <Tooltip title="다른 예산 항목에 연결">
                          <Button
                            type="text"
                            size="small"
                            icon={<SwapOutlined />}
                            onClick={() => { setRelinkTarget(record); setRelinkItemId(undefined); }}
                          />
                        </Tooltip>
                      )}
                      <Tooltip title="기록 삭제 (잔액 원복)">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => Modal.confirm({
                            title: '이 차감 기록을 지울까요?',
                            content: `${record.amount.toLocaleString()}원이 가용 잔액으로 되돌아갑니다.`,
                            okText: '삭제', okType: 'danger', cancelText: '취소',
                            onOk: () => budgetStore.removePending(record.id),
                          })}
                        />
                      </Tooltip>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="차감 기록 다시 연결"
        open={relinkTarget !== null}
        onCancel={() => setRelinkTarget(null)}
        onOk={handleRelink}
        okText="연결"
        cancelText="취소"
        okButtonProps={{ disabled: !relinkItemId }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          기존 연결: {relinkTarget?.itemLabel} ({relinkTarget?.amount.toLocaleString()}원)
        </Text>
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%', marginTop: 12 }}
          placeholder="연결할 예산 항목을 선택하세요."
          value={relinkItemId}
          onChange={setRelinkItemId}
          options={items.map((item: BudgetItem) => ({
            label: `[${item.subProjectName}] ${itemLabelOf(item)}`,
            value: item.id,
          }))}
        />
      </Modal>
    </div>
  );
};
