"use client";

import { AuthBackground, AuthCheckingCard, AuthFormCard } from "@/components/share/auth/sections";
import { useAuthPage } from "@/components/share/auth/hooks";

export function AuthPage() {
  const {
    sessionChecking,
    mode,
    registerStep,
    resetStep,
    emailVerificationEnabled,
    email,
    nickname,
    password,
    newPassword,
    verificationCode,
    verificationEmail,
    verificationExpiresIn,
    showPassword,
    pending,
    resendPending,
    resendCooldownSeconds,
    error,
    switchMode,
    backToRegister,
    backToLogin,
    resendVerificationCode,
    setEmail,
    setNickname,
    setPassword,
    setNewPassword,
    setVerificationCode,
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
        registerStep={registerStep}
        resetStep={resetStep}
        emailVerificationEnabled={emailVerificationEnabled}
        pending={pending}
        resendPending={resendPending}
        error={error}
        email={email}
        nickname={nickname}
        password={password}
        newPassword={newPassword}
        verificationCode={verificationCode}
        verificationEmail={verificationEmail}
        verificationExpiresIn={verificationExpiresIn}
        resendCooldownSeconds={resendCooldownSeconds}
        showPassword={showPassword}
        onSwitchMode={switchMode}
        onEmailChange={setEmail}
        onNicknameChange={setNickname}
        onPasswordChange={setPassword}
        onNewPasswordChange={setNewPassword}
        onVerificationCodeChange={setVerificationCode}
        onTogglePassword={() => setShowPassword((value) => !value)}
        onBackToRegister={backToRegister}
        onBackToLogin={backToLogin}
        onResendVerificationCode={resendVerificationCode}
        onForgotPassword={() => {
          switchMode("reset");
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
