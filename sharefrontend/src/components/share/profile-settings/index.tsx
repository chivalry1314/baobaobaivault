"use client";

import { useId, useRef } from "react";

import {
  getInitials,
  maskPhone,
} from "@/components/share/profile-settings/helpers";
import { useShareProfileSettings } from "@/components/share/profile-settings/hooks";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import { ShareImage } from "@/components/share/share-image";
import {
  ModalCard,
  ProfileSettingsIcons,
  SectionTitle,
  SecurityRow,
} from "@/components/share/profile-settings/sections";
import type { ExternalSessionUser } from "@/lib/shared";

const {
  HeartIcon,
  KeyIcon,
  LandscapeIcon,
  LockIcon,
  PhoneIcon,
  SparklesIcon,
} = ProfileSettingsIcons;

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
    securityModal,
    setSecurityModal,
    modalPending,
    modalError,
    setModalError,
    phoneValue,
    setPhoneValue,
    passwordDraft,
    setPasswordDraft,
    deletePassword,
    setDeletePassword,
    handleImageChange,
    handleSaveProfile,
    handleReset,
    closeSecurityModal,
    handleChangePassword,
    handleSavePhone,
    handleDeleteAccount,
  } = useShareProfileSettings({ user, onSaved });

  return (
    <>
      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between border-b border-[var(--outline)]/12 pb-4">
          <div>
            <h1 className="text-xl font-black text-[var(--foreground)]">
              个人资料设置
            </h1>
          </div>
          <SparklesIcon className="h-6 w-6 text-[var(--foreground)]/16" />
        </div>

        {saveError ? (
          <p className="mt-4 rounded-xl border border-[#e59273] bg-[#fff4ec] px-3.5 py-2.5 text-xs font-bold text-[#9a3412]">
            {saveError}
          </p>
        ) : null}

        {saveSuccess ? (
          <p className="mt-4 rounded-xl border border-[#b8dec8] bg-[#f3fbf1] px-3.5 py-2.5 text-xs font-bold text-[#2f6d37]">
            {saveSuccess}
          </p>
        ) : null}

        <div className="mt-5 rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="overflow-hidden rounded-full border-2 border-white bg-white shadow-[0_16px_32px_-24px_rgba(120,85,94,0.4)]">
                {draft.avatar ? (
                  <ShareImage
                    src={draft.avatar}
                    alt={draft.nickname || "头像"}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-[var(--button-primary)] text-xl font-black text-[var(--foreground)]">
                    {getInitials(user)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-black text-[var(--foreground)]">
                  头像
                </p>
                <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">
                  支持 JPG/PNG，大小不超过 5MB
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="rounded-full border-2 border-[var(--outline)] bg-white px-5 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)]"
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

        <div className="mt-6">
          <SectionTitle icon={<HeartIcon className="h-4 w-4" />}>
            基础资料
          </SectionTitle>
        </div>

        <div className="mt-3 rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] p-4 sm:p-5">
          <label className="block">
            <span className="text-sm font-black text-[var(--foreground)]">
              昵称
            </span>
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
              className="dream-input border-2 mt-3 w-full px-4 py-2.5 text-sm"
              placeholder="请输入你的昵称"
              maxLength={40}
            />
          </label>

          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-sm font-black text-[var(--foreground)]">
              个人简介
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {draft.bio.length}/100
            </span>
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
            rows={4}
            className="dream-textarea border-2 mt-3 w-full px-4 py-3 text-sm leading-6"
            placeholder="写点关于你的内容，让别人更了解你"
          />
        </div>

        <div className="mt-6">
          <SectionTitle icon={<LandscapeIcon className="h-4 w-4" />}>
            主页封面
          </SectionTitle>
        </div>

        <div className="mt-3 rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)] p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-[1rem] border-2 border-dashed border-[var(--outline-variant)] bg-[linear-gradient(135deg,#e9f6ff_0%,#f6f2ff_60%,#ffeef5_100%)]">
            {draft.coverImage ? (
              <ShareImage
                src={draft.coverImage}
                alt="主页封面"
                className="h-[180px] w-full object-cover sm:h-[220px]"
              />
            ) : (
              <div className="flex h-[180px] items-center justify-center text-center text-sm font-black text-[var(--foreground)]/70 sm:h-[220px]">
                点击右上角按钮上传封面图
              </div>
            )}

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute right-3 top-3 rounded-full border-2 border-[var(--outline)] bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)]"
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

        <div className="mt-6">
          <SectionTitle icon={<LockIcon className="h-4 w-4" />}>
            账号安全
          </SectionTitle>
        </div>

        <div className="mt-3 overflow-hidden rounded-[1.2rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]">
          <SecurityRow
            icon={<KeyIcon className="h-5 w-5" />}
            title="修改密码"
            description="定期更新密码，提升账号安全性"
            buttonLabel="去修改"
            onClick={() => {
              setSecurityModal("password");
              setModalError("");
            }}
          />

          <div className="border-t border-dashed border-[var(--outline)]/15" />

          <SecurityRow
            icon={<PhoneIcon className="h-5 w-5" />}
            title="绑定手机号"
            description={
              user.phone.trim()
                ? `当前手机号：${maskPhone(user.phone)}`
                : "尚未绑定手机号"
            }
            buttonLabel="去设置"
            onClick={() => {
              setPhoneValue(user.phone);
              setSecurityModal("phone");
              setModalError("");
            }}
            muted
          />

          <div className="border-t border-dashed border-[var(--outline)]/15" />

          <SecurityRow
            icon={<LockIcon className="h-5 w-5" />}
            title="注销账户"
            description="注销后将立即退出登录，当前账号资料会封存，原邮箱后续可重新注册为全新账号。"
            buttonLabel="去注销"
            onClick={() => {
              setDeletePassword("");
              setSecurityModal("delete_account");
              setModalError("");
            }}
            muted
          />
        </div>

        <div className="mt-8 flex flex-col gap-2.5 border-t border-[var(--outline)]/12 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border-2 border-[var(--outline)] bg-white px-6 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)]"
          >
            重置
          </button>
          <button
            type="button"
            disabled={savePending}
            onClick={() => void handleSaveProfile()}
            className="inline-flex items-center justify-center rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-6 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePending ? <LoadingSpinner size="sm" inline label="保存中..." /> : "保存修改"}
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
            <p className="mb-4 rounded-xl border border-[#e59273] bg-[#fff4ec] px-3.5 py-2.5 text-xs font-bold text-[#9a3412]">
              {modalError}
            </p>
          ) : null}

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/72">
                当前密码
              </span>
              <input
                type="password"
                value={passwordDraft.oldPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    oldPassword: event.target.value,
                  }))
                }
                className="dream-input border-2 w-full px-3.5 py-2.5 text-sm"
                placeholder="请输入当前密码"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/72">
                新密码
              </span>
              <input
                type="password"
                value={passwordDraft.newPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                className="dream-input border-2 w-full px-3.5 py-2.5 text-sm"
                placeholder="请输入新密码"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/72">
                确认新密码
              </span>
              <input
                type="password"
                value={passwordDraft.confirmPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                className="dream-input border-2 w-full px-3.5 py-2.5 text-sm"
                placeholder="请再次输入新密码"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeSecurityModal}
              className="rounded-full border-2 border-[var(--outline)] bg-white px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--surface-container)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleChangePassword()}
              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? <LoadingSpinner size="sm" inline label="提交中..." /> : "确认修改"}
            </button>
          </div>
        </ModalCard>
      ) : null}

      {securityModal === "phone" ? (
        <ModalCard
          title="绑定手机号"
          description="更新手机号后，可用于账号找回与安全验证。"
          onClose={closeSecurityModal}
        >
          {modalError ? (
            <p className="mb-4 rounded-xl border border-[#e59273] bg-[#fff4ec] px-3.5 py-2.5 text-xs font-bold text-[#9a3412]">
              {modalError}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/72">
              手机号
            </span>
            <input
              type="tel"
              value={phoneValue}
              onChange={(event) => setPhoneValue(event.target.value)}
              className="dream-input border-2 w-full px-3.5 py-2.5 text-sm"
              placeholder="请输入手机号"
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeSecurityModal}
              className="rounded-full border-2 border-[var(--outline)] bg-white px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--surface-container)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleSavePhone()}
              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? <LoadingSpinner size="sm" inline label="保存中..." /> : "保存手机号"}
            </button>
          </div>
        </ModalCard>
      ) : null}

      {securityModal === "delete_account" ? (
        <ModalCard
          title="注销账户"
          description="请输入当前密码确认注销。注销完成后你会立即退出登录，原邮箱之后可以重新注册，但会作为全新账号。"
          onClose={closeSecurityModal}
        >
          {modalError ? (
            <p className="mb-4 rounded-xl border border-[#e59273] bg-[#fff4ec] px-3.5 py-2.5 text-xs font-bold text-[#9a3412]">
              {modalError}
            </p>
          ) : null}

          <div className="rounded-[1rem] border border-[#f3d1cf] bg-[#fff7f6] px-3.5 py-3 text-xs leading-5 font-bold text-[#8a3b32]">
            注销后当前账号将不可继续登录，名下公开内容会转为私有归档。若你之后再次使用原邮箱注册，将会得到一个全新账号。
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-black text-[var(--foreground)]/72">
              当前密码
            </span>
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="dream-input border-2 w-full px-3.5 py-2.5 text-sm"
              placeholder="请输入当前密码"
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeSecurityModal}
              className="rounded-full border-2 border-[var(--outline)] bg-white px-4 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--surface-container)]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={modalPending}
              onClick={() => void handleDeleteAccount()}
              className="inline-flex items-center justify-center rounded-full border-2 border-[#c94c3b] bg-[#c94c3b] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#b64031] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modalPending ? <LoadingSpinner size="sm" inline label="注销中..." /> : "确认注销"}
            </button>
          </div>
        </ModalCard>
      ) : null}
    </>
  );
}
