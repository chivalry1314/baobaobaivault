"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

type SettingsDraft = {
  nickname: string;
  bio: string;
  avatar: string;
  coverImage: string;
  phone: string;
};

type SecurityModal = "password" | "phone" | null;

function createDraft(user: ExternalSessionUser): SettingsDraft {
  return {
    nickname: user.nickname,
    bio: user.bio,
    avatar: user.avatar,
    coverImage: user.coverImage,
    phone: user.phone,
  };
}

function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const username = user.username.trim();
  if (username) {
    return username;
  }

  return user.email.split("@")[0]?.trim() || "Card Share";
}

function getInitials(user: ExternalSessionUser) {
  return Array.from(getDisplayName(user)).slice(0, 2).join("").toUpperCase() || "CS";
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return phone.trim() || "未绑定";
  }

  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败，请稍后重试"));
    reader.readAsDataURL(file);
  });
}

function validateImage(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png"]);
  if (!allowedTypes.has(file.type)) {
    return "仅支持 jpg、png 格式图片";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "图片大小不能超过 5MB";
  }

  return "";
}

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-[1.15rem] text-[var(--foreground)]">
      <span className="text-[var(--primary)]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SecurityRow({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
  muted = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? "bg-[#f6d4e4]" : "bg-[#f1d2ff]"} text-[var(--primary)]`}>
          {icon}
        </div>
        <div>
          <p className="text-[1.15rem] font-medium text-[var(--foreground)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--foreground)]/58">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="self-end rounded-full px-5 py-2.5 text-sm text-[var(--foreground)]/76 transition hover:bg-white/70 hover:text-[var(--primary)] sm:self-auto"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function ModalCard({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,24,27,0.18)] p-4 backdrop-blur-sm sm:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭弹窗" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[460px] rounded-[34px] border border-white/80 bg-white/94 p-6 shadow-[0_34px_90px_-40px_rgba(38,24,27,0.4)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--outline-variant)] text-[var(--foreground)]/62 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function ShareProfileSettings({
  user,
  onSaved,
}: {
  user: ExternalSessionUser;
  onSaved: (user: ExternalSessionUser) => void;
}) {
  const avatarInputId = useId();
  const coverInputId = useId();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<SettingsDraft>(() => createDraft(user));
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [securityModal, setSecurityModal] = useState<SecurityModal>(null);
  const [modalPending, setModalPending] = useState(false);
  const [modalError, setModalError] = useState("");
  const [phoneValue, setPhoneValue] = useState(user.phone);
  const [passwordDraft, setPasswordDraft] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setDraft(createDraft(user));
    setPhoneValue(user.phone);
    setSaveError("");
    setSaveSuccess("");
  }, [user]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>, target: "avatar" | "coverImage") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const validationError = validateImage(file);
    if (validationError) {
      setSaveError(validationError);
      setSaveSuccess("");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraft((current) => ({
        ...current,
        [target]: dataUrl,
      }));
      setSaveError("");
      setSaveSuccess("");
    } catch (error) {
      setSaveError(getShareErrorMessage(error, "读取图片失败，请稍后重试"));
      setSaveSuccess("");
    }
  }

  async function handleSaveProfile() {
    setSavePending(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const payload = await shareApi.updateProfile(draft);
      onSaved(payload.user);
      setDraft(createDraft(payload.user));
      setSaveSuccess("个人信息已保存");
    } catch (error) {
      setSaveError(getShareErrorMessage(error, "保存个人信息失败，请稍后重试"));
    } finally {
      setSavePending(false);
    }
  }

  function handleReset() {
    setDraft(createDraft(user));
    setSaveError("");
    setSaveSuccess("");
  }

  function closeSecurityModal() {
    setSecurityModal(null);
    setModalPending(false);
    setModalError("");
    setPasswordDraft({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPhoneValue(user.phone);
  }

  async function handleChangePassword() {
    if (!passwordDraft.oldPassword.trim()) {
      setModalError("请输入当前密码");
      return;
    }

    if (!passwordDraft.newPassword.trim()) {
      setModalError("请输入新密码");
      return;
    }

    if (passwordDraft.newPassword.length < 6) {
      setModalError("新密码至少需要 6 位");
      return;
    }

    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setModalError("两次输入的新密码不一致");
      return;
    }

    setModalPending(true);
    setModalError("");

    try {
      await shareApi.changePassword({
        oldPassword: passwordDraft.oldPassword,
        newPassword: passwordDraft.newPassword,
      });
      closeSecurityModal();
      setSaveSuccess("密码已更新");
    } catch (error) {
      setModalError(getShareErrorMessage(error, "修改密码失败，请稍后重试"));
      setModalPending(false);
    }
  }

  async function handleSavePhone() {
    setModalPending(true);
    setModalError("");

    try {
      const payload = await shareApi.updateProfile({
        ...createDraft(user),
        phone: phoneValue.trim(),
      });
      onSaved(payload.user);
      setDraft((current) => ({
        ...current,
        phone: payload.user.phone,
      }));
      closeSecurityModal();
      setSaveSuccess("手机号已更新");
    } catch (error) {
      setModalError(getShareErrorMessage(error, "更新手机号失败，请稍后重试"));
      setModalPending(false);
    }
  }

  return (
    <>
      <section className="rounded-[40px] border border-white/80 bg-white/88 px-6 py-6 shadow-[0_30px_70px_-46px_rgba(120,85,94,0.3)] backdrop-blur-xl sm:px-8 sm:py-8">
        <div className="flex items-center justify-between border-b border-[rgba(220,173,187,0.35)] pb-5">
          <div>
            <h1 className="text-[1.65rem] font-medium text-[var(--foreground)]">个人信息设置</h1>
          </div>
          <SparklesIcon className="h-9 w-9 text-[rgba(120,85,94,0.24)]" />
        </div>

        {saveError ? (
          <p className="mt-6 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{saveError}</p>
        ) : null}

        {saveSuccess ? (
          <p className="mt-6 rounded-2xl border border-[#d9eed6] bg-[#f3fbf1] px-4 py-3 text-sm text-[#2f6d37]">{saveSuccess}</p>
        ) : null}

        <div className="mt-8 rounded-[34px] border border-[rgba(236,197,207,0.76)] bg-[rgba(255,248,249,0.74)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_20px_42px_-30px_rgba(120,85,94,0.45)]">
                {draft.avatar ? (
                  <img src={draft.avatar} alt={draft.nickname} className="h-[96px] w-[96px] object-cover" />
                ) : (
                  <div className="flex h-[96px] w-[96px] items-center justify-center bg-[linear-gradient(135deg,#ffdbe5_0%,#f6e8ff_100%)] text-3xl font-semibold text-[var(--primary)]">
                    {getInitials(user)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[1.2rem] font-medium text-[var(--foreground)]">头像</p>
                <p className="mt-2 text-sm text-[var(--foreground)]/58">支持 jpg、png 格式，大小不超过 5MB</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="rounded-full border border-[rgba(204,171,180,0.72)] bg-[linear-gradient(135deg,#f9dde3_0%,#fce7ee_100%)] px-8 py-3 text-[1.05rem] text-[var(--foreground)] shadow-[0_16px_34px_-24px_rgba(120,85,94,0.35)] transition hover:-translate-y-0.5"
            >
              修改
            </button>
          </div>

          <input
            id={avatarInputId}
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(event) => void handleImageChange(event, "avatar")}
          />
        </div>

        <div className="mt-8">
          <SectionTitle icon={<HeartIcon className="h-5 w-5" />}>基本信息</SectionTitle>
        </div>

        <div className="mt-5 rounded-[34px] border border-[rgba(236,197,207,0.76)] bg-[rgba(255,248,249,0.7)] p-5 sm:p-6">
          <label className="block">
            <span className="text-[1.1rem] text-[var(--foreground)]">昵称</span>
            <input
              type="text"
              value={draft.nickname}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  nickname: event.target.value,
                }));
                setSaveError("");
                setSaveSuccess("");
              }}
              className="mt-4 w-full rounded-full border border-[rgba(204,171,180,0.72)] bg-white px-6 py-4 text-[1.15rem] outline-none transition focus:border-[var(--primary)]"
              placeholder="请输入昵称"
              maxLength={40}
            />
          </label>

          <div className="mt-8 flex items-center justify-between gap-4">
            <span className="text-[1.1rem] text-[var(--foreground)]">个人简介</span>
            <span className="text-sm text-[var(--foreground)]/48">{draft.bio.length}/100</span>
          </div>

          <textarea
            value={draft.bio}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                bio: event.target.value.slice(0, 100),
              }));
              setSaveError("");
              setSaveSuccess("");
            }}
            rows={5}
            className="mt-4 w-full rounded-[34px] border border-[rgba(204,171,180,0.72)] bg-white px-6 py-5 text-[1.1rem] leading-8 outline-none transition focus:border-[var(--primary)]"
            placeholder="写一段个人简介"
          />
        </div>

        <div className="mt-8">
          <SectionTitle icon={<LandscapeIcon className="h-5 w-5" />}>背景封面</SectionTitle>
        </div>

        <div className="mt-5 rounded-[34px] border border-[rgba(236,197,207,0.76)] bg-[rgba(255,248,249,0.7)] p-5 sm:p-6">
          <div className="relative overflow-hidden rounded-[34px] border border-dashed border-[rgba(204,171,180,0.8)] bg-[linear-gradient(135deg,#7a9ae2_0%,#9b88df_45%,#f1a4bd_100%)]">
            {draft.coverImage ? (
              <img src={draft.coverImage} alt="背景封面" className="h-[220px] w-full object-cover sm:h-[260px]" />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-center text-base text-white/92 sm:h-[260px]">
                点击上传背景封面
              </div>
            )}

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute right-4 top-4 rounded-full bg-white/88 px-4 py-2 text-sm text-[var(--foreground)] shadow-[0_16px_32px_-24px_rgba(38,24,27,0.55)] transition hover:bg-white"
            >
              修改封面
            </button>
          </div>

          <input
            id={coverInputId}
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(event) => void handleImageChange(event, "coverImage")}
          />
        </div>

        <div className="mt-8">
          <SectionTitle icon={<LockIcon className="h-5 w-5" />}>账号安全</SectionTitle>
        </div>

        <div className="mt-5 overflow-hidden rounded-[34px] border border-[rgba(236,197,207,0.76)] bg-[rgba(255,248,249,0.7)]">
          <SecurityRow
            icon={<KeyIcon className="h-6 w-6" />}
            title="修改密码"
            description="定期修改密码有助于保护账号安全"
            buttonLabel="修改"
            onClick={() => {
              setSecurityModal("password");
              setModalError("");
            }}
          />

          <div className="border-t border-dashed border-[rgba(220,173,187,0.45)]" />

          <SecurityRow
            icon={<PhoneIcon className="h-6 w-6" />}
            title="绑定手机"
            description={user.phone.trim() ? `已绑定：${maskPhone(user.phone)}` : "未绑定手机号"}
            buttonLabel="修改"
            onClick={() => {
              setPhoneValue(user.phone);
              setSecurityModal("phone");
              setModalError("");
            }}
            muted
          />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[rgba(220,173,187,0.35)] pt-8 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-[rgba(204,171,180,0.72)] bg-white px-10 py-3 text-[1.1rem] text-[var(--foreground)] shadow-[0_16px_34px_-24px_rgba(120,85,94,0.2)] transition hover:-translate-y-0.5"
          >
            取消
          </button>
          <button
            type="button"
            disabled={savePending}
            onClick={() => void handleSaveProfile()}
            className="rounded-full bg-[linear-gradient(135deg,#7d5a63_0%,#956e76_100%)] px-10 py-3 text-[1.1rem] font-medium text-white shadow-[0_18px_38px_-24px_rgba(120,85,94,0.55)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePending ? "正在保存..." : "保存修改"}
          </button>
        </div>
      </section>

      {securityModal === "password" ? (
        <ModalCard title="修改密码" description="请输入当前密码，并设置新的登录密码。" onClose={closeSecurityModal}>
          {modalError ? (
            <p className="mb-4 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p>
          ) : null}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-[var(--foreground)]/72">当前密码</span>
              <input
                type="password"
                value={passwordDraft.oldPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, oldPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                placeholder="请输入当前密码"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[var(--foreground)]/72">新密码</span>
              <input
                type="password"
                value={passwordDraft.newPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                placeholder="请输入新密码"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[var(--foreground)]/72">确认新密码</span>
              <input
                type="password"
                value={passwordDraft.confirmPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
                placeholder="请再次输入新密码"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeSecurityModal}
              className="rounded-full border border-[var(--outline-variant)] px-5 py-3 text-sm text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleChangePassword()}
              className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-20px_rgba(120,85,94,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? "正在保存..." : "确认修改"}
            </button>
          </div>
        </ModalCard>
      ) : null}

      {securityModal === "phone" ? (
        <ModalCard title="绑定手机" description="绑定手机号后，可用于后续账号安全验证。" onClose={closeSecurityModal}>
          {modalError ? (
            <p className="mb-4 rounded-2xl border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm text-[var(--foreground)]/72">手机号</span>
            <input
              type="tel"
              value={phoneValue}
              onChange={(event) => setPhoneValue(event.target.value)}
              className="w-full rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 outline-none transition focus:border-[var(--primary)]"
              placeholder="请输入手机号"
            />
          </label>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeSecurityModal}
              className="rounded-full border border-[var(--outline-variant)] px-5 py-3 text-sm text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleSavePhone()}
              className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_34px_-20px_rgba(120,85,94,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? "正在保存..." : "确认修改"}
            </button>
          </div>
        </ModalCard>
      ) : null}
    </>
  );
}

function SparklesIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m12 2 1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Zm7 9 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4ZM6 14l1.2 2.8L10 18l-2.8 1.2L6 22l-1.2-2.8L2 18l2.8-1.2L6 14Z" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function LandscapeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 5.25h15A2.25 2.25 0 0 1 21.75 7.5v9A2.25 2.25 0 0 1 19.5 18.75h-15A2.25 2.25 0 0 1 2.25 16.5v-9A2.25 2.25 0 0 1 4.5 5.25Zm0 1.5a.75.75 0 0 0-.75.75v9c0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75h-15Zm2.9 8.9 2.9-3.53a.75.75 0 0 1 1.16.02l2.15 2.67 1.58-1.78a.75.75 0 0 1 1.13.01l2.18 2.61v.6H5.52l1.88-.6Zm2.1-5.03a1.13 1.13 0 1 0 0-2.25 1.13 1.13 0 0 0 0 2.25Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25h-.75A2.25 2.25 0 0 0 4.5 10.5v9A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-.75V6A4.5 4.5 0 0 0 12 1.5Zm-3 6.75V6a3 3 0 1 1 6 0v2.25H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V16.5h-1.5v-2.45a1.5 1.5 0 0 1 .75-2.8Z" fill="currentColor" />
    </svg>
  );
}

function KeyIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M8.25 10.5a4.5 4.5 0 1 1 3.72 4.43l-1.47 1.47h-1.75v1.75H7v1.75H4.5v-3.22l4.1-4.1A4.47 4.47 0 0 1 8.25 10.5Zm4.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z" fill="currentColor" />
    </svg>
  );
}

function PhoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M8.25 2.25h7.5A2.25 2.25 0 0 1 18 4.5v15a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 6 19.5v-15a2.25 2.25 0 0 1 2.25-2.25Zm0 1.5a.75.75 0 0 0-.75.75v15c0 .41.34.75.75.75h7.5a.75.75 0 0 0 .75-.75v-15a.75.75 0 0 0-.75-.75h-7.5Zm2.25 13.5h3v1.5h-3v-1.5Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m6.53 5.47 5.47 5.47 5.47-5.47 1.06 1.06L13.06 12l5.47 5.47-1.06 1.06L12 13.06l-5.47 5.47-1.06-1.06L10.94 12 5.47 6.53l1.06-1.06Z" fill="currentColor" />
    </svg>
  );
}
