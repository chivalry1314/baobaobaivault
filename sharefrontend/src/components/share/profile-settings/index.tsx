"use client";

import { useId, useRef } from "react";

import { createDraft, getInitials, maskPhone } from "@/components/share/profile-settings/helpers";
import { useShareProfileSettings } from "@/components/share/profile-settings/hooks";
import { ModalCard, ProfileSettingsIcons, RoleChip, SectionTitle, SecurityRow } from "@/components/share/profile-settings/sections";
import type { ExternalSessionUser } from "@/lib/shared";

const { HeartIcon, KeyIcon, LandscapeIcon, LockIcon, PhoneIcon, ShieldIcon, SparklesIcon } = ProfileSettingsIcons;

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

  const {
    draft,
    setDraft,
    savePending,
    saveError,
    saveSuccess,
    setSaveError,
    setSaveSuccess,
    roleUsers,
    roleLoadPending,
    roleLoadError,
    roleUpdatePendingByUser,
    securityModal,
    setSecurityModal,
    modalPending,
    modalError,
    setModalError,
    phoneValue,
    setPhoneValue,
    passwordDraft,
    setPasswordDraft,
    handleImageChange,
    handleSaveProfile,
    handleReset,
    closeSecurityModal,
    handleChangePassword,
    handleSavePhone,
    handleUpdateRole,
  } = useShareProfileSettings({ user, onSaved });

  return (
    <>
      <section className="dream-panel px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between border-b border-[rgba(220,173,187,0.35)] pb-5">
          <div>
            <h1 className="text-[1.65rem] font-black text-[var(--foreground)]">个人资料设置</h1>
          </div>
          <SparklesIcon className="h-9 w-9 text-[rgba(120,85,94,0.24)]" />
        </div>

        {saveError ? <p className="dream-panel-soft mt-6 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{saveError}</p> : null}

        {saveSuccess ? <p className="dream-panel-soft mt-6 border-[#d9eed6] bg-[#f3fbf1] px-4 py-3 text-sm text-[#2f6d37]">{saveSuccess}</p> : null}

        <div className="dream-panel-soft mt-8 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_20px_42px_-30px_rgba(120,85,94,0.45)]">
                {draft.avatar ? (
                  <img src={draft.avatar} alt={draft.nickname || "头像"} className="h-[96px] w-[96px] object-cover" />
                ) : (
                  <div className="flex h-[96px] w-[96px] items-center justify-center bg-[var(--button-primary)] text-3xl font-black text-[var(--foreground)]">{getInitials(user)}</div>
                )}
              </div>

              <div>
                <p className="text-[1.1rem] font-black text-[var(--foreground)]">头像</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">支持 JPG/PNG，大小不超过 5MB</p>
              </div>
            </div>

            <button type="button" onClick={() => avatarInputRef.current?.click()} className="btn-subtle rounded-full px-8 py-3 text-[1.02rem] font-black">
              更换头像
            </button>
          </div>

          <input id={avatarInputId} ref={avatarInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void handleImageChange(event, "avatar")} />
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
              <div className="flex h-[220px] items-center justify-center text-center text-base font-black text-[var(--foreground)]/70 sm:h-[260px]">点击右上角按钮上传封面图</div>
            )}

            <button type="button" onClick={() => coverInputRef.current?.click()} className="btn-subtle absolute right-4 top-4 rounded-full px-4 py-2 text-sm font-black">
              更换封面
            </button>
          </div>

          <input id={coverInputId} ref={coverInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void handleImageChange(event, "coverImage")} />
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
              {roleLoadError ? <p className="border-b border-dashed border-[#f3c8ad] bg-[#fff4ec] px-5 py-3 text-sm text-[#9a3412]">{roleLoadError}</p> : null}

              {roleLoadPending ? <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">正在加载用户列表...</p> : null}

              {!roleLoadPending && roleUsers.length === 0 ? <p className="px-5 py-5 text-sm font-bold text-[var(--text-muted)]">暂无可管理用户</p> : null}

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
                          <RoleChip active={item.role === "viewer"} disabled={pending || isSelf} onClick={() => void handleUpdateRole(item, "viewer")}>
                            浏览者
                          </RoleChip>
                          <RoleChip active={item.role === "creator"} disabled={pending || isSelf} onClick={() => void handleUpdateRole(item, "creator")}>
                            创作者
                          </RoleChip>
                          <RoleChip active={item.role === "manager"} disabled={pending} onClick={() => void handleUpdateRole(item, "manager")}>
                            管理员
                          </RoleChip>
                          {isSelf ? <span className="text-xs font-bold text-[var(--text-muted)]">本人不可降为创作者或浏览者</span> : null}
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
          <button type="button" onClick={handleReset} className="btn-subtle rounded-full px-10 py-3 text-[1.05rem] font-black text-[var(--foreground)]">
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
        <ModalCard title="修改密码" description="请输入当前密码并设置新密码，建议使用 6 位以上的组合密码。" onClose={closeSecurityModal}>
          {modalError ? <p className="dream-panel-soft mb-4 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p> : null}

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
          {modalError ? <p className="dream-panel-soft mb-4 border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{modalError}</p> : null}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--foreground)]/72">手机号</span>
            <input type="tel" value={phoneValue} onChange={(event) => setPhoneValue(event.target.value)} className="dream-input w-full px-4 py-3" placeholder="请输入手机号" />
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

