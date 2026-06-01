import Link from "next/link";
import { type ChangeEvent, type RefObject } from "react";

import { slotOptions } from "@/components/share/card-editor/constants";
import { findAssetBySlot, getReviewStatusLabel, getSlotLabel, getStatusLabel, type SlotFileItem } from "@/components/share/card-editor/helpers";
import type { AssetOpMode, CreateMode, EditorMode, SubmitMode } from "@/components/share/card-editor/types";
import type { CardContentSlot, CardDetailResponse } from "@/lib/shared";


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
  createCoverInputRef: RefObject<HTMLInputElement | null>;
  handleCreateCoverChange: (event: ChangeEvent<HTMLInputElement>) => void;
  clearCreateCover: () => void;
  previewUrl: string;
  previewTitle: string;
  loadedCard: CardDetailResponse | null;
  coverPending: "replace" | "remove" | null;
  publishPending: boolean;
  hasCoverOnCard: boolean;
  handleReplaceCover: (file: File | null) => void;
  handleDeleteCover: () => void;
  assetPending: Record<CardContentSlot, AssetOpMode | null>;
  handleReplaceAsset: (slot: CardContentSlot, file: File | null) => void;
  handleDeleteAsset: (slot: CardContentSlot) => void;
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
    createCoverInputRef,
    handleCreateCoverChange,
    clearCreateCover,
    previewUrl,
    previewTitle,
    loadedCard,
    coverPending,
    publishPending,
    hasCoverOnCard,
    handleReplaceCover,
    handleDeleteCover,
    assetPending,
    handleReplaceAsset,
    handleDeleteAsset,
  } = props;

  return (
    <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
      <div className="mb-6 flex items-center gap-2">
        <h2 className="text-sm font-black text-[var(--foreground)]">{mode === "edit" ? "分类文件管理" : "封面与分类文件"}</h2>
      </div>

      {mode === "create" ? (
        <div className="space-y-4">
          <div className="rounded-xl border-[2px] border-[var(--line-strong)]/25 bg-white p-4">
            <p className="text-xs font-black text-[var(--foreground)]/70">卡片封面（可选，仅用于浏览）</p>
            <div className="mt-3 flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--line-strong)]/30 bg-[#f8f9fa]">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="卡片封面预览" className="max-h-[220px] w-full object-contain" />
              ) : (
                <div className="px-6 text-center text-sm font-bold text-[var(--text-subtle)]">点击下方按钮上传封面图（可选）</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-subtle rounded-full px-4 py-2 text-xs font-black" onClick={() => createCoverInputRef.current?.click()}>
                {coverPreviewUrl ? "替换封面图" : "上传封面图"}
              </button>
              {coverPreviewUrl ? (
                <button type="button" className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-4 py-2 text-xs font-black text-[#ff6b6b]" onClick={clearCreateCover}>
                  移除封面图
                </button>
              ) : null}
            </div>
            <input ref={createCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCreateCoverChange} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border-[2px] px-4 py-2 text-sm font-black ${createMode === "single" ? "bg-[var(--button-primary)]" : "bg-white"}`}
              onClick={() => {
                setCreateMode("single");
              }}
            >
              单分类
            </button>
            <button
              type="button"
              className={`rounded-full border-[2px] px-4 py-2 text-sm font-black ${createMode === "bundle" ? "bg-[var(--button-primary)]" : "bg-white"}`}
              onClick={() => {
                setCreateMode("bundle");
              }}
            >
              多分类打包
            </button>
          </div>

          {slotItems.map((item, index) => (
            <div key={`${item.slot}-${index}`} className="rounded-xl border-[2px] border-[var(--line-strong)]/30 bg-[#f8f9fa] p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <select className="rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-bold" value={item.slot} onChange={(event) => setSlotValue(index, event.target.value as CardContentSlot)}>
                  {slotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input type="file" className="rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-bold" onChange={(event) => setSlotFile(index, event.target.files?.[0] ?? null)} />

                {createMode === "bundle" ? (
                  <button type="button" className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-3 py-2 text-xs font-black text-[#ff6b6b]" onClick={() => removeSlotRow(index)} disabled={slotItems.length <= 1}>
                    删除
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[var(--text-subtle)]">{item.file ? item.file.name : "未选择文件"}</p>
            </div>
          ))}

          {createMode === "bundle" ? (
            <button type="button" className="btn-subtle rounded-full px-4 py-2 text-sm font-black" onClick={addSlotRow} disabled={slotItems.length >= slotOptions.length}>
              + 添加分类文件
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line-strong)]/30 bg-[#f8f9fa] px-6 py-6 text-center">
            {previewUrl ? (
              <img src={previewUrl} alt={previewTitle} className="max-h-[160px] rounded-xl border-[3px] border-[var(--line-strong)] object-cover shadow-[2px_2px_0px_var(--line-strong)]" />
            ) : (
              <div className="text-sm font-bold text-[var(--text-muted)]">当前卡片暂无可预览图片</div>
            )}
          </div>

          <div className="rounded-xl border-[2px] border-[var(--line-strong)]/25 bg-white p-4">
            <p className="text-xs font-black text-[var(--foreground)]/70">卡片封面图（浏览用）</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="btn-subtle cursor-pointer rounded-full px-4 py-2 text-xs font-black">
                {coverPending === "replace" ? "替换中..." : "替换封面图"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={Boolean(coverPending) || publishPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    void handleReplaceCover(file);
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-4 py-2 text-xs font-black text-[#ff6b6b] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasCoverOnCard || Boolean(coverPending) || publishPending}
                onClick={() => void handleDeleteCover()}
              >
                {coverPending === "remove" ? "删除中..." : "删除封面图"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-subtle)]">{hasCoverOnCard ? "当前已设置独立封面图" : "当前未设置独立封面图，将回退为分类文件预览"}</p>
          </div>

          {loadedCard ? (
            <div className="space-y-3">
              {slotOptions.map((option) => {
                const slot = option.value;
                const asset = findAssetBySlot(loadedCard.assets, slot);
                const pendingMode = assetPending[slot];
                const slotBusy = Boolean(pendingMode);
                const canDelete = Boolean(asset) && loadedCard.assets.length > 1;

                return (
                  <div key={slot} className="rounded-xl border-[2px] border-[var(--line-strong)]/25 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[var(--foreground)]">{getSlotLabel(slot)}</p>
                        <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">{asset ? `${asset.originalFileName} (${Math.max(1, Math.round(asset.size / 1024))} KB)` : "该分类暂无文件"}</p>
                      </div>
                      {asset ? (
                        <a href={asset.downloadUrl} className="btn-subtle rounded-full px-3 py-1.5 text-xs font-black">
                          下载
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="btn-subtle cursor-pointer rounded-full px-4 py-2 text-xs font-black">
                        {pendingMode === "replace" ? "替换中..." : "替换文件"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={slotBusy || publishPending}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.currentTarget.value = "";
                            void handleReplaceAsset(slot, file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-4 py-2 text-xs font-black text-[#ff6b6b] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canDelete || slotBusy || publishPending}
                        onClick={() => void handleDeleteAsset(slot)}
                      >
                        {pendingMode === "remove" ? "删除中..." : "删除该分类文件"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function CardInfoPanel(props: {
  title: string;
  description: string;
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
}) {
  const { title, description, setTitle, setDescription } = props;

  return (
    <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
      <div className="mb-6 flex items-center gap-2">
        <h2 className="text-sm font-black text-[var(--foreground)]">卡片信息</h2>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-black text-[var(--foreground)]/70">标题</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="请输入卡片标题..."
          className="w-full rounded-full border-[2px] border-[var(--line-strong)] bg-white px-4 py-3 font-bold text-[var(--foreground)] transition focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-black text-[var(--foreground)]/70">描述</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          placeholder="补充卡片说明..."
          className="w-full resize-y rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-4 py-3 font-bold leading-7 text-[var(--foreground)] transition focus:ring-2 focus:ring-[var(--primary)]"
        />
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
    <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black text-[var(--foreground)]">实时预览</h2>
      </div>

      <div className="overflow-hidden rounded-[24px] border-[3px] border-[var(--line-strong)] bg-white shadow-[4px_4px_0px_var(--line-strong)]">
        <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#3b272d_0%,#5a4049_40%,#2e1c21_100%)]">
          {previewUrl ? <img src={previewUrl} alt={previewTitle} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-white/76">等待可预览文件...</div>}
        </div>

        <div className="p-4">
          <h3 className="text-xl font-black text-[var(--foreground)]">{previewTitle}</h3>
          <p className="mt-2 text-xs font-bold leading-relaxed text-[var(--foreground)]/60">{previewDescription}</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
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

  return (
    <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
      <label className="mb-6 flex w-fit cursor-pointer items-center gap-3">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded border-[2px] border-[var(--line-strong)] ${publicChecked ? "bg-[var(--button-primary)] text-[var(--foreground)]" : "bg-white text-transparent"}`}>
          ✓
        </span>
        <span className="text-sm font-bold text-[var(--foreground)]">
          公开可见 <span className="text-[var(--foreground)]/60">（在发现页展示）</span>
        </span>
        <input type="checkbox" checked={publicChecked} onChange={(event) => setPublicChecked(event.target.checked)} className="hidden" />
      </label>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={publishPending || hasAssetPending || reviewSubmitPending}
          className="btn-primary w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitMode === "published" ? "提交中..." : submitPrimaryLabel}
        </button>
        <button
          type="button"
          disabled={publishPending || hasAssetPending || reviewSubmitPending}
          onClick={submitDraft}
          className="btn-subtle w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitMode === "draft" ? "提交中..." : submitSecondaryLabel}
        </button>

        {mode === "edit" && loadedCard ? (
          <button
            type="button"
            disabled={!canSubmitReview}
            onClick={handleSubmitReview}
            className="btn-subtle w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reviewSubmitPending ? "提交审核中..." : "提交审核"}
          </button>
        ) : null}

        {mode === "edit" && loadedCard ? (
          <Link href={`/creator/cards/${encodeURIComponent(loadedCard.card.id)}/access-code`} className="btn-rose block w-full rounded-full py-3 text-center text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] transition hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none">
            配置访问码
          </Link>
        ) : null}

        {mode === "edit" ? (
          <button
            type="button"
            disabled={publishPending || hasAssetPending || reviewSubmitPending}
            onClick={handleDelete}
            className="mt-2 w-full rounded-full border-[3px] border-[#ff9c9c] bg-[#fce4e4] py-3 text-sm font-black text-[#ff6b6b] shadow-[2px_2px_0px_#ff9c9c] transition hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMode === "delete" ? "删除中..." : "删除这张卡片"}
          </button>
        ) : null}
      </div>

      {mode === "edit" && loadedCard ? (
        <div className="mt-6 space-y-1 text-[10px] font-bold text-[var(--text-subtle)]">
          <p>卡片 ID：{loadedCard.card.id}</p>
          <p>当前状态：{getStatusLabel(loadedCard.card.status)}</p>
          <p>审核状态：{getReviewStatusLabel(loadedCard.card.reviewStatus)}</p>
          {loadedCard.card.reviewReason ? <p>驳回原因：{loadedCard.card.reviewReason}</p> : null}
        </div>
      ) : (
        <div className="mt-6 space-y-1 text-[10px] font-bold text-[var(--text-subtle)]">
          <p>创建后可在“访问码配置”中继续设置分享规则。</p>
          <p>封面图只用于展示，分类文件才用于用户下载。</p>
        </div>
      )}
    </section>
  );
}


