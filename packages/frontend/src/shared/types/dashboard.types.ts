export interface EnrolledCourse {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  boughtOn: string;
  discordUrl?: string;
  totalModules: number;
  completedModules: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  type?: 'announcement' | 'assignment' | 'grade' | 'system';
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
