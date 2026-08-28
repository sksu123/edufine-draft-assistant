import { Button, Checkbox, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';

const { Text } = Typography;

interface TargetPickerProps {
  grades: number[];
  classCountByGrade: Map<number, number>;
  customNamesByGrade: Map<number, string[]>;
  selectedGrades: number[];
  selectedClasses: Record<number, string[]>;
  onChange: (grades: number[], classes: Record<number, string[]>) => void;
}

export const TargetPicker = ({
  grades, classCountByGrade, customNamesByGrade, selectedGrades, selectedClasses, onChange,
}: TargetPickerProps) => {
  if (grades.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 13 }}>
        등록된 학년이 없습니다. <Link to="/templates">템플릿 등록 &gt; 학년·학급</Link>에서 먼저 설정해주세요.
      </Text>
    );
  }

  const toggleGrade = (grade: number, checked: boolean) => {
    const nextGrades = checked
      ? [...selectedGrades, grade]
      : selectedGrades.filter((g) => g !== grade);
    const nextClasses = checked
      ? selectedClasses
      : { ...selectedClasses, [grade]: [] };
    onChange(nextGrades, nextClasses);
  };

  const toggleClass = (grade: number, className: string, checked: boolean) => {
    const current = selectedClasses[grade] || [];
    onChange(selectedGrades, {
      ...selectedClasses,
      [grade]: checked ? [...current, className] : current.filter((c) => c !== className),
    });
  };

  const selectAll = () => {
    onChange(grades, Object.fromEntries(grades.map((g) => [g, [] as string[]])));
  };

  return (
    <>
      <div>
        <Space wrap>
          {grades.map((grade) => (
            <Checkbox
              key={grade}
              checked={selectedGrades.includes(grade)}
              onChange={(e) => toggleGrade(grade, e.target.checked)}
            >
              {grade === 0 ? '유치원' : `${grade}학년`}
            </Checkbox>
          ))}
          <Button size="small" onClick={selectAll}>전체선택(전원)</Button>
        </Space>
      </div>
      <div style={{ marginTop: 12 }}>
        {[...selectedGrades].sort((a, b) => a - b).map((grade) => {
          const count = classCountByGrade.get(grade) ?? 0;
          const customNames = customNamesByGrade.get(grade);
          if (count === 0 && !customNames?.length) return null;
          
          const names = customNames?.length ? customNames : Array.from({ length: count }, (_, i) => String(i + 1));
          
          return (
            <div key={grade} style={{ marginBottom: 8 }}>
              <Text strong>{grade === 0 ? '유치원' : `${grade}학년`} 반 선택: </Text>
              <Space wrap>
                {names.map((name) => (
                  <Checkbox
                    key={name}
                    checked={(selectedClasses[grade] || []).includes(name)}
                    onChange={(e) => toggleClass(grade, name, e.target.checked)}
                  >
                    {grade === 0 ? name : `${name}반`}
                  </Checkbox>
                ))}
              </Space>
            </div>
          );
        })}
      </div>
    </>
  );
};
