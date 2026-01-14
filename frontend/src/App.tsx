import React, { useState, useEffect } from 'react';
import { Layout, Button, message, Spin } from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import Calendar from './components/Calendar';
import ScheduleModal from './components/ScheduleModal';
import BotFilter from './components/BotFilter';
import { botApi, syncApi, Schedule } from './services/api';
import { Bot } from './services/api';
import dayjs from 'dayjs';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [calendarRefresh, setCalendarRefresh] = useState(0);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const response = await botApi.getBots();
      setBots(response.data.data);
      // 기본적으로 모든 BOT 선택
      setSelectedBots(response.data.data.map(bot => bot.id));
    } catch (error) {
      console.error('Failed to load bots:', error);
      message.error('BOT 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleBotToggle = (botId: string) => {
    setSelectedBots(prev => {
      if (prev.includes(botId)) {
        return prev.filter(id => id !== botId);
      } else {
        return [...prev, botId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedBots(bots.map(bot => bot.id));
  };

  const handleDeselectAll = () => {
    setSelectedBots([]);
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const now = dayjs();
      // 당월 기준 -7일: 현재 월의 첫날에서 7일 전
      const startDate = now.startOf('month').subtract(7, 'day');
      // 종료 일정은 전체로 (제한 없음 - 1년 후로 설정)
      const endDate = now.add(1, 'year');
      
      message.info('동기화를 시작합니다. 많은 데이터가 있을 경우 시간이 걸릴 수 있습니다...');
      
      const response = await syncApi.syncRpaSchedules(
        startDate.format('YYYY-MM-DD'),
        endDate.format('YYYY-MM-DD')
      );
      
      const details = [];
      if (response.data.recordsSynced) details.push(`DB 저장: ${response.data.recordsSynced}개`);
      if (response.data.recordsRegistered) details.push(`등록: ${response.data.recordsRegistered}개`);
      if (response.data.recordsSkipped) details.push(`건너뜀: ${response.data.recordsSkipped}개`);
      if (response.data.recordsFailed) details.push(`실패: ${response.data.recordsFailed}개`);
      
      message.success(
        `동기화 완료! ${details.join(', ')}`,
        5 // 5초간 표시
      );
      
      // 캘린더 새로고침
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to sync:', error);
      
      let errorMessage = '동기화에 실패했습니다.';
      if (error.code === 'ECONNABORTED') {
        errorMessage = '동기화 시간이 초과되었습니다. 서버 로그를 확인하거나 나중에 다시 시도해주세요.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      message.error(errorMessage, 10); // 10초간 표시
    } finally {
      setSyncLoading(false);
    }
  };

  const handleModalSuccess = () => {
    // 모달 닫기
    setModalVisible(false);
    setSelectedSchedule(null);
    // 캘린더 새로고침 트리거
    setCalendarRefresh(prev => prev + 1);
  };

  return (
    <ConfigProvider locale={koKR}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ color: 'white', margin: 0 }}>RPA BOT 스케줄 관리 시스템</h1>
          <div>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={syncLoading}
              onClick={handleSync}
              style={{ marginRight: '10px' }}
            >
              동기화
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedSchedule(null);
                setModalVisible(true);
              }}
            >
              일정 추가
            </Button>
          </div>
        </Header>
        <Layout>
          <Sider width={250} style={{ background: '#fff', padding: '20px' }}>
            <BotFilter
              bots={bots}
              selectedBots={selectedBots}
              onBotToggle={handleBotToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
          </Sider>
          <Content style={{ padding: '24px', background: '#fff' }}>
            <Spin spinning={loading}>
              <Calendar selectedBots={selectedBots} refreshTrigger={calendarRefresh} />
            </Spin>
          </Content>
        </Layout>
        <ScheduleModal
          visible={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setSelectedSchedule(null);
          }}
          onSuccess={handleModalSuccess}
          schedule={selectedSchedule}
          bots={bots}
        />
      </Layout>
    </ConfigProvider>
  );
}

export default App;


