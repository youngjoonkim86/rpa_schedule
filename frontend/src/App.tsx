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
    const startedAtMs = Date.now();
    let didTimeout = false;

    const pollUntilDone = async () => {
      const maxWaitMs = 30 * 60 * 1000; // 30분
      const pollIntervalMs = 5000; // 5초
      const deadline = Date.now() + maxWaitMs;

      // 완료될 때까지 상태 폴링
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (Date.now() > deadline) {
          message.error('동기화 상태 확인 시간이 초과되었습니다. 잠시 후 다시 확인해주세요.', 10);
          break;
        }

        try {
          const statusRes = await syncApi.getSyncStatus();
          const data: any = statusRes.data?.data;

          // 1) 진행 중이면 계속 스피너 유지
          if (data?.inProgress) {
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            continue;
          }

          // 2) 완료면 latest 로그 기준으로 종료
          const latest: any = data?.latest || data;
          if (latest) {
            const tsRaw = latest.sync_datetime || latest.syncDatetime || latest.syncDatetimeUtc;
            const latestMs = tsRaw ? new Date(tsRaw).getTime() : 0;
            if (latestMs && latestMs >= startedAtMs) {
              const syncStatus = latest.sync_status || latest.syncStatus;
              const synced = latest.records_synced ?? latest.recordsSynced ?? 0;

              if (syncStatus === 'SUCCESS' || syncStatus === 'PARTIAL') {
                message.success(`동기화 완료! (DB 저장/업데이트: ${synced}개)`, 6);
                setCalendarRefresh(prev => prev + 1);
                loadBots();
              } else if (syncStatus === 'FAILED') {
                message.error(`동기화 실패: ${latest.error_message || latest.errorMessage || ''}`, 10);
              } else {
                message.info('동기화가 완료되었습니다. 캘린더를 새로고침합니다.', 5);
                setCalendarRefresh(prev => prev + 1);
                loadBots();
              }
              break;
            }
          }
        } catch (statusErr) {
          // 상태 조회가 실패해도 잠시 후 재시도
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    };

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

      // ✅ 202(동기화 시작) 응답일 수 있으므로, status 폴링으로 완료까지 대기
      // (Cloudflare 터널 524를 피하기 위해 백엔드가 202로 즉시 응답하도록 변경됨)
      if (response?.status === 202 || response?.data?.data?.inProgress) {
        await pollUntilDone();
      } else {
        // 혹시라도 동기화가 즉시 완료되는 케이스(로컬/소량) 대비
        const details = [];
        if (response.data.recordsSynced) details.push(`DB 저장: ${response.data.recordsSynced}개`);
        if (response.data.recordsRegistered) details.push(`등록: ${response.data.recordsRegistered}개`);
        if (response.data.recordsSkipped) details.push(`건너뜀: ${response.data.recordsSkipped}개`);
        if (response.data.recordsFailed) details.push(`실패: ${response.data.recordsFailed}개`);
        message.success(`동기화 완료! ${details.join(', ')}`, 5);
        setCalendarRefresh(prev => prev + 1);
        loadBots();
      }
    } catch (error: any) {
      console.error('Failed to sync:', error);
      
      let errorMessage = '동기화에 실패했습니다.';
      // 프론트 요청 타임아웃/터널 524여도 서버는 계속 동기화 중일 수 있으므로
      // /sync/status 를 폴링해서 "서버 완료" 시점까지 로딩을 유지한다.
      const isCloudflare524 = error?.response?.status === 524;
      if (error.code === 'ECONNABORTED' || isCloudflare524) {
        didTimeout = true;
        message.warning(
          isCloudflare524
            ? 'Cloudflare 터널에서 요청이 타임아웃(524)되었습니다. 서버에서 계속 진행 중인지 상태를 확인합니다...'
            : '동기화 요청이 타임아웃되었습니다. 서버에서 계속 진행 중인지 상태를 확인합니다...',
          5
        );
        await pollUntilDone();
        setSyncLoading(false);
        return;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      message.error(errorMessage, 10); // 10초간 표시
    } finally {
      // 타임아웃 폴링 경로에서는 폴링 종료 시점에 직접 setSyncLoading(false) 처리
      if (!didTimeout) setSyncLoading(false);
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
        />
      </Layout>
    </ConfigProvider>
  );
}

export default App;


