import { useMemo, useState } from 'react';
import { Select, Card, Typography, Statistic, Row, Col, Alert, Input, Space } from 'antd';
import { Link } from 'react-router-dom';
import { useBudget } from '../hooks/useBudget';
import { budgetStore } from '../lib/budgetStore';

const { Text } = Typography;

interface BudgetSelectorProps {
  /** 이번 기안의 예정 총액. 잔액 초과 여부 안내에 쓴다. */
  plannedAmount: number;
}

export const BudgetSelector = ({ plannedAmount }: BudgetSelectorProps) => {
  const { hasCard, itemViews, selectedItem, availableBalance } = useBudget();
  const [searchTerm, setSearchTerm] = useState('');

  // 세부사업별로 묶어서 보여준다 (항목이 300개를 넘어 평면 목록은 찾기 어렵다)
  const options = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? itemViews.filter((item) =>
        item.detailName.toLowerCase().includes(term)
        || item.accountName.toLowerCase().includes(term)
        || item.subProjectName.toLowerCase().includes(term))
      : itemViews;

    const groups = new Map<string, { label: string; value: string }[]>();
    filtered.forEach((item) => {
      const groupLabel = item.subProjectName || '기타 사업';
      const label = item.detailName
        ? `[${item.accountName}] ${item.detailName}`
        : item.accountName;
      const bucket = groups.get(groupLabel);
      if (bucket) bucket.push({ label, value: item.id });
      else groups.set(groupLabel, [{ label, value: item.id }]);
    });

    return [...groups.entries()].map(([label, children]) => ({ label, options: children }));
  }, [itemViews, searchTerm]);

  if (!hasCard) {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <Text style={{ fontSize: 13 }}>
            에듀파인 사업관리카드를 올리면 예산 잔액을 함께 확인할 수 있습니다.{' '}
            <Link to="/budget">예산 관리로 이동</Link>
          </Text>
        }
      />
    );
  }

  const isExhausted = selectedItem !== null && availableBalance <= 0;
  const isOverBudget = selectedItem !== null && plannedAmount > 0 && plannedAmount > availableBalance;

  return (
    <Card size="small" style={{ marginBottom: 16, borderColor: '#1E3A8A' }}>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={8} lg={6}>
          <Text strong style={{ color: '#1E3A8A' }}>산출내역 검색:</Text>
          <Input.Search
            placeholder="검색어 입력..."
            allowClear
            style={{ width: '100%', marginTop: 8 }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Col>

        <Col xs={24} md={16} lg={8}>
          <Text strong style={{ color: '#1E3A8A' }}>대상 사업(예산) 선택:</Text>
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="예산을 선택하세요."
            onChange={(value) => budgetStore.selectItem(value ?? null)}
            value={selectedItem?.id}
            options={options}
          />
        </Col>

        {selectedItem && (
          <Col xs={24} lg={10}>
            <Row gutter={[8, 8]}>
              <Col xs={8}>
                <Statistic title="예산현액" value={selectedItem.totalBudget} suffix="원" valueStyle={{ fontSize: 14 }} />
              </Col>
              <Col xs={8}>
                <Statistic
                  title="기집행 (확정+대기)"
                  value={selectedItem.committedAmount + selectedItem.pendingAmount}
                  suffix="원"
                  valueStyle={{ fontSize: 14, color: '#cf1322' }}
                />
              </Col>
              <Col xs={8}>
                <Statistic
                  title="가용 잔액"
                  value={availableBalance}
                  suffix="원"
                  valueStyle={{ fontSize: 14, color: availableBalance < 0 ? '#cf1322' : '#3f8600', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
              {isExhausted && (
                <Alert message="이 항목의 예산이 모두 소진되었습니다." type="error" showIcon />
              )}
              {!isExhausted && isOverBudget && (
                <Alert
                  message={`이번 기안 예정액(${plannedAmount.toLocaleString()}원)이 가용 잔액을 초과합니다.`}
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </Col>
        )}
      </Row>
    </Card>
  );
};
