"use client";

import { useEffect, useId, useMemo, useState } from "react";

import {
  wechatThemeBubblePresetOptions,
  wechatThemeMetaDefaults,
  wechatThemeMetaLimits,
  wechatThemeProtocol,
  type WechatThemeMetadata,
} from "@/components/share/card-editor/constants";
import {
  createCompliantWechatThemeZip,
  detectWechatThemeFormat,
  formatTagInput,
  parseTagInput,
  validateWechatThemeFile,
  type WechatThemeBuildFiles,
  type WechatThemeValidationResult,
} from "@/components/share/card-editor/wechat-theme";
import type { ShareWechatTheme } from "@/lib/shared";

type PanelMode = "upload" | "build";

interface WechatThemeSpecPanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingTheme?: ShareWechatTheme | null;
  defaultAuthor?: string;
  disabled?: boolean;
}

const labelMap: Record<keyof WechatThemeMetadata, string> = {
  name: "主题名称",
  author: "作者",
  version: "版本",
  description: "描述",
  tags: "标签",
  chatBackgroundOpacity: "背景透明度",
  selfBubblePreset: "我的气泡",
  peerBubblePreset: "对方气泡",
  rendererSource: "渲染源码",
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function WechatThemeSpecPanel({
  file,
  onFileChange,
  existingTheme,
  defaultAuthor = "",
  disabled = false,
}: WechatThemeSpecPanelProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>("upload");
  const [validation, setValidation] = useState<WechatThemeValidationResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [buildForm, setBuildForm] = useState<WechatThemeMetadata>({ ...wechatThemeMetaDefaults });
  const [tagDraft, setTagDraft] = useState("");
  const [buildFiles, setBuildFiles] = useState<WechatThemeBuildFiles>({
    chatBackgroundImage: null,
    rendererSourceFile: null,
  });
  const [buildPending, setBuildPending] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const baseId = useId();

  const currentFormat = useMemo(() => detectWechatThemeFormat(file), [file]);

  useEffect(() => {
    if (existingTheme) {
      setBuildForm((current) => ({
        ...current,
        name: existingTheme.name || current.name,
        author: existingTheme.author || current.author || defaultAuthor,
        version: existingTheme.version || current.version,
        description: existingTheme.description || current.description,
        tags: existingTheme.tags?.length ? existingTheme.tags : current.tags,
        chatBackgroundOpacity: existingTheme.chatBackgroundOpacity ?? current.chatBackgroundOpacity,
        selfBubblePreset: (existingTheme.selfBubblePreset as WechatThemeMetadata["selfBubblePreset"]) || current.selfBubblePreset,
        peerBubblePreset: (existingTheme.peerBubblePreset as WechatThemeMetadata["peerBubblePreset"]) || current.peerBubblePreset,
        rendererSource: existingTheme.rendererSource || current.rendererSource,
      }));
      setTagDraft(formatTagInput(existingTheme.tags || []));
    } else if (defaultAuthor) {
      setBuildForm((current) => ({
        ...current,
        author: current.author || defaultAuthor,
      }));
    }
  }, [existingTheme, defaultAuthor]);

  useEffect(() => {
    if (!file || panelMode !== "upload") {
      if (!file) setValidation(null);
      return;
    }

    let active = true;
    setChecking(true);
    validateWechatThemeFile(file).then((result) => {
      if (!active) return;
      setValidation(result);
      if (result.parsed.name) {
        setBuildForm((current) => ({
          ...current,
          name: result.parsed.name || current.name,
          author: result.parsed.author || current.author,
          version: result.parsed.version || current.version,
          description: result.parsed.description || current.description,
          tags: result.parsed.tags?.length ? result.parsed.tags : current.tags,
          chatBackgroundOpacity: result.parsed.chatBackgroundOpacity ?? current.chatBackgroundOpacity,
          selfBubblePreset: result.parsed.selfBubblePreset || current.selfBubblePreset,
          peerBubblePreset: result.parsed.peerBubblePreset || current.peerBubblePreset,
          rendererSource: result.parsed.rendererSource || current.rendererSource,
        }));
        setTagDraft(formatTagInput(result.parsed.tags || []));
      }
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [file, panelMode]);

  const handleFormChange = <K extends keyof WechatThemeMetadata>(key: K, value: WechatThemeMetadata[K]) => {
    setBuildForm((current) => ({ ...current, [key]: value }));
  };

  const handleTagDraftChange = (value: string) => {
    setTagDraft(value);
    const tags = parseTagInput(value);
    handleFormChange("tags", tags.slice(0, wechatThemeMetaLimits.tags.maxCount));
  };

  const handleTagDraftBlur = () => {
    setTagDraft(formatTagInput(buildForm.tags));
  };

  const handleBuild = async () => {
    if (!buildForm.name.trim()) {
      setBuildError("请填写主题名称。");
      return;
    }

    setBuildPending(true);
    setBuildError(null);

    try {
      const nextFile = await createCompliantWechatThemeZip(buildForm, buildFiles);
      onFileChange(nextFile);
      setPanelMode("upload");
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "生成主题包失败");
    } finally {
      setBuildPending(false);
    }
  };

  const handleClear = () => {
    onFileChange(null);
    setValidation(null);
    setBuildFiles({ chatBackgroundImage: null, rendererSourceFile: null });
  };

  const allGood = Boolean(validation?.valid && validation.errors.length === 0 && validation.warnings.length === 0);

  return (
    <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]/60 p-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanelMode("upload")}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition ${
            panelMode === "upload"
              ? "border-transparent bg-[var(--button-primary)] text-white"
              : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78"
          } ${disabled ? "opacity-60" : ""}`}
          disabled={disabled}
        >
          上传主题包
        </button>
        <button
          type="button"
          onClick={() => setPanelMode("build")}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition ${
            panelMode === "build"
              ? "border-transparent bg-[var(--button-primary)] text-white"
              : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78"
          } ${disabled ? "opacity-60" : ""}`}
          disabled={disabled}
        >
          填写信息生成
        </button>
      </div>

      {panelMode === "upload" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
              {file ? "替换主题包" : "选择 .zip / .json"}
              <input
                type="file"
                accept=".zip,.json,application/zip,application/json"
                disabled={disabled}
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  onFileChange(selected);
                }}
              />
            </label>
            {file ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2.5 py-1 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:opacity-60"
              >
                清除
              </button>
            ) : null}
          </div>

          {file ? (
            <div className="text-[10px] font-bold text-[var(--foreground)]/60">
              当前文件：{file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              {currentFormat !== "unknown" ? ` · ${currentFormat.toUpperCase()}` : null}
            </div>
          ) : null}

          {validation || checking ? (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                  checking
                    ? "bg-slate-200 text-slate-500"
                    : allGood
                      ? "bg-emerald-100 text-emerald-600"
                      : validation?.valid
                        ? "bg-amber-100 text-amber-600"
                        : "bg-rose-100 text-rose-600"
                }`}
              >
                {checking ? "⋯" : allGood ? "✓" : validation?.valid ? "!" : "✕"}
              </span>
              <span className="text-[11px] font-black text-[var(--foreground)]/80">
                {checking
                  ? "正在校验协议..."
                  : allGood
                    ? `已符合 ${wechatThemeProtocol}`
                    : validation?.valid
                      ? "基本符合协议，存在提示"
                      : "未通过协议校验"}
              </span>
            </div>
          ) : null}

          {validation && validation.errors.length > 0 ? (
            <ul className="space-y-1">
              {validation.errors.map((error, index) => (
                <li key={`err-${baseId}-${index}`} className="text-[10px] font-bold text-rose-600">
                  • {error}
                </li>
              ))}
            </ul>
          ) : null}

          {validation && validation.warnings.length > 0 ? (
            <ul className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={`warn-${baseId}-${index}`} className="text-[10px] font-bold text-amber-600">
                  • {warning}
                </li>
              ))}
            </ul>
          ) : null}

          {validation && validation.errors.length === 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[var(--foreground)]/70 sm:grid-cols-3">
              <div>
                <span className="font-bold text-[var(--foreground)]/50">名称：</span>
                {validation.parsed.name || "未命名主题"}
              </div>
              <div>
                <span className="font-bold text-[var(--foreground)]/50">作者：</span>
                {validation.parsed.author || "—"}
              </div>
              <div>
                <span className="font-bold text-[var(--foreground)]/50">版本：</span>
                {validation.parsed.version || "—"}
              </div>
              <div>
                <span className="font-bold text-[var(--foreground)]/50">我的气泡：</span>
                {wechatThemeBubblePresetOptions.find((item) => item.value === validation.parsed.selfBubblePreset)?.label ||
                  "微信默认"}
              </div>
              <div>
                <span className="font-bold text-[var(--foreground)]/50">对方气泡：</span>
                {wechatThemeBubblePresetOptions.find((item) => item.value === validation.parsed.peerBubblePreset)?.label ||
                  "微信默认"}
              </div>
              <div>
                <span className="font-bold text-[var(--foreground)]/50">背景透明度：</span>
                {Math.round((validation.parsed.chatBackgroundOpacity ?? 0) * 100)}%
              </div>
              {validation.parsed.chatBackgroundImage ? (
                <div className="col-span-2 sm:col-span-3">
                  <span className="font-bold text-[var(--foreground)]/50">背景图：</span>
                  {validation.parsed.chatBackgroundImage}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {panelMode === "build" ? (
        <div className="space-y-3">
          {buildError ? (
            <div className="rounded-[0.8rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-600">
              {buildError}
            </div>
          ) : null}

          {(
            [
              { key: "name", type: "text", placeholder: "输入主题名称", required: true },
              { key: "author", type: "text", placeholder: "输入作者（可选）" },
              { key: "version", type: "text", placeholder: "例如 1.0.0" },
            ] as const
          ).map((field) => {
            const fieldKey = field.key as keyof WechatThemeMetadata;
            const inputId = `${baseId}-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <label htmlFor={inputId} className="min-w-[5.5rem] text-[10px] font-black text-[var(--foreground)]/70">
                  {labelMap[fieldKey]}
                  {"required" in field && field.required ? <span className="text-rose-500"> *</span> : null}
                </label>
                <input
                  id={inputId}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={buildForm[fieldKey] as string}
                  disabled={disabled}
                  onChange={(event) => handleFormChange(fieldKey, event.target.value as WechatThemeMetadata[typeof fieldKey])}
                  className="h-8 flex-1 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>
            );
          })}

          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-description`} className="text-[10px] font-black text-[var(--foreground)]/70">
              {labelMap.description}
            </label>
            <textarea
              id={`${baseId}-description`}
              rows={3}
              placeholder="补充主题说明..."
              value={buildForm.description}
              disabled={disabled}
              onChange={(event) => handleFormChange("description", event.target.value)}
              className="w-full resize-y rounded-[1rem] border border-[var(--outline)]/20 bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-tags`} className="text-[10px] font-black text-[var(--foreground)]/70">
              {labelMap.tags}
              <span className="font-normal text-[var(--foreground)]/50">
                {" "}
                （用逗号、回车或分号分隔，最多 {wechatThemeMetaLimits.tags.maxCount} 个）
              </span>
            </label>
            <input
              id={`${baseId}-tags`}
              type="text"
              placeholder="例如：简约, 深色, 微信风"
              value={tagDraft}
              disabled={disabled}
              onChange={(event) => handleTagDraftChange(event.target.value)}
              onBlur={handleTagDraftBlur}
              className="h-8 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:bg-white focus:outline-none disabled:opacity-60"
            />
            {buildForm.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {buildForm.tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--outline)]/20 bg-white px-2 py-0.5 text-[10px] font-black text-[var(--foreground)]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => {
                        const nextTags = buildForm.tags.filter((_, i) => i !== index);
                        handleFormChange("tags", nextTags);
                        setTagDraft(formatTagInput(nextTags));
                      }}
                      disabled={disabled}
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#ff9c9c] bg-[#fff2f1] text-[8px] leading-none text-[#b64031] disabled:opacity-60"
                      aria-label={`删除标签 ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${baseId}-selfBubblePreset`} className="text-[10px] font-black text-[var(--foreground)]/70">
                {labelMap.selfBubblePreset}
              </label>
              <select
                id={`${baseId}-selfBubblePreset`}
                value={buildForm.selfBubblePreset}
                disabled={disabled}
                onChange={(event) =>
                  handleFormChange("selfBubblePreset", event.target.value as WechatThemeMetadata["selfBubblePreset"])
                }
                className="h-8 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
              >
                {wechatThemeBubblePresetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${baseId}-peerBubblePreset`} className="text-[10px] font-black text-[var(--foreground)]/70">
                {labelMap.peerBubblePreset}
              </label>
              <select
                id={`${baseId}-peerBubblePreset`}
                value={buildForm.peerBubblePreset}
                disabled={disabled}
                onChange={(event) =>
                  handleFormChange("peerBubblePreset", event.target.value as WechatThemeMetadata["peerBubblePreset"])
                }
                className="h-8 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
              >
                {wechatThemeBubblePresetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`${baseId}-opacity`} className="text-[10px] font-black text-[var(--foreground)]/70">
                {labelMap.chatBackgroundOpacity}
              </label>
              <span className="text-[10px] font-bold text-[var(--foreground)]/60">
                {Math.round(buildForm.chatBackgroundOpacity * 100)}%
              </span>
            </div>
            <input
              id={`${baseId}-opacity`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(buildForm.chatBackgroundOpacity * 100)}
              disabled={disabled}
              onChange={(event) =>
                handleFormChange(
                  "chatBackgroundOpacity",
                  clamp(Number(event.target.value) / 100, 0, 1),
                )
              }
              className="w-full accent-[var(--button-primary)] disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-[var(--foreground)]/70">
              聊天背景图（可选）
            </label>
            <label className="w-fit cursor-pointer rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]">
              {buildFiles.chatBackgroundImage ? "替换背景图" : "上传背景图"}
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  setBuildFiles((current) => ({ ...current, chatBackgroundImage: selected }));
                }}
              />
            </label>
            {buildFiles.chatBackgroundImage ? (
              <div className="text-[10px] font-bold text-[var(--foreground)]/60">
                已选择：{buildFiles.chatBackgroundImage.name}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-rendererSource`} className="text-[10px] font-black text-[var(--foreground)]/70">
              {labelMap.rendererSource}
              <span className="font-normal text-[var(--foreground)]/50">（可选，JSON 或 module.exports）</span>
            </label>
            <textarea
              id={`${baseId}-rendererSource`}
              rows={5}
              placeholder="粘贴 JSON 或 module.exports 源码..."
              value={buildForm.rendererSource}
              disabled={disabled}
              onChange={(event) => handleFormChange("rendererSource", event.target.value)}
              className="w-full resize-y rounded-[1rem] border border-[var(--outline)]/20 bg-white px-3 py-2 font-mono text-[11px] font-bold leading-5 text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleBuild()}
              disabled={buildPending || disabled}
              className="rounded-full border border-transparent bg-[var(--button-primary)] px-4 py-1.5 text-[10px] font-black text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {buildPending ? "生成中..." : "生成并应用主题包"}
            </button>
            <span className="text-[10px] font-bold text-[var(--foreground)]/50">
              点击后会打包为符合协议的 .zip 并替换当前文件
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
