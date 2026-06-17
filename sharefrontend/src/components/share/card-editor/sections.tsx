import Link from "next/link";
import { Fragment, type KeyboardEvent, useState } from "react";

import { CoverImageCropper } from "@/components/share/card-editor/CoverImageCropper";
import { getReviewStatusLabel, getStatusLabel, type SlotFileItem } from "@/components/share/card-editor/helpers";
import { LoadingSpinner } from "@/components/share/loading-spinner";
import { getSlotDefinitions, getEnabledSlotDefinitions, getSlotDefinition, type SlotPanelContext } from "@/components/share/card-editor/slot-registry";
import { ShareImage } from "@/components/share/share-image";
import type { CreateMode, EditorMode, SubmitMode } from "@/components/share/card-editor/types";
import type { CardContentSlot, CardDetailResponse, ShareCardAccessMode } from "@/lib/shared";


export function CardAssetsPanel(props: {
  mode: EditorMode;
  createMode: CreateMode;
  setCreateMode: (mode: CreateMode) => void;
  slotItems: SlotFileItem[];
  setSlotValue: (index: number, slot: CardContentSlot) => void;
  setSlotFile: (index: number, file: File | null) => void;
  addSlotRow: () => void;
  removeSlotRow: (index: number) => void;
  coverPreviewUrl: string;
  handleCreateCoverFile: (file: File | null) => void;
  clearCreateCover: () => void;
  previewUrl: string;
  previewTitle: string;
  publishPending: boolean;
  hasCoverOnCard: boolean;
  handleReplaceCover: (file: File | null) => void;
  handleDeleteCover: () => void;
  enabledSlots?: Set<CardContentSlot>;
}) {
  const {
    mode,
    createMode,
    setCreateMode,
    slotItems,
    setSlotValue,
    setSlotFile,
    addSlotRow,
    removeSlotRow,
    coverPreviewUrl,
    handleCreateCoverFile,
    clearCreateCover,
    previewUrl,
    previewTitle,
    publishPending,
    hasCoverOnCard,
    handleReplaceCover,
    handleDeleteCover,
    enabledSlots,
  } = props;

  const createSlotDefs = enabledSlots ? getEnabledSlotDefinitions(enabledSlots) : getSlotDefinitions();

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropMode, setCropMode] = useState<"create" | "edit" | null>(null);

  const startCoverCrop = (file: File | null, mode: "create" | "edit") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("请上传图片文件");
      return;
    }
    setCropMode(mode);
    setCropFile(file);
  };

  const handleCropConfirm = (file: File) => {
    setCropFile(null);
    const targetMode = cropMode;
    setCropMode(null);
    if (targetMode === "edit") {
      void handleReplaceCover(file);
    } else {
      handleCreateCoverFile(file);
    }
  };

  const handleCropCancel = () => {
    setCropFile(null);
    setCropMode(null);
  };

  return (
    <Fragment>
      <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">封面与分类文件</h2>
      </div>

      <div className="space-y-3">
        <div className="rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
          <p className="text-xs font-black text-[var(--foreground)]/70">
            {mode === "edit" ? "卡片封面图（浏览用）" : "卡片封面（可选，仅用于浏览）"}
          </p>
          <div className="relative mt-2 aspect-[3/2] w-full overflow-hidden rounded-[1rem] border-2 border-dashed border-[var(--outline)]/25 bg-white">
            {(() => {
              const displayUrl = mode === "edit" ? previewUrl || coverPreviewUrl : coverPreviewUrl || previewUrl;
              if (!displayUrl) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold text-[var(--foreground)]/50">
                    {mode === "edit" ? "当前卡片暂无可预览封面图" : "点击下方按钮上传封面图（可选）"}
                  </div>
                );
              }
              return <ShareImage src={displayUrl} alt="卡片封面预览" className="h-full w-full object-cover" />;
            })()}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
              {mode === "edit" ? (previewUrl ? "替换封面图" : "上传封面图") : (coverPreviewUrl ? "替换封面图" : "上传封面图")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={publishPending}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  startCoverCrop(file, mode);
                }}
              />
            </label>
            {mode === "edit" ? (
              <button
                type="button"
                className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-3 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasCoverOnCard || publishPending}
                onClick={() => void handleDeleteCover()}
              >
                删除封面图
              </button>
            ) : coverPreviewUrl ? (
              <button
                type="button"
                className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-3 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]"
                onClick={clearCreateCover}
              >
                移除封面图
              </button>
            ) : null}
          </div>
          {mode === "edit" ? (
            <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/50">
              {hasCoverOnCard ? "当前已设置独立封面图" : "当前未设置独立封面图，将回退为分类文件预览"}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${createMode === "single" ? "border-transparent bg-[var(--button-primary)]" : "border-[var(--outline)]/20 bg-white hover:bg-[var(--surface-container)]"}`}
            onClick={() => {
              setCreateMode("single");
            }}
          >
            单分类
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${createMode === "bundle" ? "border-transparent bg-[var(--button-primary)]" : "border-[var(--outline)]/20 bg-white hover:bg-[var(--surface-container)]"}`}
            onClick={() => {
              setCreateMode("bundle");
            }}
          >
            多分类打包
          </button>
        </div>

        {slotItems.map((item, index) => {
          const definition = getSlotDefinition(item.slot) ?? createSlotDefs[0];
          if (!definition) {
            return null;
          }
          const panelContext: SlotPanelContext = {
            file: item.file,
            onFileChange: (file) => setSlotFile(index, file),
            previewTitle,
          };
          const isDeleted = item.pendingDelete;
          const currentFileName = item.file
            ? item.file.name
            : item.originalAsset
              ? `${item.originalAsset.originalFileName} (${Math.max(1, Math.round(item.originalAsset.size / 1024))} KB)`
              : "未选择文件";
          return (
            <div
              key={`${item.slot}-${index}-${isDeleted ? "deleted" : "active"}`}
              className={`rounded-[1.1rem] border border-[var(--outline)]/20 p-3 ${isDeleted ? "bg-[var(--surface-container)]/60 opacity-70" : "bg-white"}`}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <select
                  className="h-8 rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none disabled:opacity-60"
                  value={item.slot}
                  disabled={isDeleted || publishPending || (mode === "edit" && Boolean(item.originalAsset) && !isDeleted)}
                  onChange={(event) => setSlotValue(index, event.target.value as CardContentSlot)}
                >
                  {createSlotDefs.map((option) => (
                    <option key={option.slot} value={option.slot}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {definition.showFileInput ? (
                  <input
                    key={item.file ? `file-${item.file.name}` : `empty-${index}`}
                    type="file"
                    accept={definition.accept}
                    disabled={isDeleted || publishPending}
                    className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-2 file:py-0.5 file:text-[10px] file:font-black disabled:opacity-60"
                    onChange={(event) => setSlotFile(index, event.target.files?.[0] ?? null)}
                  />
                ) : null}

                {createMode === "bundle" || mode === "edit" ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2.5 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => removeSlotRow(index)}
                    disabled={slotItems.length <= 1 || publishPending}
                  >
                    {isDeleted ? "恢复" : "删除"}
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/50">
                {isDeleted ? "将在保存时删除" : currentFileName}
              </p>
              {!isDeleted ? (
                <>
                  <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">{definition.description}</p>
                  {definition.renderCreatePanel(panelContext)}
                </>
              ) : null}
            </div>
          );
        })}

        {createMode === "bundle" ? (
          <button type="button" className="rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]" onClick={addSlotRow} disabled={slotItems.length >= createSlotDefs.length || publishPending}>
            + 添加分类文件
          </button>
        ) : null}
      </div>
    </section>
    {cropFile ? (
      <CoverImageCropper
        imageFile={cropFile}
        aspect={3 / 2}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    ) : null}
  </Fragment>
  );
}

export function CardInfoPanel(props: {
  title: string;
  description: string;
  tags: string[];
  tagDraft: string;
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  handleTagDraftChange: (value: string) => void;
  handleTagDraftBlur: () => void;
  canAddTag: boolean;
  tagLimitReached: boolean;
  tagSlotsRemaining: number;
  tagHelperText: string;
  handleAddTag: () => void;
  handleRemoveTag: (index: number) => void;
}) {
  const {
    title,
    description,
    tags,
    tagDraft,
    setTitle,
    setDescription,
    handleTagDraftChange,
    handleTagDraftBlur,
    canAddTag,
    tagLimitReached,
    tagSlotsRemaining,
    tagHelperText,
    handleAddTag,
    handleRemoveTag,
  } = props;

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    handleAddTag();
  }

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">卡片信息</h2>
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">标题</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="请输入卡片标题..."
          className="w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">描述</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="补充卡片说明..."
          className="w-full resize-y rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold leading-5 text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-black text-[var(--foreground)]/65">标签</label>
        <div className="flex flex-col gap-2 rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={tagDraft}
              onChange={(event) => handleTagDraftChange(event.target.value)}
              onBlur={handleTagDraftBlur}
              onKeyDown={handleTagKeyDown}
              placeholder={tagLimitReached ? "已达到标签上限" : "输入一个标签，例如：奶油风"}
              disabled={tagLimitReached}
              className="w-full rounded-full border border-[var(--outline)]/20 bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!canAddTag}
              className="rounded-full bg-[var(--button-primary)] px-3 py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              添加标签
            </button>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--outline)]/20 bg-white px-2 py-1 text-[10px] font-black text-[var(--foreground)]"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(index)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#ff9c9c] bg-[#fff2f1] text-[10px] leading-none text-[#b64031]"
                    aria-label={`删除标签 ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-bold text-[var(--foreground)]/50">
              还没有添加标签。最多 12 个，每个标签最多 32 个字。
            </p>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
          <p className="text-[var(--foreground)]/55">{tagHelperText}</p>
          <p className="text-[var(--foreground)]/45">还可添加 {tagSlotsRemaining} 个</p>
        </div>
        <p className="mt-1 text-[10px] font-bold text-[var(--foreground)]/55">这些标签会同步给 `baobaobaiphone` 的在线主题卡片，优先于主题包内 tags。</p>
      </div>
    </section>
  );
}

export function RealtimePreviewPanel(props: {
  previewUrl: string;
  previewTitle: string;
  previewDescription: string;
  authorName: string;
}) {
  const { previewUrl, previewTitle, previewDescription, authorName } = props;

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">实时预览</h2>
      </div>

      <div className="overflow-hidden rounded-[1.2rem] border border-[var(--outline)]/20 bg-white shadow-sm">
        <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#3b272d_0%,#5a4049_40%,#2e1c21_100%)]">
          {previewUrl ? <ShareImage src={previewUrl} alt={previewTitle} fill sizes="(max-width: 640px) 100vw, 50vw" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-white/76">等待可预览文件...</div>}
        </div>

        <div className="p-3">
          <h3 className="text-base font-black text-[var(--foreground)]">{previewTitle}</h3>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--foreground)]/60">{previewDescription}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
            <span>{authorName}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublishActionsPanel(props: {
  mode: EditorMode;
  publicChecked: boolean;
  setPublicChecked: (checked: boolean) => void;
  accessMode: ShareCardAccessMode;
  setAccessMode: (mode: ShareCardAccessMode) => void;
  publishPending: boolean;
  hasAssetPending: boolean;
  reviewSubmitPending: boolean;
  submitMode: SubmitMode;
  submitPrimaryLabel: string;
  submitSecondaryLabel: string;
  submitDraft: () => void;
  canSubmitReview: boolean;
  handleSubmitReview: () => void;
  loadedCard: CardDetailResponse | null;
  handleDelete: () => void;
}) {
  const {
    mode,
    publicChecked,
    setPublicChecked,
    accessMode,
    setAccessMode,
    publishPending,
    hasAssetPending,
    reviewSubmitPending,
    submitMode,
    submitPrimaryLabel,
    submitSecondaryLabel,
    submitDraft,
    canSubmitReview,
    handleSubmitReview,
    loadedCard,
    handleDelete,
  } = props;

  const isDelisted = loadedCard?.card.status === "delisted";
  const isRejected = loadedCard?.card.reviewStatus === "rejected";
  const reviewReason = loadedCard?.card.reviewReason?.trim();

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">发布设置</h2>
      </div>

      {mode === "edit" && loadedCard && reviewReason && (isDelisted || isRejected) ? (
        <div className="mb-4 rounded-xl border-2 border-[#f3c8ad] bg-[#fff4ec] p-3">
          <p className="text-xs font-black text-[#9a3412]">
            {isDelisted ? "卡片已被管理员下架" : "卡片审核未通过"}
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#9a3412]/90">
            {isDelisted ? "下架原因" : "驳回原因"}：{reviewReason}
          </p>
          <p className="mt-1 text-[10px] font-bold text-[#9a3412]/75">
            请根据上方原因修改卡片内容，确认无误后点击下方的「重新提交审核」。
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <section>
          <h3 className="text-xs font-black text-[var(--foreground)]/75">可见性</h3>
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-2">
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded border border-[var(--outline)]/40 ${publicChecked ? "bg-[var(--button-primary)] text-[var(--foreground)]" : "bg-white text-transparent"}`}>
              ✓
            </span>
            <span className="text-xs font-bold text-[var(--foreground)]">
              公开可见 <span className="text-[var(--foreground)]/55">（在发现页展示）</span>
            </span>
            <input type="checkbox" checked={publicChecked} onChange={(event) => setPublicChecked(event.target.checked)} className="hidden" />
          </label>
        </section>

        <section>
          <h3 className="text-xs font-black text-[var(--foreground)]/75">访问模式</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAccessMode("free")}
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-black transition ${
                accessMode === "free" ? "border-transparent bg-[var(--button-primary)]" : "border-[var(--outline)]/20 bg-white hover:bg-[var(--surface-container)]"
              }`}
            >
              免费（无需提取码）
            </button>
            <button
              type="button"
              onClick={() => setAccessMode("paid")}
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-black transition ${
                accessMode === "paid" ? "border-transparent bg-[var(--button-primary)]" : "border-[var(--outline)]/20 bg-white hover:bg-[var(--surface-container)]"
              }`}
            >
              需提取码
            </button>
          </div>
          <p className="mt-1 text-[10px] font-bold text-[var(--foreground)]/50">
            需提取码模式会要求用户输入提取码，免费模式可直接下载分类文件。
          </p>
        </section>

        <section className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={publishPending || hasAssetPending || reviewSubmitPending}
            className="flex w-full items-center justify-center rounded-full bg-[var(--button-primary)] py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMode === "published" ? <LoadingSpinner size="sm" inline label="提交中..." /> : submitPrimaryLabel}
          </button>
          <button
            type="button"
            disabled={publishPending || hasAssetPending || reviewSubmitPending}
            onClick={submitDraft}
            className="flex w-full items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMode === "draft" ? <LoadingSpinner size="sm" inline label="提交中..." /> : submitSecondaryLabel}
          </button>

          {mode === "edit" && loadedCard ? (
            <button
              type="button"
              disabled={!canSubmitReview}
              onClick={handleSubmitReview}
              className="flex w-full items-center justify-center rounded-full border border-[var(--outline)]/20 bg-white py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewSubmitPending ? (
                <LoadingSpinner size="sm" inline label="提交审核中..." />
              ) : loadedCard?.card.status === "delisted" || loadedCard?.card.reviewStatus === "rejected" ? (
                "重新提交审核"
              ) : (
                "提交审核"
              )}
            </button>
          ) : null}

          {mode === "edit" && loadedCard ? (
            <Link href={`/creator/cards/${encodeURIComponent(loadedCard.card.id)}/access-code`} className="block w-full rounded-full border border-[var(--outline)]/20 bg-white py-2 text-center text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
              配置访问码
            </Link>
          ) : null}

          {mode === "edit" ? (
            <button
              type="button"
              disabled={publishPending || hasAssetPending || reviewSubmitPending}
              onClick={handleDelete}
              className="flex w-full items-center justify-center rounded-full border border-[#ff9c9c] bg-[#fff2f1] py-2 text-xs font-black text-[#b64031] shadow-sm transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitMode === "delete" ? <LoadingSpinner size="sm" inline label="删除中..." /> : "删除这张卡片"}
            </button>
          ) : null}
        </section>
      </div>

      {mode === "edit" && loadedCard ? (
        <div className="mt-3 space-y-1 text-[10px] font-bold text-[var(--foreground)]/50">
          <p>卡片 ID：{loadedCard.card.id}</p>
          <p>当前状态：{getStatusLabel(loadedCard.card.status)}</p>
          <p>审核状态：{getReviewStatusLabel(loadedCard.card.reviewStatus)}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-[10px] font-bold text-[var(--foreground)]/50">
          <p>创建后可在“访问码配置”中继续设置分享规则。</p>
          <p>封面图只用于展示，分类文件才用于用户下载。</p>
        </div>
      )}
    </section>
  );
}


