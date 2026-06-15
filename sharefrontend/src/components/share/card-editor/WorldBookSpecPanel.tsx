"use client";

import { useEffect, useId, useState } from "react";

import {
  worldBookMetaDefaults,
  worldBookProtocol,
  worldBookScopeOptions,
  worldBookTriggerModeOptions,
  type WorldBookEntry,
  type WorldBookMetadata,
  type WorldBookScope,
  type WorldBookTriggerMode,
} from "@/components/share/card-editor/constants";
import { parseTagInput } from "@/components/share/card-editor/wechat-theme";

type PanelMode = "upload" | "build";

interface WorldBookSpecPanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingDownloadUrl?: string | null;
  disabled?: boolean;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function createEmptyEntry(order: number): WorldBookEntry {
  return {
    id: generateId(),
    name: `条目 ${order}`,
    keywords: [],
    content: "",
    triggerMode: "keyword",
    insertionOrder: order,
    scope: "global",
  };
}

function buildWorldBookFile(metadata: WorldBookMetadata): File {
  const payload = {
    version: metadata.version,
    protocol: worldBookProtocol,
    worldBook: metadata.worldBook.map((entry) => ({
      id: entry.id,
      name: entry.name,
      keywords: entry.keywords,
      content: entry.content,
      triggerMode: entry.triggerMode,
      insertionOrder: entry.insertionOrder,
      scope: entry.scope,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  return new File([blob], "worldbook.json", { type: "application/json" });
}

async function parseWorldBookFile(file: File | Blob): Promise<WorldBookMetadata | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<WorldBookMetadata>;
    if (!Array.isArray(parsed.worldBook)) {
      return null;
    }
    const entries: WorldBookEntry[] = parsed.worldBook
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Partial<WorldBookEntry>;
        return {
          id: typeof raw.id === "string" && raw.id ? raw.id : generateId(),
          name: typeof raw.name === "string" ? raw.name : "",
          keywords: Array.isArray(raw.keywords)
            ? raw.keywords.filter((k): k is string => typeof k === "string")
            : [],
          content: typeof raw.content === "string" ? raw.content : "",
          triggerMode: ["keyword", "constant", "disabled"].includes(raw.triggerMode as string)
            ? (raw.triggerMode as WorldBookTriggerMode)
            : "keyword",
          insertionOrder: typeof raw.insertionOrder === "number" ? raw.insertionOrder : 1,
          scope: ["global", "character"].includes(raw.scope as string)
            ? (raw.scope as WorldBookScope)
            : "global",
        };
      })
      .filter((item): item is WorldBookEntry => item !== null);

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      worldBook: entries,
    };
  } catch {
    return null;
  }
}

