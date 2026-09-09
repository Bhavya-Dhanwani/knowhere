import { axiosClient } from '../../../shared/lib/axiosClient';
import { EnrolledCourse, HeatmapData, NotificationItem } from '../../../shared/types';

const MOCK_COURSES: EnrolledCourse[] = [
  {
    id: 'course-dsa-bootcamp',
    title: 'DSA for Bootcamp',
    thumbnail:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    progress: 86.89,
    boughtOn: 'February 20, 2026',
    totalModules: 24,
    completedModules: 21
  },
  {
    id: 'course-kodex-bootcamp',
    title: 'Kodex Bootcamp',
    thumbnail:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    progress: 40.46,
    boughtOn: 'December 22, 2025',
    discordUrl: 'https://discord.gg/knowhere',
    totalModules: 30,
    completedModules: 12
  },
  {
    id: 'course-c-programming',
    title: 'C Programming For Beginners',
    thumbnail:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    progress: 54.83,
    boughtOn: 'November 16, 2025',
    discordUrl: 'https://discord.gg/knowhere',
    totalModules: 18,
    completedModules: 10
  },
  {
    id: 'course-ai-cohort',
    title: '2.0 Job Ready AI Powered Cohort',
    thumbnail:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    progress: 92.71,
    boughtOn: 'November 9, 2025',
    discordUrl: 'https://discord.gg/knowhere',
    totalModules: 28,
    completedModules: 26
  }
];

const MOCK_NOTIFICATIONS: NotificationItem[] = [];

// Generate 16 weeks of heatmap data matching fresh student dashboard
function generateMockHeatmap(): HeatmapData {
  const days: HeatmapData['days'] = [];
  const today = new Date();

  for (let i = 111; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    days.push({
      date: dateStr,
      count: 0,
      level: 0
    });
  }

  return {
    totalActivities: 0,
    days,
    currentStreak: 0,
    longestStreak: 0
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
