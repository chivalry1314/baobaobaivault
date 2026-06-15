import Link from "next/link";
import { type ChangeEvent, type KeyboardEvent, type RefObject } from "react";

import { slotOptions } from "@/components/share/card-editor/constants";
import { DesktopComponentSpecPanel } from "@/components/share/card-editor/DesktopComponentSpecPanel";
import { WechatThemeSpecPanel } from "@/components/share/card-editor/WechatThemeSpecPanel";
import { WorldBookSpecPanel } from "@/components/share/card-editor/WorldBookSpecPanel";
import { findAssetBySlot, getReviewStatusLabel, getSlotLabel, getStatusLabel, type SlotFileItem } from "@/components/share/card-editor/helpers";
import { ShareImage } from "@/components/share/share-image";
import type { AssetOpMode, CreateMode, EditorMode, SubmitMode } from "@/components/share/card-editor/types";
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
  authorName?: string;
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
    authorName,
  } = props;

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">{mode === "edit" ? "分类文件管理" : "封面与分类文件"}</h2>
      </div>

      {mode === "create" ? (
        <div className="space-y-3">
          <div className="rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
            <p className="text-xs font-black text-[var(--foreground)]/70">卡片封面（可选，仅用于浏览）</p>
            <div className="mt-2 flex min-h-[140px] items-center justify-center overflow-hidden rounded-[1rem] border-2 border-dashed border-[var(--outline)]/25 bg-white">
              {coverPreviewUrl ? (
                <ShareImage src={coverPreviewUrl} alt="卡片封面预览" className="max-h-[180px] w-full object-contain" />
              ) : (
                <div className="px-6 text-center text-xs font-bold text-[var(--foreground)]/50">点击下方按钮上传封面图（可选）</div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]" onClick={() => createCoverInputRef.current?.click()}>
                {coverPreviewUrl ? "替换封面图" : "上传封面图"}
              </button>
              {coverPreviewUrl ? (
                <button type="button" className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-3 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]" onClick={clearCreateCover}>
                  移除封面图
                </button>
              ) : null}
            </div>
            <input ref={createCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCreateCoverChange} />
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

          {slotItems.map((item, index) => (
            <div key={`${item.slot}-${index}`} className="rounded-[1.1rem] border border-[var(--outline)]/20 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <select className="h-8 rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none" value={item.slot} onChange={(event) => setSlotValue(index, event.target.value as CardContentSlot)}>
                  {slotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {item.slot === "wechat_theme" ? null : (
                  <input
                    key={item.file ? `file-${item.file.name}` : `empty-${index}`}
                    type="file"
                    accept={item.slot === "desktop_component" ? ".html,.htm,text/html" : undefined}
                    className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-2 file:py-0.5 file:text-[10px] file:font-black"
                    onChange={(event) => setSlotFile(index, event.target.files?.[0] ?? null)}
                  />
                )}

                {createMode === "bundle" ? (
                  <button type="button" className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2.5 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]" onClick={() => removeSlotRow(index)} disabled={slotItems.length <= 1}>
                    删除
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/50">{item.file ? item.file.name : "未选择文件"}</p>
              {item.slot === "system_theme" ? (
                <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                  系统主题会按 `baobaobaiphone` 当前导入规则校验，仅支持可解析的 `.zip` / `.json` 主题包。
                </p>
              ) : item.slot === "wechat_theme" ? (
                <>
                  <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                    微信主题包支持直接上传 `.zip` / `.json`，也可以通过下方表单一键生成。
                  </p>
                  <WechatThemeSpecPanel
                    file={item.file}
                    onFileChange={(file) => setSlotFile(index, file)}
                    defaultAuthor={authorName}
                  />
                </>
              ) : item.slot === "desktop_component" ? (
                <>
                  <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                    桌面组件会校验 HTML 文件格式，并读取 &lt;meta name="widget-*"&gt; 标签作为组件配置。
                  </p>
                  <DesktopComponentSpecPanel
                    file={item.file}
                    onFileChange={(file) => setSlotFile(index, file)}
                  />
                </>
              ) : item.slot === "world_book" ? (
                <>
                  <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                    世界书支持直接上传 `.json`，也可以通过下方表单一键生成。
                  </p>
                  <WorldBookSpecPanel
                    file={item.file}
                    onFileChange={(file) => setSlotFile(index, file)}
                    defaultAuthor={authorName}
                  />
                </>
              ) : null}
            </div>
          ))}

          {createMode === "bundle" ? (
            <button type="button" className="rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]" onClick={addSlotRow} disabled={slotItems.length >= slotOptions.length}>
              + 添加分类文件
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[1.2rem] border border-dashed border-[var(--outline)]/25 bg-[var(--surface-container)] px-4 py-4 text-center">
            {previewUrl ? (
              <ShareImage src={previewUrl} alt={previewTitle} className="max-h-[140px] rounded-[1rem] border border-[var(--outline)]/20 object-cover" />
            ) : (
              <div className="text-xs font-bold text-[var(--foreground)]/50">当前卡片暂无可预览图片</div>
            )}
          </div>

          <div className="rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-3">
            <p className="text-xs font-black text-[var(--foreground)]/70">卡片封面图（浏览用）</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
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
                className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-3 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasCoverOnCard || Boolean(coverPending) || publishPending}
                onClick={() => void handleDeleteCover()}
              >
                {coverPending === "remove" ? "删除中..." : "删除封面图"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/50">{hasCoverOnCard ? "当前已设置独立封面图" : "当前未设置独立封面图，将回退为分类文件预览"}</p>
          </div>

          {loadedCard ? (
            <div className="space-y-2">
              {slotOptions.map((option) => {
                const slot = option.value;
                const asset = findAssetBySlot(loadedCard.assets, slot);
                const pendingMode = assetPending[slot];
                const slotBusy = Boolean(pendingMode);
                const canDelete = Boolean(asset) && loadedCard.assets.length > 1;

                return (
                  <div key={slot} className="rounded-[1.1rem] border border-[var(--outline)]/20 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-[var(--foreground)]">{getSlotLabel(slot)}</p>
                        <p className="text-[10px] font-bold text-[var(--foreground)]/50">{asset ? `${asset.originalFileName} (${Math.max(1, Math.round(asset.size / 1024))} KB)` : "该分类暂无文件"}</p>
                      </div>
                      {asset ? (
                        <a href={asset.downloadUrl} className="rounded-full border border-[var(--outline)]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
                          下载
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {slot === "wechat_theme" || slot === "world_book" ? null : (
                        <label className="cursor-pointer rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
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
                      )}
                      <button
                        type="button"
                        className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-3 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canDelete || slotBusy || publishPending}
                        onClick={() => void handleDeleteAsset(slot)}
                      >
                        {pendingMode === "remove" ? "删除中..." : "删除该分类文件"}
                      </button>
                    </div>
                    {slot === "system_theme" ? (
                      <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                        替换系统主题时会校验主题包能否被 `baobaobaiphone` 正常解析和导入。
                      </p>
                    ) : slot === "wechat_theme" ? (
                      <WechatThemeSpecPanel
                        file={null}
                        onFileChange={(file) => {
                          if (file) {
                            void handleReplaceAsset(slot, file);
                          }
                        }}
                        existingTheme={loadedCard?.wechatTheme}
                        defaultAuthor={authorName}
                        disabled={slotBusy || publishPending}
                      />
                    ) : slot === "desktop_component" ? (
                      <p className="mt-1.5 text-[10px] font-bold text-[var(--foreground)]/55">
                        替换桌面组件时会校验 HTML 文件格式并重新读取组件配置。
                      </p>
                    ) : slot === "world_book" ? (
                      <WorldBookSpecPanel
                        file={null}
                        onFileChange={(file) => {
                          if (file) {
                            void handleReplaceAsset(slot, file);
                          }
                        }}
                        existingWorldBook={loadedCard?.worldBook}
                        existingDownloadUrl={asset?.downloadUrl}
                        defaultAuthor={authorName}
                        disabled={slotBusy || publishPending}
                      />
                    ) : null}
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
          {previewUrl ? <ShareImage src={previewUrl} alt={previewTitle} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-white/76">等待可预览文件...</div>}
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

  return (
    <section className="rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 border-b border-[var(--outline)]/20 pb-2">
        <h2 className="text-base font-black text-[var(--foreground)]">发布设置</h2>
      </div>

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
            className="w-full rounded-full bg-[var(--button-primary)] py-2 text-xs font-black shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMode === "published" ? "提交中..." : submitPrimaryLabel}
          </button>
          <button
            type="button"
            disabled={publishPending || hasAssetPending || reviewSubmitPending}
            onClick={submitDraft}
            className="w-full rounded-full border border-[var(--outline)]/20 bg-white py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMode === "draft" ? "提交中..." : submitSecondaryLabel}
          </button>

          {mode === "edit" && loadedCard ? (
            <button
              type="button"
              disabled={!canSubmitReview}
              onClick={handleSubmitReview}
              className="w-full rounded-full border border-[var(--outline)]/20 bg-white py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewSubmitPending ? "提交审核中..." : "提交审核"}
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
              className="w-full rounded-full border border-[#ff9c9c] bg-[#fff2f1] py-2 text-xs font-black text-[#b64031] shadow-sm transition hover:bg-[#ffe5e3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitMode === "delete" ? "删除中..." : "删除这张卡片"}
            </button>
          ) : null}
        </section>
      </div>

      {mode === "edit" && loadedCard ? (
        <div className="mt-3 space-y-1 text-[10px] font-bold text-[var(--foreground)]/50">
          <p>卡片 ID：{loadedCard.card.id}</p>
          <p>当前状态：{getStatusLabel(loadedCard.card.status)}</p>
          <p>审核状态：{getReviewStatusLabel(loadedCard.card.reviewStatus)}</p>
          {loadedCard.card.reviewReason ? <p>驳回原因：{loadedCard.card.reviewReason}</p> : null}
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