export function WorldBookSpecPanel({
  file,
  onFileChange,
  existingDownloadUrl,
  disabled = false,
}: WorldBookSpecPanelProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>("upload");
  const [buildForm, setBuildForm] = useState<WorldBookMetadata>({ ...worldBookMetaDefaults });
  const [buildPending, setBuildPending] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [existingLoading, setExistingLoading] = useState(false);
  const [loadedExistingUrl, setLoadedExistingUrl] = useState<string | null>(null);
  const baseId = useId();

  useEffect(() => {
    if (!file || panelMode !== "upload") {
      return;
    }

    let active = true;
    parseWorldBookFile(file).then((parsed) => {
      if (!active || !parsed) return;
      setBuildForm((current) => ({
        ...current,
        worldBook: parsed.worldBook.length ? parsed.worldBook : current.worldBook,
      }));
    });

    return () => {
      active = false;
    };
  }, [file, panelMode]);

  useEffect(() => {
    if (panelMode !== "build") {
      return;
    }
    if (!existingDownloadUrl) {
      return;
    }
    if (loadedExistingUrl === existingDownloadUrl) {
      return;
    }
    if (buildForm.worldBook.length > 0) {
      return;
    }

    let active = true;
    setExistingLoading(true);

    const downloadUrl = existingDownloadUrl.startsWith("http")
      ? existingDownloadUrl
      : `${window.location.origin}${existingDownloadUrl}`;

    fetch(downloadUrl, { method: "GET", credentials: "omit" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          throw new Error(`下载失败 (${response.status})`);
        }
        const parsed = await parseWorldBookFile(await response.blob());
        if (!active || !parsed) return;
        setBuildForm((current) => ({
          ...current,
          worldBook: parsed.worldBook.length ? parsed.worldBook : current.worldBook,
        }));
        setLoadedExistingUrl(existingDownloadUrl);
      })
      .catch(() => {
        // 静默失败，用户仍可手动填写
      })
      .finally(() => {
        if (active) {
          setExistingLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [panelMode, existingDownloadUrl, loadedExistingUrl, buildForm.worldBook.length]);

  const handleFormChange = <K extends keyof WorldBookMetadata>(key: K, value: WorldBookMetadata[K]) => {
    setBuildForm((current) => ({ ...current, [key]: value }));
  };

  const handleEntryChange = <K extends keyof WorldBookEntry>(
    index: number,
    key: K,
    value: WorldBookEntry[K],
  ) => {
    setBuildForm((current) => {
      const nextEntries = [...current.worldBook];
      nextEntries[index] = { ...nextEntries[index], [key]: value };
      return { ...current, worldBook: nextEntries };
    });
  };

  const handleEntryKeywordsChange = (index: number, value: string) => {
    const keywords = parseTagInput(value);
    handleEntryChange(index, "keywords", keywords);
  };

  const handleAddEntry = () => {
    setBuildForm((current) => ({
      ...current,
      worldBook: [...current.worldBook, createEmptyEntry(current.worldBook.length + 1)],
    }));
  };

  const handleRemoveEntry = (index: number) => {
    setBuildForm((current) => ({
      ...current,
      worldBook: current.worldBook.filter((_, i) => i !== index),
    }));
  };

  const handleBuild = async () => {
    if (buildForm.worldBook.length === 0) {
      setBuildError("请至少添加一条世界书条目。");
      return;
    }
    if (buildForm.worldBook.some((entry) => !entry.name.trim() && !entry.content.trim())) {
      setBuildError("请为每条世界书条目填写名称或内容。");
      return;
    }

    setBuildPending(true);
    setBuildError(null);

    try {
      const nextFile = buildWorldBookFile(buildForm);
      onFileChange(nextFile);
      setPanelMode("upload");
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "生成世界书文件失败");
    } finally {
      setBuildPending(false);
    }
  };

  const handleClear = () => {
    onFileChange(null);
    setBuildForm({ ...worldBookMetaDefaults });
  };

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
          上传 JSON
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
            {file ? (
              <>
                <span className="rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1.5 text-[10px] font-black text-[var(--foreground)]/78">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2.5 py-1.5 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]"
                  disabled={disabled}
                >
                  清除
                </button>
              </>
            ) : (
              <span className="text-[10px] font-bold text-[var(--foreground)]/50">尚未上传世界书 JSON 文件</span>
            )}
          </div>
          {file ? (
            <p className="text-[10px] font-bold text-[var(--foreground)]/55">
              当前已选择文件，提交后会按 `baobaobaiphone` 世界书格式校验。
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {existingLoading ? (
            <div className="rounded-[0.8rem] bg-[var(--surface-container)] p-2 text-[10px] font-bold text-[var(--foreground)]/70">
              正在从已有世界书文件中加载条目...
            </div>
          ) : null}
          <p className="text-[10px] font-bold text-[var(--foreground)]/55">
            世界书名称、作者与标签将使用卡片级信息，无需在此重复填写。
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-[var(--foreground)]/70">世界书条目</label>
              <button
                type="button"
                onClick={handleAddEntry}
                className="rounded-full border border-[var(--outline)]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[var(--foreground)]/78 transition hover:bg-[var(--surface-container)]"
                disabled={disabled}
              >
                + 添加条目
              </button>
            </div>

            {buildForm.worldBook.length === 0 ? (
              <p className="text-[10px] font-bold text-[var(--foreground)]/50">暂无条目，点击上方按钮添加。</p>
            ) : null}

            {buildForm.worldBook.map((entry, index) => (
              <div key={entry.id} className="rounded-[1rem] border border-[var(--outline)]/15 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--foreground)]">条目 #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(index)}
                    className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2 py-1 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]"
                    disabled={disabled}
                  >
                    删除
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">名称</label>
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(event) => handleEntryChange(index, "name", event.target.value)}
                      className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                      placeholder="条目名称"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">关键词</label>
                    <input
                      type="text"
                      value={entry.keywords.join(", ")}
                      onChange={(event) => handleEntryKeywordsChange(index, event.target.value)}
                      className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                      placeholder="关键词1, 关键词2"
                      disabled={disabled}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="min-w-[80px]">
                      <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">触发模式</label>
                      <select
                        value={entry.triggerMode}
                        onChange={(event) =>
                          handleEntryChange(index, "triggerMode", event.target.value as WorldBookTriggerMode)
                        }
                        className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-2 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                        disabled={disabled}
                      >
                        {worldBookTriggerModeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[80px]">
                      <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">范围</label>
                      <select
                        value={entry.scope}
                        onChange={(event) => handleEntryChange(index, "scope", event.target.value as WorldBookScope)}
                        className="h-8 w-full rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-2 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                        disabled={disabled}
                      >
                        {worldBookScopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">内容</label>
                  <textarea
                    value={entry.content}
                    onChange={(event) => handleEntryChange(index, "content", event.target.value)}
                    rows={3}
                    className="w-full rounded-[1rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                    placeholder="触发时注入到提示词的内容..."
                    disabled={disabled}
                  />
                </div>

                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-bold text-[var(--foreground)]/60">重要度（数字越小越重要）</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={entry.insertionOrder}
                    onChange={(event) =>
                      handleEntryChange(index, "insertionOrder", Math.max(1, parseInt(event.target.value, 10) || 1))
                    }
                    className="h-8 w-24 rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:outline-none"
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>

          {buildError ? (
            <p className="rounded-[0.8rem] bg-[#fff2f1] p-2 text-[10px] font-bold text-[#b64031]">{buildError}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleBuild()}
            disabled={buildPending || disabled}
            className="w-full rounded-full border border-transparent bg-[var(--button-primary)] px-3 py-2 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {buildPending ? "生成中..." : "生成世界书 JSON"}
          </button>
        </div>
      )}
    </div>
  );
}
