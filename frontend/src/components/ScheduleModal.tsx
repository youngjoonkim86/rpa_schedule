import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, TimePicker, Button, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { scheduleApi, CreateScheduleData, UpdateScheduleData, Schedule } from '../services/api';
import { Bot } from '../services/api';

const { TextArea } = Input;

interface ScheduleModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  schedule?: Schedule | null;
  bots: Bot[];
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  schedule,
  bots
}) => {
  const [form] = Form.useForm();
  const isEdit = !!schedule;

  useEffect(() => {
    if (visible) {
      if (schedule) {
        // 수정 모드
        form.setFieldsValue({
          bot: schedule.botId,
          subject: schedule.subject,
          startDate: dayjs(schedule.start),
          startTime: dayjs(schedule.start),
          endDate: dayjs(schedule.end),
          endTime: dayjs(schedule.end),
          body: schedule.body || ''
        });
      } else {
        // 생성 모드
        form.resetFields();
        form.setFieldsValue({
          startDate: dayjs(),
          startTime: dayjs(),
          endDate: dayjs().add(1, 'hour'),
          endTime: dayjs().add(1, 'hour')
        });
      }
    }
  }, [visible, schedule, form]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 중복 제출 방지
    if (submitting) {
      return;
    }
    
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      
      const startDateTime = dayjs(values.startDate)
        .hour(values.startTime.hour())
        .minute(values.startTime.minute())
        .second(0)
        .millisecond(0);
      
      const endDateTime = dayjs(values.endDate)
        .hour(values.endTime.hour())
        .minute(values.endTime.minute())
        .second(0)
        .millisecond(0);

      // 종료 시간이 시작 시간보다 이후인지 확인
      if (endDateTime.isBefore(startDateTime) || endDateTime.isSame(startDateTime)) {
        message.error('종료 시간은 시작 시간보다 이후여야 합니다.');
        return;
      }

      const scheduleData: CreateScheduleData | UpdateScheduleData = {
        subject: values.subject,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Seoul'
        },
        body: values.body || ''
      };

      if (isEdit) {
        await scheduleApi.updateSchedule(schedule.id, scheduleData);
        message.success('일정이 수정되었습니다.');
      } else {
        await scheduleApi.createSchedule({
          ...scheduleData,
          bot: values.bot
        } as CreateScheduleData);
        message.success('일정이 등록되었습니다.');
      }

      form.resetFields();
      onCancel(); // 모달 닫기
      onSuccess(); // 성공 콜백 (캘린더 새로고침 등)
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        return;
      }
      console.error('Failed to save schedule:', error);
      message.error(isEdit ? '일정 수정에 실패했습니다.' : '일정 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '일정 수정' : '일정 등록'}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          취소
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
          {isEdit ? '수정' : '등록'}
        </Button>
      ]}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        {!isEdit && (
          <Form.Item
            name="bot"
            label="BOT"
            rules={[{ required: true, message: 'BOT을 선택해주세요.' }]}
          >
            <Select 
              placeholder="BOT을 선택하세요"
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {bots.map(bot => (
                <Select.Option key={bot.id} value={bot.id}>
                  {bot.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="subject"
          label="제목"
          rules={[{ required: true, message: '제목을 입력해주세요.' }]}
        >
          <Input placeholder="일정 제목을 입력하세요" maxLength={255} />
        </Form.Item>

        <Form.Item
          name="startDate"
          label="시작 날짜"
          rules={[{ required: true, message: '시작 날짜를 선택해주세요.' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          name="startTime"
          label="시작 시간"
          rules={[{ required: true, message: '시작 시간을 선택해주세요.' }]}
        >
          <TimePicker 
            style={{ width: '100%' }} 
            format="HH:mm" 
            minuteStep={30}
            showNow={false}
          />
        </Form.Item>

        <Form.Item
          name="endDate"
          label="종료 날짜"
          rules={[{ required: true, message: '종료 날짜를 선택해주세요.' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          name="endTime"
          label="종료 시간"
          rules={[{ required: true, message: '종료 시간을 선택해주세요.' }]}
        >
          <TimePicker 
            style={{ width: '100%' }} 
            format="HH:mm" 
            minuteStep={30}
            showNow={false}
          />
        </Form.Item>

        <Form.Item
          name="body"
          label="설명"
        >
          <TextArea rows={4} placeholder="일정 설명을 입력하세요 (선택사항)" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ScheduleModal;


