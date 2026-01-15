import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Collapse, DatePicker, Empty, Space, Spin, Table, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { brityApi, BrityFailureBucket, BrityFailureJobItem } from '../services/api';

const { Text } = Typography;

type Props = {
  intervalMinutes?: number; // default 10
  selectedBots?: string[]; // 캘린더 BOT 필터와 동일 기준
};

const BrityFailuresPanel: React.FC<Props> = ({ intervalMinutes = 10, selectedBots = [] }) => {
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<BrityFailureBucket[]>([]);
  const [totalFailed, setTotalFailed] = useState<number>(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const fetchFailures = async (dateStr?: string) => {
    setLoading(true);
    try {
      const dateToUse = dateStr || selectedDate;
      const res = await brityApi.getFailures(dateToUse, intervalMinutes);
      setBuckets(res.data.buckets || []);
      setTotalFailed(res.data.totalFailed || 0);
      setLastUpdatedAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (err: any) {
      console.error('Brity failure fetch error:', err);
      message.error(err?.userMessage || err?.message || 'Brity 실패 내역 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 최초 로드 + (오늘을 보고 있을 때만) 10분마다 자동 갱신
  useEffect(() => {
    fetchFailures(selectedDate);

    // 과거 날짜를 보고 있을 때는 자동 갱신 불필요
    if (selectedDate !== today) return;

    const timer = window.setInterval(() => fetchFailures(selectedDate), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const columns = [
    {
      title: '시각',
      dataIndex: 'start',
      key: 'start',
      width: 140,
      render: (v: string) => dayjs(v).format('HH:mm:ss'),
    },
    {
      title: 'BOT',
      dataIndex: 'botName',
      key: 'botName',
      width: 120,
      render: (_: any, r: BrityFailureJobItem) => r.botName || r.botId,
    },
    {
      title: '프로세스',
      dataIndex: 'subject',
      key: 'subject',
      render: (v: string) => <Text ellipsis={{ tooltip: v }}>{v}</Text>,
    },
    {
      title: '결과',
      dataIndex: 'detailName',
      key: 'detailName',
      width: 110,
      render: (_: any, r: BrityFailureJobItem) => r.detailName || r.detailCode || 'FAIL',
    },
    {
      title: 'Job ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 240,
      render: (v: string) => <Text code>{v}</Text>,
    },
  ];

  // 캘린더 BOT 필터 적용 (botId/botName 둘 다 매칭)
  const filteredBuckets = useMemo(() => {
    if (!selectedBots || selectedBots.length === 0) return buckets;

    return buckets
      .map(b => {
        const items = b.items.filter(it => {
          const botId = it.botId || '';
          const botName = it.botName || '';
          return selectedBots.includes(botId) || selectedBots.includes(botName);
        });
        return { ...b, items, count: items.length };
      })
      .filter(b => b.count > 0);
  }, [buckets, selectedBots]);

  const filteredTotalFailed = useMemo(() => {
    return filteredBuckets.reduce((sum, b) => sum + (b.count || 0), 0);
  }, [filteredBuckets]);

  return (
    <Card
      style={{ marginTop: 16 }}
      title={`Brity RPA 실패 내역 (${intervalMinutes}분 단위)`}
      extra={
        <Space>
          <DatePicker
            value={dayjs(selectedDate)}
            format="YYYY-MM-DD"
            allowClear={false}
            onChange={(v) => {
              const next = v ? v.format('YYYY-MM-DD') : today;
              setSelectedDate(next);
              fetchFailures(next);
            }}
          />
          <Button
            onClick={() => {
              const next = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
              setSelectedDate(next);
              fetchFailures(next);
            }}
            disabled={loading}
          >
            어제
          </Button>
          <Button
            onClick={() => {
              setSelectedDate(today);
              fetchFailures(today);
            }}
            disabled={loading}
          >
            오늘
          </Button>
          {lastUpdatedAt && <Text type="secondary">업데이트: {lastUpdatedAt}</Text>}
          <Button onClick={() => fetchFailures(selectedDate)} disabled={loading}>
            새로고침
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {filteredTotalFailed === 0 ? (
          <Empty description="금일 실패 내역이 없습니다." />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text strong>총 실패 건수: {filteredTotalFailed}건</Text>
              {selectedBots.length > 0 && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  (BOT 필터 적용)
                </Text>
              )}
            </div>
            <Collapse
              items={filteredBuckets.map(b => ({
                key: b.key,
                label: `${b.key} ~ ${dayjs(b.end).format('HH:mm')} (${b.count}건)`,
                children: (
                  <Table
                    rowKey={(r: BrityFailureJobItem) => r.jobId || r.id}
                    columns={columns as any}
                    dataSource={b.items}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ),
              }))}
            />
          </>
        )}
      </Spin>
    </Card>
  );
};

export default BrityFailuresPanel;


