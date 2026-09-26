export interface EnrolledCourse {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  boughtOn: string;
  purchasedAt?: string;
  discordUrl?: string;
  discordAvailable?: boolean;
  category?: string;
  hours?: string;
  totalModules?: number;
  completedModules?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  description?: string;
  createdAt?: string;
  time?: string;
  isRead?: boolean;
  unread?: boolean;
  type?: 'lecture' | 'assignment' | 'message' | 'live-class' | 'announcement' | 'grade' | 'system';
}

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapData {
  totalActivities: number;
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
}
