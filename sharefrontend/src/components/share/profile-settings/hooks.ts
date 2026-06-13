import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import {
  createDraft,
  readFileAsDataUrl,
  validateImage,
} from "@/components/share/profile-settings/helpers";
import type {
  PasswordDraft,
  SecurityModal,
  SettingsDraft,
} from "@/components/share/profile-settings/types";
import { useConfirm } from "@/components/share/confirm-dialog";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser } from "@/lib/shared";

type UseShareProfileSettingsArgs = {
  user: ExternalSessionUser;
  onSaved: (user: ExternalSessionUser) => void;
};

const initialPasswordDraft: PasswordDraft = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function useShareProfileSettings({
  user,
  onSaved,
}: UseShareProfileSettingsArgs) {
  const router = useRouter();
  const confirm = useConfirm();
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

  const [securityModal, setSecurityModal] = useState<SecurityModal>(null);
  const [modalPending, setModalPending] = useState(false);
  const [modalError, setModalError] = useState("");
  const [phoneValue, setPhoneValue] = useState(user.phone);
  const [passwordDraft, setPasswordDraft] =
    useState<PasswordDraft>(initialPasswordDraft);
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(createDraft(user));
      setPhoneValue(user.phone);
      setSaveError("");
      setSaveSuccess("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, userKey]);

  async function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
    target: "avatar" | "coverImage",
  ) {
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
    setPasswordDraft(initialPasswordDraft);
    setPhoneValue(user.phone);
    setDeletePassword("");
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

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      setModalError("请输入当前密码以确认注销");
      return;
    }

    const confirmed = await confirm({
      title: "注销账号",
      description: "确认注销当前账号吗？注销后你将立即退出登录，原邮箱可以重新注册，但会作为全新账号。",
      confirmText: "注销",
      cancelText: "取消",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setModalPending(true);
    setModalError("");

    try {
      await shareApi.deleteOwnAccount({ oldPassword: deletePassword });
      await shareApi.logout().catch(() => null);
      router.push("/");
      router.refresh();
    } catch (error) {
      setModalError(getShareErrorMessage(error, "注销账号失败，请稍后重试"));
      setModalPending(false);
    }
  }

  return {
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
  };
}
