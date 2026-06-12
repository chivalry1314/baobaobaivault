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
  FavoriteCard,
  HistoryItem,
  SidebarButton,
  TabButton,
} from "@/components/share/creator-studio/sections";
import { PaginationControls } from "@/components/share/pagination-controls/index";
import { ShareProfileSettings } from "@/components/share/profile-settings";
import { useShareSiteBrand } from "@/components/share/site-brand/provider";
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
  const brand = useShareSiteBrand();
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
    favorites,
    favoritesPage,
    favoritesTotalPages,
    favoritesLoading,
    favoritesError,
    loadFavoritesPage,
    removeFavoriteFromList,
    heroSurfaceStyle,
    handleProfileSaved,
    openCreatePanel,
    handleReload,
    handleLogout,
  } = useCreatorStudio();

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.4rem] border-2 border-[var(--outline)] bg-white px-6 py-14 text-center text-[var(--foreground)]/72 shadow-sm">
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
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--background)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-[-120px] top-12 h-72 w-72 rounded-full bg-[rgba(172,228,247,0.3)] blur-3xl" />
        <div className="absolute right-[-80px] top-52 h-72 w-72 rounded-full bg-[rgba(250,205,244,0.24)] blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-80 w-80 rounded-full bg-[rgba(248,219,230,0.22)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[var(--layout-max)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm lg:sticky lg:top-5 lg:self-start">
          <div className="flex flex-col gap-6 lg:min-h-[calc(100vh-2.5rem)]">
            <div>
              <div className="flex items-center gap-3">
                <Avatar user={currentUser} size="sm" />
                <div className="min-w-0">
                  <p className="text-base font-black text-[var(--foreground)]">
                    {displayName}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-[var(--text-muted)]">
                    UID: {formatUid(currentUser.id)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-1.5">
                <SidebarButton href="/" icon={<HomeIcon className="h-4 w-4" />}>
                  返回首页
                </SidebarButton>
                <SidebarButton
                  active={activeSection === "dashboard"}
                  onClick={() => setActiveSection("dashboard")}
                  icon={<CardIcon className="h-4 w-4" />}
                >
                  卡片管理
                </SidebarButton>
                <SidebarButton
                  href="/creator/access-codes"
                  icon={<KeyIcon className="h-4 w-4" />}
                >
                  提取码管理
                </SidebarButton>
                {isManager ? (
                  <SidebarButton
                    href="/creator/reviews"
                    icon={<ReviewIcon className="h-4 w-4" />}
                  >
                    审核中心
                  </SidebarButton>
                ) : null}
                <SidebarButton
                  active={activeSection === "settings"}
                  onClick={() => setActiveSection("settings")}
                  icon={<SettingsIcon className="h-4 w-4" />}
                >
                  个人资料设置
                </SidebarButton>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto rounded-full border-2 border-[var(--outline)] bg-white px-3 py-2 text-xs font-black text-[var(--foreground)]/68 shadow-sm transition hover:bg-[var(--surface-container)] lg:mt-auto"
            >
              退出登录
            </button>
          </div>
        </aside>

        <main className="space-y-5">
          {loadError ? (
            <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[#e59273] bg-[#fff6ef] px-4 py-3 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="w-fit rounded-full border border-[#f1b18a] bg-white px-3 py-1.5 text-xs font-black shadow-sm"
              >
                重新加载
              </button>
            </div>
          ) : null}

          {activeSection === "dashboard" ? (
            <>
              <section className="overflow-hidden rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-2 shadow-sm">
                <div
                  className="relative overflow-hidden rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(233,247,252,0.86)_52%,rgba(246,252,255,0.95)_100%)] px-5 py-6 sm:px-6 sm:py-8"
                  style={heroSurfaceStyle}
                >
                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="rounded-full border-4 border-white/90 bg-white/85 p-0.5 shadow-[0_16px_36px_-24px_rgba(120,85,94,0.35)]">
                        <Avatar user={currentUser} />
                      </div>
                      <div className="max-w-2xl">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--primary)]/70">
                          {brand.siteShortName}
                        </p>
                        <h1 className="mt-1.5 text-2xl font-black text-[var(--foreground)] sm:text-3xl">
                          {displayName}
                        </h1>
                        <p className="mt-1 text-sm font-bold text-[var(--foreground)]/68">
                          {getUserTagline(currentUser)}
                        </p>
                        <p className="mt-1.5 text-xs font-bold text-[var(--text-subtle)]">
                          {accountLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-[1rem] border-2 border-[var(--outline)]/15 bg-white/80 p-2 backdrop-blur-sm sm:grid-cols-3">
                      {heroStats.map((item) => (
                        <div
                          key={item.label}
                          className="min-w-[96px] rounded-[0.7rem] px-3 py-2.5 text-center"
                        >
                          <div
                            className={`text-lg font-black ${
                              item.accent
                                ? "text-[var(--brand-strong)]"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {item.value}
                          </div>
                          <div
                            className={`mt-0.5 text-[11px] font-bold ${
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

              <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 border-b border-[var(--outline)]/12 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-5">
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-[var(--outline)] bg-[var(--button-primary)] px-3.5 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    新建卡片
                  </button>
                </div>

                <div className="pt-5">
                  {activeTab !== "collections" ? (
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="text-[11px] font-black text-[var(--foreground)]/55">筛选</span>
                      <AccessModeFilterPills
                        value={accessModeFilter}
                        onChange={setAccessModeFilter}
                      />
                    </div>
                  ) : null}

                  {activeTab === "cards" ? (
                    cards.length > 0 ? (
                      <div className="space-y-4">
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
                    favoritesLoading && favorites.length === 0 ? (
                      <div className="py-10 text-center text-[var(--foreground)]/62">
                        正在加载收藏...
                      </div>
                    ) : favoritesError ? (
                      <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[#e59273] bg-[#fff6ef] px-4 py-3 text-sm text-[#9a3412] sm:flex-row sm:items-center sm:justify-between">
                        <span>{favoritesError}</span>
                        <button
                          type="button"
                          onClick={() => void loadFavoritesPage(favoritesPage)}
                          className="w-fit rounded-full border border-[#f1b18a] bg-white px-3 py-1.5 text-xs font-black shadow-sm"
                        >
                          重新加载
                        </button>
                      </div>
                    ) : favorites.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {favorites.map((item) => (
                            <FavoriteCard
                              key={item.card.id}
                              item={item}
                              onUnfavorited={() => removeFavoriteFromList(item.card.id)}
                            />
                          ))}
                        </div>
                        <PaginationControls
                          page={favoritesPage}
                          totalPages={favoritesTotalPages}
                          onPageChange={(nextPage) => void loadFavoritesPage(nextPage)}
                        />
                      </div>
                    ) : (
                      <EmptyState
                        title="还没有收藏内容"
                        description="在发现页看到喜欢的卡片，点击收藏按钮即可在这里找到。"
                        actionLabel="前往首页"
                        actionHref="/"
                      />
                    )
                  ) : null}

                  {activeTab === "history" ? (
                    historyItems.length > 0 ? (
                      <div className="space-y-4">
                        <div className="space-y-3">
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
