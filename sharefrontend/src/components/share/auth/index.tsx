"use client";

import { AuthBackground, AuthCheckingCard, AuthFormCard } from "@/components/share/auth/sections";
import { useAuthPage } from "@/components/share/auth/hooks";

export function AuthPage() {
  const {
    sessionChecking,
    mode,
    email,
    nickname,
    password,
    showPassword,
    pending,
    error,
    switchMode,
    setEmail,
    setNickname,
    setPassword,
    setShowPassword,
    handleSubmit,
  } = useAuthPage();

  if (sessionChecking) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6 sm:py-8">
        <AuthBackground />
        <AuthCheckingCard />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6 sm:py-8">
      <AuthBackground />
      <AuthFormCard
        mode={mode}
        pending={pending}
        error={error}
        email={email}
        nickname={nickname}
        password={password}
        showPassword={showPassword}
        onSwitchMode={switchMode}
        onEmailChange={setEmail}
        onNicknameChange={setNickname}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword((value) => !value)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
