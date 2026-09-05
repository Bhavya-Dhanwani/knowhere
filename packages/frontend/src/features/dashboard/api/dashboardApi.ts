import { axiosClient } from '../../../shared/lib/axiosClient';
import { EnrolledCourse, HeatmapData, NotificationItem } from '../../../shared/types';

const MOCK_COURSES: EnrolledCourse[] = [
  {
    id: 'course-web-dev',
    title: 'Full Stack Web Development & System Design Mastery',
    thumbnail:
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    progress: 68,
    boughtOn: '14 Jan 2026',
    discordUrl: 'https://discord.gg/example',
    totalModules: 12,
    completedModules: 8
  },
  {
    id: 'course-dsa',
    title: 'Data Structures, Algorithms & Competitive Programming',
    thumbnail:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    progress: 34,
    boughtOn: '02 Feb 2026',
    discordUrl: 'https://discord.gg/example',
    totalModules: 16,
    completedModules: 5
  },
  {
    id: 'course-backend-microservices',
    title: 'Production Microservices with Node.js, Docker & Kubernetes',
    thumbnail:
      'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=600&auto=format&fit=crop&q=80',
    progress: 89,
    boughtOn: '20 Feb 2026',
    discordUrl: 'https://discord.gg/example',
    totalModules: 8,
    completedModules: 7
  }
];

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'New Coding Challenge Available',
    message: 'Dynamic Programming Module 4 problem set is now unlocked for submissions.',
    createdAt: '2 hours ago',
    isRead: false,
    type: 'assignment'
  },
  {
    id: 'notif-2',
    title: 'Weekly Live Doubt Session',
    message: 'Live architecture review with senior mentors starts tomorrow at 6:00 PM IST.',
    createdAt: '1 day ago',
    isRead: true,
    type: 'announcement'
  },
  {
    id: 'notif-3',
    title: 'Quiz Grade Recorded',
    message: 'You scored 20/20 in Express Middleware & Authentication MCQ!',
    createdAt: '3 days ago',
    isRead: true,
    type: 'grade'
  }
];

// Generate 12 weeks of realistic GitHub-style heatmap data
function generateMockHeatmap(): HeatmapData {
  const days: HeatmapData['days'] = [];
  const today = new Date();
  let total = 0;

  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // pseudo-random with higher probability on weekdays
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const seed = (d.getDate() * 17 + d.getMonth() * 31) % 10;

    let count = 0;
    if (seed > (isWeekend ? 5 : 2)) {
      count = (seed % 5) + 1;
    }
    total += count;

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0 && count <= 2) level = 1;
    else if (count > 2 && count <= 4) level = 2;
    else if (count > 4 && count <= 6) level = 3;
    else if (count > 6) level = 4;

    days.push({
      date: dateStr,
      count,
      level
    });
  }

  return {
    totalActivities: total,
    days,
    currentStreak: 6,
    longestStreak: 19
  };
}

export const dashboardApi = {
  getEnrolledCourses: async (): Promise<EnrolledCourse[]> => {
    try {
      const response = await axiosClient.get('/courses');
      const courses = response.data?.data || response.data;
      if (Array.isArray(courses) && courses.length > 0) {
        return courses.map((c: any, index: number) => ({
          id: c._id || c.id || `course-${index}`,
          title: c.title || 'Untitled Course',
          thumbnail: c.thumbnail || MOCK_COURSES[index % MOCK_COURSES.length].thumbnail,
          progress: c.progress ?? 45,
          boughtOn: c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            : '10 Jan 2026',
          discordUrl: 'https://discord.gg/example',
          totalModules: c.modulesCount || 10,
          completedModules: c.completedModulesCount || 4
        }));
      }
      return MOCK_COURSES;
    } catch {
      return MOCK_COURSES;
    }
  },

  getNotifications: async (): Promise<NotificationItem[]> => {
    try {
      const response = await axiosClient.get('/notifications');
      const data = response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      return MOCK_NOTIFICATIONS;
    } catch {
      return MOCK_NOTIFICATIONS;
    }
  },

  getHeatmapData: async (): Promise<HeatmapData> => {
    try {
      const response = await axiosClient.get('/analytics/heatmap');
      const data = response.data?.data || response.data;
      if (data?.days && Array.isArray(data.days)) {
        return data;
      }
      return generateMockHeatmap();
    } catch {
      return generateMockHeatmap();
    }
  }
};
