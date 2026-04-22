import { useState } from "react";
import { api } from "../api";
import { emptyAkskForm, emptyPasswordForm } from "../constants/forms";

export default function useAccountController({ token, act }) {
  const [akskForm, setAkskForm] = useState(emptyAkskForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [akskList, setAkskList] = useState([]);
  const [lastSecret, setLastSecret] = useState("");

  async function loadAksk() {
    const list = await api.listAKSK(token);
    setAkskList(Array.isArray(list) ? list : []);
  }

  async function onCreateAksk(event) {
    event.preventDefault();
    const result = await act(
      () => api.createAKSK(token, { description: akskForm.description, expires_in_days: Number(akskForm.expiresInDays) || 0 }),
      "AK/SK 创建成功"
    );
    if (result) {
      setLastSecret(result.secret_key || "");
      setAkskForm(emptyAkskForm);
      await loadAksk();
    }
  }

  async function onRevokeAksk(id) {
    const ok = await act(() => api.revokeAKSK(token, id), "AK/SK 已吊销");
    if (ok) await loadAksk();
  }

  async function onChangePassword(event) {
    event.preventDefault();
    const ok = await act(
      () => api.changePassword(token, { old_password: passwordForm.oldPassword, new_password: passwordForm.newPassword }),
      "密码已更新"
    );
    if (ok) setPasswordForm(emptyPasswordForm);
  }

  function resetAccount() {
    setAkskForm(emptyAkskForm);
    setPasswordForm(emptyPasswordForm);
    setAkskList([]);
    setLastSecret("");
  }

  return {
    akskForm,
    setAkskForm,
    passwordForm,
    setPasswordForm,
    akskList,
    lastSecret,
    loadAksk,
    onCreateAksk,
    onRevokeAksk,
    onChangePassword,
    resetAccount,
  };
}
