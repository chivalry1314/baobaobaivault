import type { FormEvent, ReactNode } from "react";

export type AuthMode = "login" | "register";

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
  pending: boolean;
  error: string;
  email: string;
  nickname: string;
  password: string;
  showPassword: boolean;
  onSwitchMode: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};
