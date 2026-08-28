import { useState, useEffect } from 'react';
import { ConfigProvider, Layout, Typography, Menu } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCartOutlined, UsergroupAddOutlined, FilePdfOutlined, SettingOutlined, WalletOutlined, ProfileOutlined, ReadOutlined } from '@ant-design/icons';
import './index.css';
import { SimplePurchase } from './pages/SimplePurchase';
import { InstructorFee } from './pages/InstructorFee';
import { ContractPurchase } from './pages/ContractPurchase';
import { BudgetManager } from './pages/BudgetManager';
import { TemplateManager } from './pages/TemplateManager';
import { RateSettings } from './pages/RateSettings';
import { UserGuide } from './pages/UserGuide';
import { SettingsModal } from './components/SettingsModal';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const edufineTheme = {
  token: {
    colorPrimary: '#0E7490', 
    colorBgLayout: '#F7FCFF', 
    colorBgContainer: '#EAF5FA',
    colorTextBase: '#12304A', 
    borderRadius: 14, 
    fontFamily: '"Pretendard", sans-serif',
  },
  components: {
    Layout: { headerBg: '#EAF5FA' },
    Menu: {
      darkItemBg: '#0E7490',
      darkItemColor: '#F7FCFF',
      darkItemSelectedBg: '#0b5a70', 
    },
    Card: {
      boxShadowTertiary: '0 10px 28px rgba(18, 24, 38, 0.08)',
    }
  },
};

const PoomiIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'text-bottom', color: '#F7FCFF' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <path d="M13 12l-3 5h4l-1 5 5-6h-4l1-4z" fill="#38BDF8" stroke="#38BDF8"></path>
  </svg>
);

const MainLayout = () => {
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('우리학교');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // URL에서 파라미터 파싱
    const params = new URLSearchParams(window.location.search);
    const schoolParam = params.get('school');
    
    // 로컬 스토리지 데이터 로드
    const savedSchool = localStorage.getItem('school_name');
    const savedKey = localStorage.getItem('gemini_api_key');

    if (schoolParam) {
      setSchoolName(schoolParam);
      localStorage.setItem('school_name', schoolParam);
      // URL 클린업
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (savedSchool) {
      setSchoolName(savedSchool);
    }

    if (savedKey) {
      setApiKey(savedKey);
    } else {
      // API 키가 없으면 자동으로 설정 창 열기
      setIsSettingsOpen(true);
    }
  }, []);

  const handleSaveSettings = (newSchoolName: string, newApiKey: string) => {
    setSchoolName(newSchoolName);
    setApiKey(newApiKey);
    localStorage.setItem('school_name', newSchoolName);
    localStorage.setItem('gemini_api_key', newApiKey);
  };

  // 입력칸을 비우고 저장하는 방법으로는 지울 수 없다(required 검증에 걸린다).
  // 공용 PC에서 키를 남기지 않으려면 이 경로가 필요하다.
  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
  };

  const menuItems = [
    {
      key: 'teachers-group',
      type: 'group' as const,
      label: <span style={{ color: 'var(--color-accent)', fontSize: '12px' }}>👨‍🏫 기안서 작성</span>,
      children: [
        { key: '/', icon: <ShoppingCartOutlined />, label: <Link to="/">단순 물품 품의</Link> },
        { key: '/instructor', icon: <UsergroupAddOutlined />, label: <Link to="/instructor">강사비 지출 품의</Link> },
        { key: '/contract', icon: <FilePdfOutlined />, label: <Link to="/contract">견적서 계약 품의</Link> },
      ]
    },
    {
      key: 'budget-group',
      type: 'group' as const,
      label: <span style={{ color: 'var(--color-accent)', fontSize: '12px' }}>💰 예산</span>,
      children: [
        { key: '/budget', icon: <WalletOutlined />, label: <Link to="/budget">예산 관리</Link> },
      ]
    },
    {
      key: 'settings-group',
      type: 'group' as const,
      label: <span style={{ color: 'var(--color-accent)', fontSize: '12px' }}>⚙️ 설정</span>,
      children: [
        { key: '/api-settings', icon: <SettingOutlined />, label: '학교 API 설정', onClick: () => setIsSettingsOpen(true) },
        { key: '/templates', icon: <ProfileOutlined />, label: <Link to="/templates">탬플릿 등록</Link> },
        { key: '/rates', icon: <SettingOutlined />, label: <Link to="/rates">강사비/원고료 단가 조정</Link> },
        { key: '/guide', icon: <ReadOutlined />, label: <Link to="/guide">사용설명서</Link> },
      ]
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        theme="dark" 
        width={250} 
        style={{ background: 'var(--color-primary)', zIndex: 100 }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: 0, letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PoomiIcon />
            품의뚝딱
          </Title>
          <Text style={{ color: 'var(--color-accent)', fontSize: '13px' }}>어려운 품의, AI로 뚝딱!</Text>
        </div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[location.pathname]}
          style={{ background: 'var(--color-primary)' }}
          items={menuItems}
        />
      </Sider>
      
      <Layout>
        <Header style={{ background: 'var(--color-bg)', padding: '0 16px', display: 'flex', alignItems: 'center', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0, color: 'var(--color-primary)' }}>{schoolName}</Title>
        </Header>
        <Content style={{ margin: '16px', background: 'var(--color-bg)', borderRadius: '8px', minHeight: 280, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <Routes>
            <Route path="/" element={<SimplePurchase />} />
            <Route path="/instructor" element={<InstructorFee />} />
            <Route path="/contract" element={<ContractPurchase />} />
            <Route path="/budget" element={<BudgetManager />} />
            <Route path="/templates" element={<TemplateManager />} />
            <Route path="/rates" element={<RateSettings />} />
            <Route path="/guide" element={<UserGuide />} />
            <Route path="*" element={<SimplePurchase />} />
          </Routes>
        </Content>
      </Layout>

      <SettingsModal 
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onClearApiKey={handleClearApiKey}
        initialSchoolName={schoolName}
        initialApiKey={apiKey}
      />
    </Layout>
  );
};

function App() {
  return (
    <ConfigProvider theme={edufineTheme}>
      <Router>
        <MainLayout />
      </Router>
    </ConfigProvider>
  );
}

export default App;
