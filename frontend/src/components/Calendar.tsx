import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput } from '@fullcalendar/core';
import { scheduleApi, Schedule } from '../services/api';
import { message } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import koLocale from '@fullcalendar/core/locales/ko';
import BrityFailuresPanel from './BrityFailuresPanel';

dayjs.locale('ko');

interface CalendarProps {
  selectedBots: string[];
  refreshTrigger?: number;
}

const Calendar: React.FC<CalendarProps> = ({ selectedBots, refreshTrigger }) => {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

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

  const fetchEvents = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      // 캘린더에 표시된 전체 범위를 조회 (과거 날짜 포함)
      // FullCalendar가 제공하는 start, end는 이미 캘린더에 표시되는 범위이므로 그대로 사용
      const startDate = dayjs(start).format('YYYY-MM-DD');
      const endDate = dayjs(end).format('YYYY-MM-DD');
      
      const response = await scheduleApi.getSchedules(startDate, endDate);
      
      // FullCalendar 형식으로 변환
      const formattedEvents: EventInput[] = response.data.data
        .filter((schedule: Schedule) => {
          // botId 또는 botName으로 필터링
          return selectedBots.length === 0 || 
                 selectedBots.includes(schedule.botId) || 
                 selectedBots.includes(schedule.botName);
        })
        .map((schedule: Schedule) => {
          // botId가 없으면 botName 사용
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
              body: schedule.body,
              sourceSystem: schedule.sourceSystem
            }
          };
        });
      
      setEvents(formattedEvents);
    } catch (error: any) {
      console.error('Failed to fetch events:', error);
      const errorMsg = error.userMessage || error.message || '일정을 불러오는데 실패했습니다.';
      message.error(errorMsg);
      
      // 네트워크 오류인 경우 빈 배열로 설정하여 UI가 깨지지 않도록
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
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
    if (refreshTrigger && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const view = calendarApi.view;
      if (view) {
        fetchEvents(view.activeStart, view.activeEnd);
      }
    }
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
          fetchEvents(dateInfo.start, dateInfo.end);
        }}
        height="auto"
        locale={koLocale}
        eventClick={(info) => {
          console.log('Event clicked:', info.event.extendedProps);
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

