import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Collapse, Empty, Space, Spin, Table, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { brityApi, BrityFailureBucket, BrityFailureJobItem } from '../services/api';

const { Text } = Typography;

type Props = {
  intervalMinutes?: number; // default 10
};

const BrityFailuresPanel: React.FC<Props> = ({ intervalMinutes = 10 }) => {
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<BrityFailureBucket[]>([]);
  const [totalFailed, setTotalFailed] = useState<number>(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const fetchFailures = async () => {
    setLoading(true);
    try {
      const res = await brityApi.getFailures(today, intervalMinutes);
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

  // 최초 로드 + 10분마다 자동 갱신
  useEffect(() => {
    fetchFailures();
    const timer = window.setInterval(fetchFailures, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <Card
      style={{ marginTop: 16 }}
      title={`금일 Brity RPA 실패 내역 (${intervalMinutes}분 단위)`}
      extra={
        <Space>
          {lastUpdatedAt && <Text type="secondary">업데이트: {lastUpdatedAt}</Text>}
          <Button onClick={fetchFailures} disabled={loading}>
            새로고침
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {totalFailed === 0 ? (
          <Empty description="금일 실패 내역이 없습니다." />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text strong>총 실패 건수: {totalFailed}건</Text>
            </div>
            <Collapse
              items={buckets.map(b => ({
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


