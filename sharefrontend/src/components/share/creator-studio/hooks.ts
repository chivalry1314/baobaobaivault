import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  matchesAccessModeFilter,
  type ShareAccessModeFilter,
} from "@/components/share/access-mode-filter";
import {
  CARDS_PAGE_SIZE,
  formatMetricValue,
  getDisplayName,
  HISTORY_PAGE_SIZE,
  USER_PAGE_SIZE,
} from "@/components/share/creator-studio/helpers";
import { useShareSession } from "@/components/share/session-provider";
import type {
  ActiveSection,
  ActiveTab,
} from "@/components/share/creator-studio/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  DashboardResponse,
  ExternalSessionUser,
  ShareAuthSettings,
  ShareEmailHealth,
  ShareUserRole,
  ShareUserRoleManageItem,
} from "@/lib/shared";

export function useCreatorStudio() {
  const router = useRouter();
  const { user, sessionChecking, clearSession, setUser } = useShareSession();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [authSettings, setAuthSettings] = useState<ShareAuthSettings | null>(null);
  const [authSettingsDraft, setAuthSettingsDraft] = useState<ShareAuthSettings | null>(null);
  const [authSettingsPending, setAuthSettingsPending] = useState(false);
  const [authSettingsMessage, setAuthSettingsMessage] = useState("");
  const [emailHealth, setEmailHealth] = useState<ShareEmailHealth | null>(null);
  const [smtpTestPending, setSMTPTestPending] = useState(false);
  const [smtpTestMessage, setSMTPTestMessage] = useState("");
  const [smtpTestTargetEmail, setSMTPTestTargetEmail] = useState("");
  const [roleUsers, setRoleUsers] = useState<ShareUserRoleManageItem[]>([]);
  const [roleLoadPending, setRoleLoadPending] = useState(false);
  const [roleLoadError, setRoleLoadError] = useState("");
  const [roleUpdatePendingByUser, setRoleUpdatePendingByUser] = useState<Record<string, boolean>>({});
  const [roleDeletePendingByUser, setRoleDeletePendingByUser] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState("");
  const [activeSection, setActiveSection] =
    useState<ActiveSection>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("cards");
  const [accessModeFilter, setAccessModeFilter] =
    useState<ShareAccessModeFilter>("all");
  const [cardsPage, setCardsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const currentUser = user;
  const allCards = useMemo(() => dashboard?.cards ?? [], [dashboard?.cards]);
  const cards = useMemo(
    () =>
      allCards.filter((item) =>
        matchesAccessModeFilter(item.card.accessMode, accessModeFilter),
      ),
    [accessModeFilter, allCards],
  );
  const displayName = useMemo(
    () => (currentUser ? getDisplayName(currentUser) : ""),
    [currentUser],
  );

  const accountLabel = useMemo(() => {
    if (!currentUser) {
      return "";
    }
    const username = currentUser.username.trim();
    return username ? `@${username}` : currentUser.email;
  }, [currentUser]);

  const heroStats = useMemo(
    () => [
      { value: formatMetricValue(dashboard?.stats.totalCards ?? 0), label: "卡片总数" },
      { value: formatMetricValue(dashboard?.stats.totalPublic ?? 0), label: "公开卡片" },
      {
        value: formatMetricValue(dashboard?.stats.totalDownloads ?? 0),
        label: "累计下载",
        accent: true,
      },
    ],
    [dashboard],
  );

  const historyItems = useMemo(
    () =>
      [...cards].sort(
        (left, right) =>
          new Date(right.card.updatedAt).getTime() -
          new Date(left.card.updatedAt).getTime(),
      ),
    [cards],
  );

  const cardsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(cards.length / CARDS_PAGE_SIZE)),
    [cards.length],
  );
  const historyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE)),
    [historyItems.length],
  );
  const userTotalPages = useMemo(
    () => Math.max(1, Math.ceil(roleUsers.length / USER_PAGE_SIZE)),
    [roleUsers.length],
  );

  const pagedCards = useMemo(() => {
    const safePage = Math.min(Math.max(cardsPage, 1), cardsTotalPages);
    const start = (safePage - 1) * CARDS_PAGE_SIZE;
    return cards.slice(start, start + CARDS_PAGE_SIZE);
  }, [cards, cardsPage, cardsTotalPages]);

  const pagedHistoryItems = useMemo(() => {
    const safePage = Math.min(Math.max(historyPage, 1), historyTotalPages);
    const start = (safePage - 1) * HISTORY_PAGE_SIZE;
    return historyItems.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyItems, historyPage, historyTotalPages]);
  const pagedRoleUsers = useMemo(() => {
    const safePage = Math.min(Math.max(userPage, 1), userTotalPages);
    const start = (safePage - 1) * USER_PAGE_SIZE;
    return roleUsers.slice(start, start + USER_PAGE_SIZE);
  }, [roleUsers, userPage, userTotalPages]);

  useEffect(() => {
    setCardsPage(1);
    setHistoryPage(1);
  }, [dashboard, accessModeFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [currentUser?.role]);

  useEffect(() => {
    let active = true;
    const requests: Array<Promise<unknown>> = [
      shareApi.authConfig(),
      shareApi.emailHealth(),
    ];
    if (currentUser?.role === "manager") {
      requests.push(shareApi.adminAuthSettings().catch(() => null));
    }

    void Promise.all(requests)
      .then((responses) => {
        if (!active) {
          return;
        }
        const authResponse = responses[0] as Awaited<ReturnType<typeof shareApi.authConfig>>;
        const emailResponse = responses[1] as Awaited<ReturnType<typeof shareApi.emailHealth>>;
        const authSettingsResponse =
          responses.length > 2
            ? (responses[2] as Awaited<ReturnType<typeof shareApi.adminAuthSettings>> | null)
            : null;
        setEmailVerificationEnabled(
          authResponse.config.emailVerificationEnabled,
        );
        setEmailHealth(emailResponse.health);
        setAuthSettings(authSettingsResponse?.settings ?? null);
        setAuthSettingsDraft(authSettingsResponse?.settings ?? null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setEmailVerificationEnabled(false);
        setEmailHealth(null);
        setAuthSettings(null);
        setAuthSettingsDraft(null);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) {
      setSMTPTestTargetEmail("");
      return;
    }
    setSMTPTestTargetEmail((current) =>
      current.trim() ? current : currentUser.email,
    );
  }, [currentUser?.email]);

  const loadRoleUsers = useCallback(async () => {
    if (currentUser?.role !== "manager") {
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
      setUserPage(1);
    } catch (error) {
      setRoleLoadError(
        getShareErrorMessage(error, "加载用户列表失败，请稍后重试"),
      );
    } finally {
      setRoleLoadPending(false);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    void loadRoleUsers();
  }, [loadRoleUsers]);

  useEffect(() => {
    setCardsPage((current) => Math.min(Math.max(current, 1), cardsTotalPages));
  }, [cardsTotalPages]);

  useEffect(() => {
    setHistoryPage((current) =>
      Math.min(Math.max(current, 1), historyTotalPages),
    );
  }, [historyTotalPages]);

  useEffect(() => {
    setUserPage((current) => Math.min(Math.max(current, 1), userTotalPages));
  }, [userTotalPages]);

  const heroSurfaceStyle = useMemo(() => {
    if (!currentUser?.coverImage.trim()) {
      return undefined;
    }
    return {
      backgroundImage: `linear-gradient(135deg,rgba(255,255,255,0.84) 0%,rgba(232,247,252,0.76) 52%,rgba(244,251,255,0.88) 100%), url(${currentUser.coverImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [currentUser]);

  const loadDashboard = useCallback(async () => {
    const [cardsPayload, accessCodesPayload] = await Promise.all([
      shareApi.myCards(),
      shareApi.myAccessCodes().catch(() => null),
    ]);

    const activeAccessCodeByCardId = new Map<string, string>();
    const hasConfiguredAccessCodeCardIds = new Set<string>();
    if (accessCodesPayload) {
      for (const item of accessCodesPayload.items) {
        const code = item.config.code.trim();
        if (code) {
          hasConfiguredAccessCodeCardIds.add(item.card.id);
          if (item.config.isActive && item.isPubliclyVisible) {
            activeAccessCodeByCardId.set(item.card.id, code);
          }
        }
      }
    }

    const mergedCards = cardsPayload.cards.map((cardItem) => {
      const mergedCode = activeAccessCodeByCardId.get(cardItem.card.id) ?? "";
      const hasConfiguredCode =
        hasConfiguredAccessCodeCardIds.has(cardItem.card.id) ||
        cardItem.hasAccessCode;
      return {
        ...cardItem,
        hasAccessCode: hasConfiguredCode,
        accessCode: mergedCode || undefined,
      };
    });

    setUser(cardsPayload.user);
    setDashboard({ ...cardsPayload, cards: mergedCards });
    setLoadError("");
  }, [setUser]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!currentUser) {
        setDashboard(null);
        setLoadError("");
        return;
      }

      try {
        await loadDashboard();
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(
          getShareErrorMessage(error, "加载创作中心失败，请稍后重试"),
        );
        setDashboard(null);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [currentUser?.id, loadDashboard]);

  function handleProfileSaved(nextUser: ExternalSessionUser) {
    setUser(nextUser);
    setDashboard((current) => (current ? { ...current, user: nextUser } : current));
  }

  function openCreatePanel() {
    router.push("/creator/new");
  }

  async function handleReload() {
    try {
      await loadDashboard();
      await loadRoleUsers();
    } catch (error) {
      setLoadError(getShareErrorMessage(error, "重新加载失败，请稍后重试"));
    }
  }

  async function handleSMTPTest() {
    if (smtpTestPending) {
      return;
    }

    const targetEmail = smtpTestTargetEmail.trim();
    if (!targetEmail) {
      setSMTPTestMessage("请先填写测试收件邮箱");
      return;
    }

    setSMTPTestPending(true);
    setSMTPTestMessage("");

    try {
      const response = await shareApi.sendSMTPTestEmail({ targetEmail });
      setSMTPTestMessage(`测试邮件已发送至 ${response.targetEmail}`);
    } catch (error) {
      setSMTPTestMessage(
        getShareErrorMessage(error, "测试邮件发送失败，请稍后重试"),
      );
    } finally {
      setSMTPTestPending(false);
    }
  }

  function updateAuthSettingsDraft(
    patch: Partial<ShareAuthSettings>,
  ) {
    setAuthSettingsDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, ...patch };
    });
    setAuthSettingsMessage("");
  }

  async function handleSaveAuthSettings() {
    if (!authSettingsDraft || authSettingsPending) {
      return;
    }

    setAuthSettingsPending(true);
    setAuthSettingsMessage("");

    try {
      const response = await shareApi.updateAdminAuthSettings({
        emailVerificationEnabled: authSettingsDraft.emailVerificationEnabled,
        verificationCodeTTLSeconds: authSettingsDraft.verificationCodeTTLSeconds,
        resendIntervalSeconds: authSettingsDraft.resendIntervalSeconds,
        maxVerifyAttempts: authSettingsDraft.maxVerifyAttempts,
      });
      setAuthSettings(response.settings);
      setAuthSettingsDraft(response.settings);
      setEmailVerificationEnabled(response.settings.emailVerificationEnabled);
      setAuthSettingsMessage("邮箱注册策略已保存");
    } catch (error) {
      setAuthSettingsMessage(
        getShareErrorMessage(error, "保存邮箱注册策略失败，请稍后重试"),
      );
    } finally {
      setAuthSettingsPending(false);
    }
  }

  async function handleUpdateRole(
    targetUser: ShareUserRoleManageItem,
    nextRole: ShareUserRole,
  ) {
    if (!currentUser) {
      return;
    }
    if (targetUser.role === nextRole || roleUpdatePendingByUser[targetUser.id]) {
      return;
    }
    if (targetUser.id === currentUser.id && nextRole !== "manager") {
      setRoleLoadError("不能将自己的角色降级为非管理员");
      return;
    }

    setRoleUpdatePendingByUser((current) => ({
      ...current,
      [targetUser.id]: true,
    }));
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
      if (targetUser.id === currentUser.id) {
        handleProfileSaved(payload.user);
      }
    } catch (error) {
      setRoleLoadError(
        getShareErrorMessage(error, "更新用户角色失败，请稍后重试"),
      );
    } finally {
      setRoleUpdatePendingByUser((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });
    }
  }

  async function handleDeleteUser(targetUser: ShareUserRoleManageItem) {
    if (!currentUser) {
      return;
    }
    if (targetUser.id === currentUser.id) {
      setRoleLoadError("不能注销自己的账号");
      return;
    }
    if (roleDeletePendingByUser[targetUser.id]) {
      return;
    }

    const displayName =
      targetUser.nickname.trim() || targetUser.username.trim() || targetUser.email;
    const confirmed = window.confirm(
      `确认要注销用户“${displayName}”吗？该操作会逻辑删除账号，并将其卡片转为私有归档。`,
    );
    if (!confirmed) {
      return;
    }

    setRoleDeletePendingByUser((current) => ({
      ...current,
      [targetUser.id]: true,
    }));
    setRoleLoadError("");

    try {
      await shareApi.deleteAdminUser(targetUser.id);
      setRoleUsers((current) => current.filter((item) => item.id !== targetUser.id));
    } catch (error) {
      setRoleLoadError(
        getShareErrorMessage(error, "注销用户失败，请稍后重试"),
      );
    } finally {
      setRoleDeletePendingByUser((current) => {
        const next = { ...current };
        delete next[targetUser.id];
        return next;
      });
    }
  }

  async function handleLogout() {
    await shareApi.logout().catch(() => null);
    clearSession();
    setDashboard(null);
    router.push("/");
    router.refresh();
  }

  return {
    sessionChecking,
    currentUser,
    dashboard,
    loadError,
    activeSection,
    setActiveSection,
    activeTab,
    setActiveTab,
    accessModeFilter,
    setAccessModeFilter,
    cardsPage,
    setCardsPage,
    historyPage,
    setHistoryPage,
    userPage,
    setUserPage,
    cards,
    displayName,
    accountLabel,
    emailVerificationEnabled,
    authSettings,
    authSettingsDraft,
    authSettingsPending,
    authSettingsMessage,
    emailHealth,
    smtpTestPending,
    smtpTestMessage,
    smtpTestTargetEmail,
    setSMTPTestTargetEmail,
    updateAuthSettingsDraft,
    roleUsers,
    pagedRoleUsers,
    roleLoadPending,
    roleLoadError,
    roleUpdatePendingByUser,
    roleDeletePendingByUser,
    heroStats,
    historyItems,
    cardsTotalPages,
    historyTotalPages,
    userTotalPages,
    pagedCards,
    pagedHistoryItems,
    heroSurfaceStyle,
    handleProfileSaved,
    openCreatePanel,
    handleReload,
    handleSaveAuthSettings,
    handleSMTPTest,
    handleUpdateRole,
    handleDeleteUser,
    handleLogout,
  };
}
