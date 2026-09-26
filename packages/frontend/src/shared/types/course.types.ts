export type ContentItemType = 'video' | 'mcq' | 'coding' | 'resource';
export type CompletionStatus = 'completed' | 'in_progress' | 'locked';

export interface ContentItemSummary {
  id: string;
  title: string;
  type: ContentItemType;
  marks: number;
  status: CompletionStatus;
  durationMinutes?: number;
}

export interface ContentItemDetail extends ContentItemSummary {
  description?: string;
  videoUrl?: string;
  codingPrompt?: string;
  starterCode?: string;
  language?: string;
  testCases?: { input: string; output: string; isHidden?: boolean }[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  mcqOptions?: { id: string; text: string }[];
  correctOptionId?: string;
  explanation?: string;
  resourceLink?: string;
  poster?: string;
  relatedLinks?: Array<{ id: string; title: string; url: string; type?: string }>;
  earnedMarks?: number;
}

export interface Submodule {
  id: string;
  title: string;
  order: number;
  status: CompletionStatus;
  isNew?: boolean;
  deadline?: string;
  description?: string;
  tag?: string;
  videoUrl?: string;
  poster?: string;
  relatedLinks?: Array<{ id: string; title: string; url: string; type?: string }>;
  contentItems: ContentItemSummary[];
}

export interface Module {
  id: string;
  title: string;
  order: number;
  status?: CompletionStatus;
  isNew?: boolean;
  submodules: Submodule[];
}

export interface CourseStructure {
  id: string;
  title: string;
  badge?: string;
  overallProgress: number;
  totalModules: number;
  completedModules: number;
  totalSubmodules: number;
  completedSubmodules: number;
  totalScore: number;
  maxScore: number;
  modules: Module[];
}

export interface LeaderboardStudent {
  id: string;
  name: string;
  avatar?: string;
  rank: number;
  points: number;
  aheadPercentage?: number;
}

export interface LeaderboardData {
  topThree: LeaderboardStudent[];
  rankings: LeaderboardStudent[];
  userRank?: LeaderboardStudent;
  aheadPercentage: number;
}
