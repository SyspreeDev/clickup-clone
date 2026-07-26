export const ROLES = ["OWNER", "ADMIN", "TEAM_LEAD", "MEMBER", "GUEST"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  TEAM_LEAD: 2,
  MEMBER: 1,
  GUEST: 0,
};

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INVITED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WORKFLOW_CATEGORIES = [
  "BACKLOG",
  "UNSTARTED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const TASK_PRIORITIES = [
  "NO_PRIORITY",
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DEPENDENCY_TYPES = ["BLOCKS", "RELATES_TO", "DUPLICATES"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "ASSIGNED",
  "UNASSIGNED",
  "DUE_DATE_CHANGED",
  "MOVED",
  "COMMENTED",
  "ATTACHMENT_ADDED",
  "ATTACHMENT_REMOVED",
  "DEPENDENCY_ADDED",
  "DEPENDENCY_REMOVED",
  "ARCHIVED",
  "RESTORED",
  "DELETED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_COMPLETED",
  "TASK_STATUS_CHANGED",
  "TASK_COMMENTED",
  "MENTIONED",
  "DEADLINE_APPROACHING",
  "PROJECT_UPDATED",
  "ADDED_TO_PROJECT",
  "ADDED_TO_TEAM",
  "ADDED_TO_WORKSPACE",
  "CHAT_MESSAGE",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CHANNEL_TYPES = ["PUBLIC", "PRIVATE", "DM"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_MEMBER_ROLES = ["ADMIN", "MEMBER"] as const;
export type ChannelMemberRole = (typeof CHANNEL_MEMBER_ROLES)[number];

export const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const RSVP_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const FILE_PERMISSION_LEVELS = ["VIEW", "EDIT", "MANAGE"] as const;
export type FilePermissionLevel = (typeof FILE_PERMISSION_LEVELS)[number];
