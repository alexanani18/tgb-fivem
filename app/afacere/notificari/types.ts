import type { UserRole } from "../../components/SideBar";

export interface SessionUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface SessionResponse {
  user: SessionUser;
}

export interface NotificationImage {
  id: number;
  image_path: string;
  position: number;
  display_name?: string | null;
}

export interface Notification {
  id: number;
  recipient_id: number;
  created_by: number;

  title: string;
  message: string;

  is_read: number | boolean;

  created_at: string;
  updated_at: string;

  creator_username?: string;
  recipient_username?: string;

  images?: NotificationImage[];
}

export interface Recipient {
  id: number;
  username: string;
  user_role: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications?: Notification[];
  message?: string;
}

export interface RecipientsResponse {
  success: boolean;
  recipients?: Recipient[];
  message?: string;
}

export interface NotificationMutationResponse {
  success: boolean;
  message?: string;
  notification?: Notification;
  updatedCount?: number;
}

export interface NotificationForm {
  recipientId: string;
  title: string;
  message: string;
  includeImages: boolean;
}

export const EMPTY_NOTIFICATION_FORM: NotificationForm = {
  recipientId: "",
  title: "",
  message: "",
  includeImages: false,
};

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface NotificationImageSubmission {
  id: number;
  notification_image_id: number;
  uploaded_by: number;

  file_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;

  status: SubmissionStatus;

  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;
}

export interface SubmissionsResponse {
  success: boolean;
  message?: string;
  submissions?: NotificationImageSubmission[];
}

export interface SubmissionMutationResponse {
  success: boolean;
  message?: string;
  submission?: NotificationImageSubmission;
}
