import type { FormEvent, ReactNode } from "react";

export type AuthMode = "login" | "register";
export type RegisterStep = "form" | "verify";

export type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  trailing?: ReactNode;
};

export type AuthFormCardProps = {
  mode: AuthMode;
  registerStep: RegisterStep;
  emailVerificationEnabled: boolean;
  pending: boolean;
  resendPending: boolean;
  error: string;
  email: string;
  nickname: string;
  password: string;
  verificationCode: string;
  verificationEmail: string;
  verificationExpiresIn: number;
  resendCooldownSeconds: number;
  showPassword: boolean;
  onSwitchMode: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onVerificationCodeChange: (value: string) => void;
  onTogglePassword: () => void;
  onBackToRegister: () => void;
  onResendVerificationCode: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};
