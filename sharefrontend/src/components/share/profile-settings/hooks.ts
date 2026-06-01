import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { createDraft, readFileAsDataUrl, validateImage } from "@/components/share/profile-settings/helpers";
import type { PasswordDraft, SecurityModal, SettingsDraft } from "@/components/share/profile-settings/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { ExternalSessionUser, ShareUserRole, ShareUserRoleManageItem } from "@/lib/shared";

type UseShareProfileSettingsArgs = {
  user: ExternalSessionUser;
  onSaved: (user: ExternalSessionUser) => void;
};

const initialPasswordDraft: PasswordDraft = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function useShareProfileSettings({ user, onSaved }: UseShareProfileSettingsArgs) {
  const userKey = useMemo(() => [user.id, user.nickname, user.bio, user.avatar, user.coverImage, user.phone].join("|"), [user.avatar, user.bio, user.coverImage, user.id, user.nickname, user.phone]);

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
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(initialPasswordDraft);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(createDraft(user));
      setPhoneValue(user.phone);
      setSaveError("");
      setSaveSuccess("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, userKey]);

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
    setPasswordDraft(initialPasswordDraft);
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

  async function handleUpdateRole(targetUser: ShareUserRoleManageItem, nextRole: ShareUserRole) {
    if (targetUser.role === nextRole || roleUpdatePendingByUser[targetUser.id]) {
      return;
    }
    if (targetUser.id === user.id && nextRole !== "manager") {
      setRoleLoadError("不能将自己的角色降级为非管理员");
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

  return {
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
  };
}
