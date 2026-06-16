"use client";

import Link from "next/link";
import { useMemo, useRef, type FormEvent } from "react";

import { isCategoryEnabled, useShareCategorySettings } from "@/components/share/category-provider";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect/index";
import { useShareCardEditor } from "@/components/share/card-editor/hooks";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import { CardAssetsPanel, CardInfoPanel, PublishActionsPanel, RealtimePreviewPanel } from "@/components/share/card-editor/sections";
import type { ShareCardEditorProps } from "@/components/share/card-editor/types";
import type { CardContentSlot } from "@/lib/shared";

export function ShareCardEditor({ mode, cardId }: ShareCardEditorProps) {
  const createCoverInputRef = useRef<HTMLInputElement>(null);
  const categorySettings = useShareCategorySettings();
  const enabledSlots = useMemo(() => {
    const allSlots: CardContentSlot[] = [
      "system_theme",
      "wechat_theme",
      "app",
      "character_persona",
      "world_book",
      "desktop_component",
    ];
    return new Set(allSlots.filter((slot) => isCategoryEnabled(categorySettings, slot)));
  }, [categorySettings]);

  const {
    sessionChecking,
    cardLoading,
    currentUser,
    loadedCard,
    title,
    setTitle,
    description,
    setDescription,
    tags,
    tagDraft,
    handleTagDraftChange,
    handleTagDraftBlur,
    canAddTag,
    tagLimitReached,
    tagSlotsRemaining,
    tagHelperText,
    handleAddTag,
    handleRemoveTag,
    publicChecked,
    setPublicChecked,
    accessMode,
    setAccessMode,
    createMode,
    slotItems,
    setSlotValue,
    setSlotFile,
    addSlotRow,
    removeSlotRow,
    handleCreateModeChange,
    coverPreviewUrl,
    coverPending,
    handleCreateCoverFile,
    clearCreateCover,
    previewUrl,
    previewTitle,
    previewDescription,
    authorName,
    loadError,
    formError,
    submitMode,
    reviewSubmitPending,
    publishPending,
    hasCoverOnCard,
    hasAssetPending,
    assetPending,
    pageTitle,
    pageDescription,
    submitPrimaryLabel,
    submitSecondaryLabel,
    afterSuccessPath,
    isCreator,
    canSubmitReview,
    submitCard,
    handleSubmitReview,
    handleDelete,
    handleReplaceCover,
    handleDeleteCover,
    handleReplaceAsset,
    handleDeleteAsset,
  } = useShareCardEditor({ mode, cardId });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCard("published");
  }

  if (sessionChecking || (mode === "edit" && currentUser && cardLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          <LoadingSpinner label="正在加载编辑页..." />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessPath} />;
  }

  if (!isCreator) {
    return (
      <AppShell currentPath="/creator">
        <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">当前账号没有创作权限，无法创建或编辑卡片。</p>
            <Link href="/creator" className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5">
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (mode === "edit" && loadError) {
    return (
      <AppShell currentPath="/creator">
        <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">{loadError}</p>
            <Link href="/creator" className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5">
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/creator">
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[rgba(203,234,249,0.3)] blur-[110px]" />
          <div className="absolute left-[20%] bottom-[12%] h-[26rem] w-[26rem] rounded-full bg-[rgba(248,219,230,0.22)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1200px] px-4 pb-16 pt-10">
          {mode === "edit" ? (
            <div className="mb-4 flex justify-start">
              <Link href="/creator" className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--outline)]/20 bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
                返回创作中心
              </Link>
            </div>
          ) : null}

          <div className="mb-6 text-center">
            <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">{pageTitle}</h1>
            <p className="mt-2 text-xs font-bold text-[var(--foreground)]/60">{pageDescription}</p>
          </div>

          {formError ? <div className="mb-4 rounded-[1.1rem] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-xs font-black text-[#9a3412]">{formError}</div> : null}

          <form className="flex flex-col gap-4 lg:flex-row lg:items-start" onSubmit={handleSubmit}>
            <div className="w-full space-y-4 lg:w-[55%]">
              <CardAssetsPanel
                mode={mode}
                createMode={createMode}
                setCreateMode={handleCreateModeChange}
                slotItems={slotItems}
                setSlotValue={setSlotValue}
                setSlotFile={setSlotFile}
                addSlotRow={addSlotRow}
                removeSlotRow={removeSlotRow}
                coverPreviewUrl={coverPreviewUrl}
                createCoverInputRef={createCoverInputRef}
                handleCreateCoverFile={handleCreateCoverFile}
                clearCreateCover={clearCreateCover}
                previewUrl={previewUrl}
                previewTitle={previewTitle}
                loadedCard={loadedCard}
                coverPending={coverPending}
                publishPending={publishPending}
                hasCoverOnCard={hasCoverOnCard}
                handleReplaceCover={(file) => {
                  void handleReplaceCover(file);
                }}
                handleDeleteCover={() => {
                  void handleDeleteCover();
                }}
                assetPending={assetPending}
                handleReplaceAsset={(slot, file) => {
                  void handleReplaceAsset(slot, file);
                }}
                handleDeleteAsset={(slot) => {
                  void handleDeleteAsset(slot);
                }}
                authorName={authorName}
                enabledSlots={enabledSlots}
              />

              <CardInfoPanel
                title={title}
                description={description}
                tags={tags}
                tagDraft={tagDraft}
                setTitle={setTitle}
                setDescription={setDescription}
                handleTagDraftChange={handleTagDraftChange}
                handleTagDraftBlur={handleTagDraftBlur}
                canAddTag={canAddTag}
                tagLimitReached={tagLimitReached}
                tagSlotsRemaining={tagSlotsRemaining}
                tagHelperText={tagHelperText}
                handleAddTag={handleAddTag}
                handleRemoveTag={handleRemoveTag}
              />
            </div>

            <div className="w-full space-y-4 lg:w-[45%]">
              <RealtimePreviewPanel previewUrl={previewUrl} previewTitle={previewTitle} previewDescription={previewDescription} authorName={authorName} />

              <PublishActionsPanel
                mode={mode}
                publicChecked={publicChecked}
                setPublicChecked={setPublicChecked}
                accessMode={accessMode}
                setAccessMode={setAccessMode}
                publishPending={publishPending}
                hasAssetPending={hasAssetPending}
                reviewSubmitPending={reviewSubmitPending}
                submitMode={submitMode}
                submitPrimaryLabel={submitPrimaryLabel}
                submitSecondaryLabel={submitSecondaryLabel}
                submitDraft={() => {
                  void submitCard("draft");
                }}
                canSubmitReview={canSubmitReview}
                handleSubmitReview={() => {
                  void handleSubmitReview();
                }}
                loadedCard={loadedCard}
                handleDelete={() => {
                  void handleDelete();
                }}
              />
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}


