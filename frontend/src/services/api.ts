import axios from 'axios';

// 기본은 Vite 프록시(/api)를 타도록 상대 경로 사용
// - IP로 접속했을 때 브라우저가 localhost(loopback)로 직접 호출하면
//   Chrome의 Private Network Access(PNA) 정책에 의해 차단될 수 있음
// - 따라서 기본값은 '/api'로 두고, 필요 시 VITE_API_URL로 완전한 URL 지정
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API 요청: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API 응답: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('❌ 백엔드 서버에 연결할 수 없습니다.');
      console.error('💡 백엔드 서버가 실행 중인지 확인하세요: cd backend && npm run dev');
      // 네트워크 오류는 사용자에게 더 명확한 메시지 제공
      error.userMessage = '백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
    } else if (error.response) {
      console.error('❌ API 오류:', error.response.status, error.response.data);
    } else {
      console.error('❌ API 오류:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface Schedule {
  id: number;
  botId: string;
  botName: string;
  subject: string;
  start: string;
  end: string;
  body?: string;
  processId?: string;
  sourceSystem: 'POWER_AUTOMATE' | 'BRITY_RPA' | 'MANUAL';
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleData {
  bot: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  body?: string;
}

export interface UpdateScheduleData {
  subject?: string;
  start?: {
    dateTime: string;
    timeZone: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  };
  body?: string;
}

export interface Bot {
  id: string;
  name: string;
  color: string;
}

export const scheduleApi = {
  getSchedules: (startDate: string, endDate: string, botId?: string) => {
    return apiClient.get<{ success: boolean; data: Schedule[]; count: number }>('/schedules', {
      params: { startDate, endDate, botId },
    });
  },
  createSchedule: (data: CreateScheduleData) => {
    return apiClient.post<{ success: boolean; message: string; scheduleId: number }>('/schedules', data);
  },
  updateSchedule: (id: number, data: UpdateScheduleData) => {
    return apiClient.put<{ success: boolean; message: string }>(`/schedules/${id}`, data);
  },
  deleteSchedule: (id: number) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/schedules/${id}`);
  },
};

export const botApi = {
  getBots: () => {
    return apiClient.get<{ success: boolean; data: Bot[] }>('/bots');
  },
};

export interface SyncLog {
  logId: number;
  syncType: 'POWER_AUTOMATE' | 'BRITY_RPA';
  syncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  recordsSynced: number;
  errorMessage?: string;
  syncDatetime: string;
}

export const syncApi = {
  syncRpaSchedules: (startDate: string, endDate: string) => {
    // 동기화 작업은 시간이 오래 걸릴 수 있으므로 타임아웃을 5분으로 설정
    return apiClient.post<{ 
      success: boolean; 
      message: string; 
      recordsSynced: number;
      recordsRegistered?: number;
      recordsSkipped?: number;
      recordsFailed?: number;
      totalRecords?: number;
    }>('/sync/rpa-schedules', {
      startDate,
      endDate,
    }, {
      timeout: 300000, // 5분 (300초)
    });
  },
  getSyncLogs: (limit?: number, syncType?: string) => {
    return apiClient.get<{ success: boolean; data: SyncLog[]; count: number }>('/sync/logs', {
      params: { limit, syncType },
    });
  },
  getSyncStatus: () => {
    return apiClient.get<{ success: boolean; data: SyncLog | null; message?: string }>('/sync/status');
  },
};

export interface BrityFailureJobItem {
  id: string;
  jobId: string;
  botId: string;
  botName: string;
  processId?: string;
  processName?: string;
  subject: string;
  start: string;
  end: string;
  statusCode?: string;
  statusName?: string;
  detailCode?: string;
  detailName?: string;
  scheduledTime?: string;
}

export interface BrityFailureBucket {
  key: string; // HH:mm
  start: string; // ISO
  end: string;   // ISO
  count: number;
  items: BrityFailureJobItem[];
}

export const brityApi = {
  getFailures: (date?: string, intervalMinutes: number = 10) => {
    return apiClient.get<{
      success: boolean;
      date: string;
      timeZone: string;
      intervalMinutes: number;
      totalFailed: number;
      buckets: BrityFailureBucket[];
    }>('/brity/failures', {
      params: { date, intervalMinutes },
      timeout: 60000,
    });
  },
};

