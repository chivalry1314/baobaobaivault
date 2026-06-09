import type { FormEvent, ReactNode } from "react";

export type AuthMode = "login" | "register" | "reset";
export type RegisterStep = "form" | "verify";
export type ResetStep = "request" | "verify";

export type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  trailing?: ReactNode;
  readOnly?: boolean;
};

export type AuthFormCardProps = {
  mode: AuthMode;
  registerStep: RegisterStep;
  resetStep: ResetStep;
  emailVerificationEnabled: boolean;
  pending: boolean;
  resendPending: boolean;
  error: string;
  email: string;
  nickname: string;
  password: string;
  newPassword: string;
  verificationCode: string;
  verificationEmail: string;
  verificationExpiresIn: number;
  resendCooldownSeconds: number;
  showPassword: boolean;
  onSwitchMode: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onVerificationCodeChange: (value: string) => void;
  onTogglePassword: () => void;
  onBackToRegister: () => void;
  onBackToLogin: () => void;
  onResendVerificationCode: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};
