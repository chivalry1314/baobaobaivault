"use client";

import { AccessModeFilterPills } from "@/components/share/access-mode-filter";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import {
  formatUid,
  getUserTagline,
} from "@/components/share/creator-studio/helpers";
import { useCreatorStudio } from "@/components/share/creator-studio/hooks";
import {
  Avatar,
  CreatorCard,
  CreatorStudioIcons,
  EmptyState,
  HistoryItem,
  SidebarButton,
  TabButton,
} from "@/components/share/creator-studio/sections";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { ShareProfileSettings } from "@/components/share/profile-settings";
import { UnifiedFooter } from "@/components/share/unified-footer/index";

const {
  CardIcon,
  HomeIcon,
  KeyIcon,
  PlusIcon,
  ReviewIcon,
  SettingsIcon,
} = CreatorStudioIcons;

export function CreatorStudio() {
  const {
    sessionChecking,
    currentUser,
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
    cards,
    displayName,
    accountLabel,
    heroStats,
    historyItems,
    cardsTotalPages,
    historyTotalPages,
    pagedCards,
    pagedHistoryItems,
    heroSurfaceStyle,
    handleProfileSaved,
    openCreatePanel,
    handleReload,
    handleLogout,
  } = useCreatorStudio();

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="dream-panel mx-auto max-w-7xl px-6 py-14 text-center text-[var(--foreground)]/72">
          正在加载创作中心...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath="/creator" />;
  }

  const isManager = currentUser.role === "manager";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f9fdff_45%,#f2faff_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-[-120px] top-12 h-80 w-80 rounded-full bg-[rgba(172,228,247,0.36)] blur-3xl" />
        <div className="absolute right-[-80px] top-52 h-80 w-80 rounded-full bg-[rgba(200,233,248,0.3)] blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-[rgba(248,219,230,0.26)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[var(--layout-max)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="dream-panel p-6 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-10 lg:min-h-[calc(100vh-3rem)]">
            <div>
              <div className="flex items-center gap-4">
                <Avatar user={currentUser} size="sm" />
                <div className="min-w-0">
                  <p className="type-h3 truncate text-[var(--foreground)]">
                    {displayName}
                  </p>
                  <p className="type-body-sm mt-1 text-[var(--text-muted)]">
                    UID: {formatUid(currentUser.id)}
                  </p>
                </div>
              </div>

              <div className="mt-10 space-y-3">
                <SidebarButton href="/" icon={<HomeIcon className="h-5 w-5" />}>
                  返回首页
                </SidebarButton>
                <SidebarButton
                  active={activeSection === "dashboard"}
                  onClick={() => setActiveSection("dashboard")}
                  icon={<CardIcon className="h-5 w-5" />}
                >
                  卡片管理
                </SidebarButton>
                <SidebarButton
                  href="/creator/access-codes"
                  icon={<KeyIcon className="h-5 w-5" />}
                >
                  提取码管理
                </SidebarButton>
                {isManager ? (
                  <SidebarButton
                    href="/creator/reviews"
                    icon={<ReviewIcon className="h-5 w-5" />}
                  >
                    审核中心
                  </SidebarButton>
                ) : null}
                <SidebarButton
                  active={activeSection === "settings"}
                  onClick={() => setActiveSection("settings")}
                  icon={<SettingsIcon className="h-5 w-5" />}
                >
                  个人资料设置
                </SidebarButton>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="btn-subtle rounded-full px-4 py-3 text-sm font-black text-[var(--foreground)]/68 lg:mt-auto"
            >
              退出登录
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          {loadError ? (
            <div className="dream-panel-soft flex flex-col gap-3 border-[#f3c8ad] bg-[#fff6ef] px-5 py-4 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="btn-subtle w-fit rounded-full border-[#f1b18a] px-4 py-2 text-sm"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {activeSection === "dashboard" ? (
            <>
              <section className="dream-panel overflow-hidden p-3">
                <div
                  className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,rgba(255,255,255,0.94) 0%,rgba(233,247,252,0.86) 52%,rgba(246,252,255,0.95) 100%)] px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
                  style={heroSurfaceStyle}
                >
                  <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                      <div className="rounded-full border-[6px] border-white/90 bg-white/85 p-1 shadow-[0_22px_54px_-34px_rgba(120,85,94,0.45)]">
                        <Avatar user={currentUser} />
                      </div>
                      <div className="max-w-2xl">
                        <p className="type-overline text-[var(--primary)]/55">
                          Card Share
                        </p>
                        <h1 className="type-hero mt-3 text-[var(--foreground)]">
                          {displayName}
                        </h1>
                        <p className="type-h3 mt-3 text-[var(--foreground)]/68">
                          {getUserTagline(currentUser)}
                        </p>
                        <p className="type-body-sm mt-4 text-[var(--text-subtle)]">
                          {accountLabel}
                        </p>
                      </div>
                    </div>

                    <div className="dream-panel-soft grid gap-3 p-4 sm:grid-cols-3">
                      {heroStats.map((item) => (
                        <div
                          key={item.label}
                          className="min-w-[112px] rounded-[22px] px-4 py-4 text-center"
                        >
                          <div
                            className={`type-h2 ${
                              item.accent
                                ? "text-[var(--brand-strong)]"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {item.value}
                          </div>
                          <div
                            className={`type-body-sm mt-1 ${
                              item.accent
                                ? "text-[var(--brand)]"
                                : "text-[var(--foreground)]/62"
                            }`}
                          >
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="dream-panel px-6 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-4 border-b border-[rgba(220,173,187,0.35)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-6">
                    <TabButton
                      active={activeTab === "cards"}
                      onClick={() => {
                        setActiveTab("cards");
                        setCardsPage(1);
                      }}
                    >
                      我的卡片
                    </TabButton>
                    <TabButton
                      active={activeTab === "collections"}
                      onClick={() => setActiveTab("collections")}
                    >
                      收藏夹
                    </TabButton>
                    <TabButton
                      active={activeTab === "history"}
                      onClick={() => {
                        setActiveTab("history");
                        setHistoryPage(1);
                      }}
                    >
                      最近更新
                    </TabButton>
                  </div>

                  <button
                    type="button"
                    onClick={openCreatePanel}
                    className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black"
                  >
                    <PlusIcon className="h-4 w-4" />
                    新建卡片
                  </button>
                </div>

                <div className="pt-6">
                  {activeTab !== "collections" ? (
                    <div className="mb-5 flex flex-col gap-3 rounded-[22px] border-[3px] border-[var(--outline-variant)] bg-[rgba(248,252,255,0.92)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-black text-[var(--foreground)]">
                          访问方式筛选
                        </div>
                        <div className="mt-1 text-xs font-bold text-[var(--foreground)]/56">
                          只看免费卡片，或只看需要提取码的卡片。
                        </div>
                      </div>
                      <AccessModeFilterPills
                        value={accessModeFilter}
                        onChange={setAccessModeFilter}
                      />
                    </div>
                  ) : null}

                  {activeTab === "cards" ? (
                    cards.length > 0 ? (
                      <div className="space-y-5">
                        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {pagedCards.map((item) => (
                            <CreatorCard key={item.card.id} item={item} />
                          ))}
                        </div>
                        <PaginationControls
                          page={cardsPage}
                          totalPages={cardsTotalPages}
                          onPageChange={(nextPage) =>
                            setCardsPage(
                              Math.min(Math.max(nextPage, 1), cardsTotalPages),
                            )
                          }
                        />
                      </div>
                    ) : (
                      <EmptyState
                        title="还没有卡片内容"
                        description="点击右上角新建卡片，上传素材并填写描述后就可以开始分享。"
                        actionLabel="创建第一张卡片"
                        onAction={openCreatePanel}
                      />
                    )
                  ) : null}

                  {activeTab === "collections" ? (
                    <EmptyState
                      title="收藏功能即将上线"
                      description="很快你就可以在这里管理收藏的卡片内容，先去首页浏览更多作品吧。"
                      actionLabel="前往首页"
                      actionHref="/"
                    />
                  ) : null}

                  {activeTab === "history" ? (
                    historyItems.length > 0 ? (
                      <div className="space-y-5">
                        <div className="space-y-4">
                          {pagedHistoryItems.map((item) => (
                            <HistoryItem key={item.card.id} item={item} />
                          ))}
                        </div>
                        <PaginationControls
                          page={historyPage}
                          totalPages={historyTotalPages}
                          onPageChange={(nextPage) =>
                            setHistoryPage(
                              Math.min(Math.max(nextPage, 1), historyTotalPages),
                            )
                          }
                        />
                      </div>
                    ) : (
                      <EmptyState
                        title="暂无更新记录"
                        description="当你创建或编辑卡片后，这里会展示最近的更新时间线。"
                        actionLabel="去创建卡片"
                        onAction={openCreatePanel}
                      />
                    )
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <ShareProfileSettings
              user={currentUser}
              onSaved={handleProfileSaved}
            />
          )}
        </main>
      </div>

      <UnifiedFooter />
    </div>
  );
}
