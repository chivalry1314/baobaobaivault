"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser, ShareUserRoleManageItem } from "@/lib/shared";

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
    reader.onerror = () => reject(new Error("读取图片失败，请重试"));
    reader.readAsDataURL(file);
  });
}

function validateImage(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png"]);
  if (!allowedTypes.has(file.type)) {
    return "仅支持 JPG 或 PNG 图片";
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
    <div className="flex items-center gap-3 text-[1.12rem] text-[var(--foreground)]">
      <span className="text-[var(--primary)]">{icon}</span>
      <span className="font-black">{children}</span>
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
        <div
          className={`dream-chip flex h-14 w-14 items-center justify-center ${
            muted ? "bg-[#f6d4e4] text-[var(--brand-strong)]" : "bg-[var(--button-primary)] text-[var(--foreground)]"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[1.1rem] font-black text-[var(--foreground)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="btn-subtle self-end rounded-full px-5 py-2.5 text-sm font-black text-[var(--foreground)]/76 sm:self-auto"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function RoleChip({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 text-xs font-black transition ${
        active ? "btn-primary text-[var(--foreground)]" : "btn-subtle text-[var(--foreground)]/72"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
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
      <button type="button" className="absolute inset-0 cursor-pointer" aria-label="关闭弹窗" onClick={onClose} />
      <div className="dream-panel relative z-10 w-full max-w-[500px] p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-[var(--foreground)]">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]/62">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-subtle flex h-11 w-11 items-center justify-center rounded-full text-[var(--foreground)]/62"
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
  const userKey = useMemo(
    () =>
      [
        user.id,
        user.nickname,
        user.bio,
        user.avatar,
        user.coverImage,
        user.phone,
      ].join("|"),
    [user.avatar, user.bio, user.coverImage, user.id, user.nickname, user.phone],
  );

  const [draft, setDraft] = useState<SettingsDraft>(() => createDraft(user));
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [roleUsers, setRoleUsers] = useState<ShareUserRoleManageItem[]>([]);
  const [roleLoadPending, setRoleLoadPending] = useState(false);
  const [roleLoadError, setRoleLoadError] = useState("");
  const [roleUpdatePendingByUser, setRoleUpdatePendingByUser] = useState<Record<string, boolean>>({});

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
    const timer = window.setTimeout(() => {
      setDraft(createDraft(user));
      setPhoneValue(user.phone);
      setSaveError("");
      setSaveSuccess("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userKey, user]);

  const loadRoleUsers = useCallback(async () => {
    if (user.role !== "manager") {
      setRoleUsers([]);
      setRoleLoadPending(false);
      setRoleLoadError("");
      return;
    }

    setRoleLoadPending(true);
    setRoleLoadError("");

    try {
      const payload = await shareApi.adminUsers();
      setRoleUsers(payload.users);
    } catch (error) {
      setRoleLoadError(getShareErrorMessage(error, "加载用户列表失败，请稍后重试"));
    } finally {
      setRoleLoadPending(false);
    }
  }, [user.role]);

  useEffect(() => {
    void loadRoleUsers();
  }, [loadRoleUsers]);

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
      setSaveError(getShareErrorMessage(error, "读取图片失败，请重试"));
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
      setSaveSuccess("资料已更新");
    } catch (error) {
      setSaveError(getShareErrorMessage(error, "保存资料失败，请稍后重试"));
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
      setModalError("新密码长度至少为 6 位");
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
      setSaveSuccess("密码修改成功");
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
      setModalError(getShareErrorMessage(error, "保存手机号失败，请稍后重试"));
      setModalPending(false);
    }
  }

  async function handleUpdateRole(targetUser: ShareUserRoleManageItem, nextRole: "viewer" | "manager") {
    if (targetUser.role === nextRole || roleUpdatePendingByUser[targetUser.id]) {
      return;
    }

    setRoleUpdatePendingByUser((current) => ({ ...current, [targetUser.id]: true }));
    setRoleLoadError("");

    try {
      const payload = await shareApi.updateUserRole(targetUser.id, nextRole);
      setRoleUsers((current) =>
        current.map((item) =>
          item.id === targetUser.id
            ? {
                ...item,
                role: payload.user.role,
              }
            : item,
        ),
      );
      setSaveSuccess("用户角色已更新");
      if (targetUser.id === user.id) {
        onSaved(payload.user);
      }
    } catch (error) {
      setRoleLoadError(getShareErrorMessage(error, "更新用户角色失败，请稍后重试"));
    } finally {
      setRoleUpdatePendingByUser((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });
    }
  }

  return (
    <>
      <section className="dream-panel px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between border-b border-[rgba(220,173,187,0.35)] pb-5">
          <div>
            <h1 className="text-[1.65rem] font-black text-[var(--foreground)]">个人资料设置</h1>
          </div>
          <SparklesIcon className="h-9 w-9 text-[rgba(120,85,94,0.24)]" />
        </div>

        {saveError ? (
          <p className="dream-panel-soft mt-6 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{saveError}</p>
        ) : null}

        {saveSuccess ? (
          <p className="dream-panel-soft mt-6 border-[#d9eed6] bg-[#f3fbf1] px-4 py-3 text-sm text-[#2f6d37]">{saveSuccess}</p>
        ) : null}

        <div className="dream-panel-soft mt-8 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_20px_42px_-30px_rgba(120,85,94,0.45)]">
                {draft.avatar ? (
                  <img src={draft.avatar} alt={draft.nickname || "头像"} className="h-[96px] w-[96px] object-cover" />
                ) : (
                  <div className="flex h-[96px] w-[96px] items-center justify-center bg-[var(--button-primary)] text-3xl font-black text-[var(--foreground)]">
                    {getInitials(user)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[1.1rem] font-black text-[var(--foreground)]">头像</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">支持 JPG/PNG，大小不超过 5MB</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="btn-subtle rounded-full px-8 py-3 text-[1.02rem] font-black"
            >
              更换头像
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
          <SectionTitle icon={<HeartIcon className="h-5 w-5" />}>基础资料</SectionTitle>
        </div>

        <div className="dream-panel-soft mt-5 p-5 sm:p-6">
          <label className="block">
            <span className="text-[1.05rem] font-black text-[var(--foreground)]">昵称</span>
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
              className="dream-input mt-4 w-full px-6 py-4 text-[1.08rem]"
              placeholder="请输入你的昵称"
              maxLength={40}
            />
          </label>

          <div className="mt-8 flex items-center justify-between gap-4">
            <span className="text-[1.05rem] font-black text-[var(--foreground)]">个人简介</span>
            <span className="text-sm text-[var(--text-muted)]">{draft.bio.length}/100</span>
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
            className="dream-textarea mt-4 w-full px-6 py-5 text-[1.05rem] leading-8"
            placeholder="写点关于你的内容，让别人更了解你"
          />
        </div>

        <div className="mt-8">
          <SectionTitle icon={<LandscapeIcon className="h-5 w-5" />}>主页封面</SectionTitle>
        </div>

        <div className="dream-panel-soft mt-5 p-5 sm:p-6">
          <div className="relative overflow-hidden rounded-[30px] border-2 border-dashed border-[var(--outline-variant)] bg-[linear-gradient(135deg,#e9f6ff_0%,#f6f2ff_60%,#ffeef5_100%)]">
            {draft.coverImage ? (
              <img src={draft.coverImage} alt="主页封面" className="h-[220px] w-full object-cover sm:h-[260px]" />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-center text-base font-black text-[var(--foreground)]/70 sm:h-[260px]">
                点击右上角按钮上传封面图
              </div>
            )}

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="btn-subtle absolute right-4 top-4 rounded-full px-4 py-2 text-sm font-black"
            >
              更换封面
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

        <div className="dream-panel-soft mt-5 overflow-hidden">
          <SecurityRow
            icon={<KeyIcon className="h-6 w-6" />}
            title="修改密码"
            description="定期更新密码，提升账号安全性"
            buttonLabel="去修改"
            onClick={() => {
              setSecurityModal("password");
              setModalError("");
            }}
          />

          <div className="dream-divider border-t border-dashed" />

          <SecurityRow
            icon={<PhoneIcon className="h-6 w-6" />}
            title="绑定手机号"
            description={user.phone.trim() ? `当前手机号：${maskPhone(user.phone)}` : "尚未绑定手机号"}
            buttonLabel="去设置"
            onClick={() => {
              setPhoneValue(user.phone);
              setSecurityModal("phone");
              setModalError("");
            }}
            muted
          />
        </div>

        {user.role === "manager" ? (
          <>
            <div className="mt-8">
              <SectionTitle icon={<ShieldIcon className="h-5 w-5" />}>用户角色管理</SectionTitle>
            </div>

            <div className="dream-panel-soft mt-5 overflow-hidden">
              {roleLoadError ? (
                <p className="border-b border-dashed border-[#f3c8ad] bg-[#fff4ec] px-5 py-3 text-sm text-[#9a3412]">{roleLoadError}</p>
              ) : null}

              {roleLoadPending ? (
                <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">正在加载用户列表...</p>
              ) : null}

              {!roleLoadPending && roleUsers.length === 0 ? (
                <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">暂无可管理用户</p>
              ) : null}

              {!roleLoadPending && roleUsers.length > 0 ? (
                <div className="divide-y divide-dashed divide-[var(--outline-variant)]/65">
                  {roleUsers.map((item) => {
                    const displayName = item.nickname.trim() || item.username.trim() || item.email;
                    const pending = Boolean(roleUpdatePendingByUser[item.id]);
                    const isSelf = item.id === user.id;

                    return (
                      <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-[1.05rem] font-black text-[var(--foreground)]">
                            {displayName}
                            {isSelf ? "（我）" : ""}
                          </p>
                          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <RoleChip active={item.role === "viewer"} disabled={pending} onClick={() => void handleUpdateRole(item, "viewer")}>
                            浏览者
                          </RoleChip>
                          <RoleChip active={item.role === "manager"} disabled={pending} onClick={() => void handleUpdateRole(item, "manager")}>
                            管理员
                          </RoleChip>
                          {pending ? <span className="text-xs font-bold text-[var(--text-muted)]">更新中...</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 border-t border-[rgba(220,173,187,0.35)] pt-8 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="btn-subtle rounded-full px-10 py-3 text-[1.05rem] font-black text-[var(--foreground)]"
          >
            重置
          </button>
          <button
            type="button"
            disabled={savePending}
            onClick={() => void handleSaveProfile()}
            className="btn-primary rounded-full px-10 py-3 text-[1.05rem] font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePending ? "保存中..." : "保存修改"}
          </button>
        </div>
      </section>

      {securityModal === "password" ? (
        <ModalCard
          title="修改密码"
          description="请输入当前密码并设置新密码，建议使用 6 位以上的组合密码。"
          onClose={closeSecurityModal}
        >
          {modalError ? (
            <p className="dream-panel-soft mb-4 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p>
          ) : null}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">当前密码</span>
              <input
                type="password"
                value={passwordDraft.oldPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, oldPassword: event.target.value }))}
                className="dream-input w-full px-4 py-3"
                placeholder="请输入当前密码"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">新密码</span>
              <input
                type="password"
                value={passwordDraft.newPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                className="dream-input w-full px-4 py-3"
                placeholder="请输入新密码"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">确认新密码</span>
              <input
                type="password"
                value={passwordDraft.confirmPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="dream-input w-full px-4 py-3"
                placeholder="请再次输入新密码"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={closeSecurityModal} className="btn-subtle rounded-full px-5 py-3 text-sm font-black">
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleChangePassword()}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? "提交中..." : "确认修改"}
            </button>
          </div>
        </ModalCard>
      ) : null}

      {securityModal === "phone" ? (
        <ModalCard title="绑定手机号" description="更新手机号后，可用于账号找回与安全验证。" onClose={closeSecurityModal}>
          {modalError ? (
            <p className="dream-panel-soft mb-4 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">手机号</span>
            <input
              type="tel"
              value={phoneValue}
              onChange={(event) => setPhoneValue(event.target.value)}
              className="dream-input w-full px-4 py-3"
              placeholder="请输入手机号"
            />
          </label>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={closeSecurityModal} className="btn-subtle rounded-full px-5 py-3 text-sm font-black">
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleSavePhone()}
              className="btn-primary rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? "保存中..." : "保存手机号"}
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

function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 2.25 4.5 5.4v5.4c0 4.8 2.97 9.2 7.5 10.95 4.53-1.75 7.5-6.15 7.5-10.95V5.4L12 2.25Zm0 1.62 6 2.52v4.41c0 4.07-2.42 7.8-6 9.38-3.58-1.58-6-5.31-6-9.38V6.39l6-2.52Z" fill="currentColor" />
      <path d="M10.94 14.86 8.6 12.52l-1.06 1.06 3.4 3.4 5.4-5.4-1.06-1.06-4.34 4.34Z" fill="currentColor" />
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
