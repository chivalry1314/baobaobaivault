"use client";

import { useEffect, useId, useState } from "react";

import {
  desktopComponentMetaDefaults,
  desktopComponentMetaLimits,
  desktopComponentProtocol,
  type DesktopComponentMetadata,
} from "@/components/share/card-editor/constants";
import {
  createCompliantDesktopComponentFile,
  validateDesktopComponentFile,
  type DesktopComponentValidationResult,
} from "@/components/share/card-editor/desktop-component";

interface DesktopComponentSpecPanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const labelMap: Record<keyof DesktopComponentMetadata, string> = {
  name: "组件名称",
  width: "宽度（格）",
  height: "高度（格）",
  cornerRadius: "圆角（px）",
  frosted: "毛玻璃（px）",
  shadow: "阴影（px）",
  backgroundOpacity: "背景不透明度（%）",
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function DesktopComponentSpecPanel({ file, onFileChange }: DesktopComponentSpecPanelProps) {
  const [validation, setValidation] = useState<DesktopComponentValidationResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DesktopComponentMetadata>({ ...desktopComponentMetaDefaults });
  const [applyPending, setApplyPending] = useState(false);
  const baseId = useId();

  useEffect(() => {
    if (!file) {
      setValidation(null);
      setForm({ ...desktopComponentMetaDefaults });
      setIsEditing(false);
      return;
    }

    let active = true;
    setChecking(true);
    validateDesktopComponentFile(file).then((result) => {
      if (!active) return;
      setValidation(result);
      setForm({ ...result.parsed });
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [file]);

  const handleFormChange = <K extends keyof DesktopComponentMetadata>(key: K, value: DesktopComponentMetadata[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleApply = async () => {
    if (!file) return;

    setApplyPending(true);
    try {
      const newFile = await createCompliantDesktopComponentFile(file, form);
      onFileChange(newFile);
      const result = await validateDesktopComponentFile(newFile);
      setValidation(result);
      setForm({ ...result.parsed });
      setIsEditing(false);
    } finally {
      setApplyPending(false);
    }
  };

  const handleClear = () => {
    onFileChange(null);
  };

  const allGood = Boolean(validation?.valid && validation.errors.length === 0 && validation.warnings.length === 0);

  return (
    <div className="mt-3 rounded-[1rem] border border-[var(--outline)]/15 bg-[var(--surface-container)]/60 p-3">
      <div className="flex items-center justify-between gap-2">
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
                ? `已符合 ${desktopComponentProtocol}`
                : validation?.valid
                  ? `基本符合协议，存在提示`
                  : "未通过协议校验"}
          </span>
        </div>
        {file && !checking ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((current) => !current)}
              className="rounded-full border border-[var(--outline)]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
            >
              {isEditing ? "收起表单" : "编辑组件信息"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2.5 py-1 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3]"
            >
              重新选择
            </button>
          </div>
        ) : null}
      </div>

      {validation && validation.errors.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {validation.errors.map((error, index) => (
            <li key={`err-${baseId}-${index}`} className="text-[10px] font-bold text-rose-600">
              • {error}
            </li>
          ))}
        </ul>
      ) : null}

      {validation && validation.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {validation.warnings.map((warning, index) => (
            <li key={`warn-${baseId}-${index}`} className="text-[10px] font-bold text-amber-600">
              • {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {validation && !isEditing && validation.errors.length === 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[var(--foreground)]/70 sm:grid-cols-3">
          <div>
            <span className="font-bold text-[var(--foreground)]/50">名称：</span>
            {validation.parsed.name || "未命名组件"}
          </div>
          <div>
            <span className="font-bold text-[var(--foreground)]/50">尺寸：</span>
            {validation.parsed.width}×{validation.parsed.height}
          </div>
          <div>
            <span className="font-bold text-[var(--foreground)]/50">圆角：</span>
            {validation.parsed.cornerRadius}px
          </div>
          <div>
            <span className="font-bold text-[var(--foreground)]/50">毛玻璃：</span>
            {validation.parsed.frosted}px
          </div>
          <div>
            <span className="font-bold text-[var(--foreground)]/50">阴影：</span>
            {validation.parsed.shadow}px
          </div>
          <div>
            <span className="font-bold text-[var(--foreground)]/50">不透明度：</span>
            {validation.parsed.backgroundOpacity}%
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <div className="mt-3 space-y-2">
          {(
            [
              { key: "name", type: "text", placeholder: "输入组件名称" },
              { key: "width", type: "number", min: desktopComponentMetaLimits.width.min, max: desktopComponentMetaLimits.width.max },
              { key: "height", type: "number", min: desktopComponentMetaLimits.height.min, max: desktopComponentMetaLimits.height.max },
              { key: "cornerRadius", type: "number", min: desktopComponentMetaLimits.cornerRadius.min, max: desktopComponentMetaLimits.cornerRadius.max },
              { key: "frosted", type: "number", min: desktopComponentMetaLimits.frosted.min, max: desktopComponentMetaLimits.frosted.max },
              { key: "shadow", type: "number", min: desktopComponentMetaLimits.shadow.min, max: desktopComponentMetaLimits.shadow.max },
              { key: "backgroundOpacity", type: "number", min: desktopComponentMetaLimits.backgroundOpacity.min, max: desktopComponentMetaLimits.backgroundOpacity.max },
            ] as const
          ).map((field) => {
            const fieldKey = field.key as keyof DesktopComponentMetadata;
            const inputId = `${baseId}-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <label htmlFor={inputId} className="min-w-[8rem] text-[10px] font-black text-[var(--foreground)]/70">
                  {labelMap[fieldKey]}
                </label>
                <input
                  id={inputId}
                  type={field.type}
                  min={field.type === "number" ? field.min : undefined}
                  max={field.type === "number" ? field.max : undefined}
                  placeholder={"placeholder" in field ? field.placeholder : undefined}
                  value={form[fieldKey]}
                  onChange={(event) => {
                    if (field.type === "number") {
                      const parsed = Number.parseInt(event.target.value, 10);
                      handleFormChange(fieldKey, clamp(Number.isFinite(parsed) ? parsed : 0, field.min, field.max));
                    } else {
                      handleFormChange(fieldKey, event.target.value);
                    }
                  }}
                  className="h-8 flex-1 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] focus:border-[var(--outline)] focus:bg-white focus:outline-none"
                />
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applyPending || !file}
              className="rounded-full border border-transparent bg-[var(--button-primary)] px-4 py-1.5 text-[10px] font-black text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {applyPending ? "生成中..." : "应用规范到 HTML"}
            </button>
            <span className="text-[10px] font-bold text-[var(--foreground)]/50">
              点击后会将 meta 标签写入 HTML 并替换当前文件
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
