import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput } from '@fullcalendar/core';
import { scheduleApi, Schedule } from '../services/api';
import { Button, Input, Modal, Select, Space, Typography, message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import koLocale from '@fullcalendar/core/locales/ko';
import BrityFailuresPanel from './BrityFailuresPanel';

dayjs.locale('ko');

const { Text } = Typography;

interface CalendarProps {
  selectedBots: string[];
  refreshTrigger?: number;
}

const Calendar: React.FC<CalendarProps> = ({ selectedBots, refreshTrigger }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const [lastRange, setLastRange] = useState<{ start: Date; end: Date } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 과제(제목/프로세스) 필터
  const [taskQuery, setTaskQuery] = useState<string>('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const getBotColor = (botId: string): string => {
    const colors: { [key: string]: string } = {
      'BOT1': '#3498DB',
      'BOT2': '#2ECC71',
      'BOT3': '#E74C3C',
      'BOT4': '#F39C12',
      'BOT5': '#9B59B6',
      'ALL': '#95A5A6',
      'BOT-T7C50': '#3498DB',
      'BOT-P2OXI': '#2ECC71',
      'BOT-X1G3Z': '#E74C3C',
      'BOT-UGG3O': '#F39C12',
      'BOT-RIGTM': '#9B59B6'
    };
    return colors[botId] || '#95A5A6';
  };

  const fetchSchedules = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      // 캘린더에 표시된 전체 범위를 조회 (과거 날짜 포함)
      // FullCalendar가 제공하는 start, end는 이미 캘린더에 표시되는 범위이므로 그대로 사용
      const startDate = dayjs(start).format('YYYY-MM-DD');
      const endDate = dayjs(end).format('YYYY-MM-DD');
      
      const response = await scheduleApi.getSchedules(startDate, endDate);
      setSchedules(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch events:', error);
      const errorMsg = error.userMessage || error.message || '일정을 불러오는데 실패했습니다.';
      message.error(errorMsg);
      
      // 네트워크 오류인 경우 빈 배열로 설정하여 UI가 깨지지 않도록
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setSchedules([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const taskOptions = useMemo(() => {
    // 현재 조회된 범위 내에서 subject 기반 옵션 생성
    const set = new Set<string>();
    for (const s of schedules) {
      if (s?.subject) set.add(String(s.subject));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const events: EventInput[] = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();

    const filtered = schedules.filter((s: Schedule) => {
      // 1) BOT 필터 (기존 캘린더 필터와 동일)
      const botOk =
        selectedBots.length === 0 ||
        selectedBots.includes(s.botId) ||
        selectedBots.includes(s.botName);

      if (!botOk) return false;

      // 2) 과제 선택 필터 (subject 정확 매칭)
      if (selectedTasks.length > 0 && !selectedTasks.includes(s.subject)) return false;

      // 3) 과제 검색 필터 (subject/body 포함 검색)
      if (q) {
        const subject = String(s.subject || '').toLowerCase();
        const body = String((s as any).body || '').toLowerCase();
        if (!subject.includes(q) && !body.includes(q)) return false;
      }

      return true;
    });

    return filtered.map((schedule: Schedule) => {
      const displayBotId = schedule.botId || schedule.botName || 'UNKNOWN';
      const colorBotId = schedule.botId || schedule.botName || 'BOT1';

      return {
        id: schedule.id.toString(),
        title: `[${displayBotId}] ${schedule.subject}`,
        start: schedule.start,
        end: schedule.end,
        backgroundColor: getBotColor(colorBotId),
        borderColor: getBotColor(colorBotId),
        extendedProps: {
          botId: schedule.botId || schedule.botName,
          botName: schedule.botName,
          subject: schedule.subject,
          body: schedule.body,
          sourceSystem: schedule.sourceSystem,
        },
      };
    });
  }, [schedules, selectedBots, selectedTasks, taskQuery]);

  const refreshCurrentRange = async () => {
    if (lastRange) {
      await fetchSchedules(lastRange.start, lastRange.end);
      return;
    }
    if (calendarRef.current) {
      const view = calendarRef.current.getApi().view;
      if (view) await fetchSchedules(view.activeStart, view.activeEnd);
    }
  };

  const confirmDelete = (scheduleId: number, sourceSystem?: string) => {
    const isExternal = sourceSystem === 'BRITY_RPA' || sourceSystem === 'POWER_AUTOMATE';
    Modal.confirm({
      title: '일정 삭제',
      content: isExternal
        ? '이 일정은 외부 시스템(동기화)에서 다시 생성될 수 있습니다. 그래도 삭제할까요?'
        : '이 일정을 삭제할까요?',
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        setDeletingId(scheduleId);
        try {
          await scheduleApi.deleteSchedule(scheduleId);
          message.success('일정이 삭제되었습니다.');
          await refreshCurrentRange();
        } catch (error: any) {
          console.error('Failed to delete schedule:', error);
          message.error('일정 삭제에 실패했습니다.');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleEventDrop = async (info: any) => {
    const { event } = info;
    const scheduleId = parseInt(event.id);
    
    try {
      await scheduleApi.updateSchedule(scheduleId, {
        start: {
          dateTime: event.start.toISOString(),
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: event.end.toISOString(),
          timeZone: 'Asia/Seoul'
        }
      });
      
      message.success('일정이 수정되었습니다.');
    } catch (error: any) {
      console.error('Failed to update event:', error);
      message.error('일정 수정에 실패했습니다.');
      info.revert(); // 드래그앤드롭 되돌리기
    }
  };

  const handleDateSelect = (selectInfo: any) => {
    // 일정 등록은 부모 컴포넌트에서 처리
    console.log('Date selected:', selectInfo);
  };

  // 외부에서 새로고침 트리거 (일정 추가/수정 후)
  useEffect(() => {
    if (!refreshTrigger) return;
    if (lastRange) {
      fetchSchedules(lastRange.start, lastRange.end);
      return;
    }
    if (calendarRef.current) {
      const view = calendarRef.current.getApi().view;
      if (view) fetchSchedules(view.activeStart, view.activeEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  return (
    <div style={{ padding: '20px', position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          일정을 불러오는 중...
        </div>
      )}

      {/* 캘린더 과제(Subject) 필터 */}
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            style={{ width: 260 }}
            placeholder="과제(제목/설명) 검색"
            value={taskQuery}
            onChange={(e) => setTaskQuery(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 360 }}
            mode="multiple"
            placeholder="과제 선택(현재 범위 내)"
            value={selectedTasks}
            onChange={(v) => setSelectedTasks(v)}
            allowClear
            showSearch
            optionFilterProp="label"
            options={taskOptions.map(v => ({ label: v, value: v }))}
          />
          <Text type="secondary">표시 일정: {events.length}건</Text>
        </Space>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={dayjs().format('YYYY-MM-DD')}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        editable={true}
        droppable={true}
        selectable={true}
        selectMirror={true}
        eventDrop={handleEventDrop}
        select={handleDateSelect}
        datesSet={(dateInfo) => {
          // 캘린더에 표시된 전체 날짜 범위 조회 (과거 포함)
          setLastRange({ start: dateInfo.start, end: dateInfo.end });
          fetchSchedules(dateInfo.start, dateInfo.end);
        }}
        height="auto"
        locale={koLocale}
        eventClick={(info) => {
          console.log('Event clicked:', info.event.extendedProps);
        }}
        eventContent={(arg) => {
          const scheduleId = parseInt(String(arg.event.id), 10);
          const sourceSystem = (arg.event.extendedProps as any)?.sourceSystem as string | undefined;
          const disabled = deletingId === scheduleId;

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={arg.event.title}
              >
                {arg.timeText ? `${arg.timeText} ` : ''}
                {arg.event.title}
              </div>
              <Button
                size="small"
                danger
                disabled={disabled || Number.isNaN(scheduleId)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!Number.isNaN(scheduleId)) confirmDelete(scheduleId, sourceSystem);
                }}
              >
                삭제
              </Button>
            </div>
          );
        }}
        dayMaxEvents={3}
        moreLinkClick="popover"
      />

      {/* 캘린더 하단: 금일 Brity 실패 내역(10분 단위) */}
      <BrityFailuresPanel intervalMinutes={10} selectedBots={selectedBots} />
    </div>
  );
};

export default Calendar;

