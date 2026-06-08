export type SettingsDraft = {
  nickname: string;
  bio: string;
  avatar: string;
  coverImage: string;
  phone: string;
};

export type SecurityModal = "password" | "phone" | "delete_account" | null;

export type PasswordDraft = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};
