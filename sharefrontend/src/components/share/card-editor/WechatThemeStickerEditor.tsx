"use client";

import { useId } from "react";

import {
  wechatThemeMetaLimits,
  type WechatThemeSticker,
  type WechatThemeStickerPack,
} from "@/components/share/card-editor/constants";

interface WechatThemeStickerEditorProps {
  stickerPacks: WechatThemeStickerPack[];
  onChange: (stickerPacks: WechatThemeStickerPack[]) => void;
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

function createEmptySticker(): WechatThemeSticker {
  return { id: generateId(), name: "", file: null };
}

function createEmptyPack(): WechatThemeStickerPack {
  return { id: generateId(), name: "", cover: null, stickers: [createEmptySticker()] };
}

export function WechatThemeStickerEditor({
  stickerPacks,
  onChange,
  disabled = false,
}: WechatThemeStickerEditorProps) {
  const baseId = useId();

  const handleAddPack = () => {
    if (stickerPacks.length >= wechatThemeMetaLimits.stickerPackCount.max) {
      return;
    }
    onChange([...stickerPacks, createEmptyPack()]);
  };

  const handleRemovePack = (packIndex: number) => {
    onChange(stickerPacks.filter((_, index) => index !== packIndex));
  };

  const handlePackNameChange = (packIndex: number, name: string) => {
    const next = stickerPacks.map((pack, index) =>
      index === packIndex ? { ...pack, name: name.slice(0, wechatThemeMetaLimits.stickerPackName.max) } : pack,
    );
    onChange(next);
  };

  const handleCoverChange = (packIndex: number, file: File | null) => {
    const next = stickerPacks.map((pack, index) => (index === packIndex ? { ...pack, cover: file } : pack));
    onChange(next);
  };

  const handleAddSticker = (packIndex: number) => {
    const pack = stickerPacks[packIndex];
    if (!pack || pack.stickers.length >= wechatThemeMetaLimits.stickersPerPack.max) {
      return;
    }
    const next = stickerPacks.map((p, index) =>
      index === packIndex ? { ...p, stickers: [...p.stickers, createEmptySticker()] } : p,
    );
    onChange(next);
  };

  const handleRemoveSticker = (packIndex: number, stickerIndex: number) => {
    const next = stickerPacks.map((pack, index) => {
      if (index !== packIndex) return pack;
      return { ...pack, stickers: pack.stickers.filter((_, i) => i !== stickerIndex) };
    });
    onChange(next);
  };

  const handleStickerNameChange = (packIndex: number, stickerIndex: number, name: string) => {
    const next = stickerPacks.map((pack, pIndex) => {
      if (pIndex !== packIndex) return pack;
      return {
        ...pack,
        stickers: pack.stickers.map((sticker, sIndex) =>
          sIndex === stickerIndex
            ? { ...sticker, name: name.slice(0, wechatThemeMetaLimits.stickerName.max) }
            : sticker,
        ),
      };
    });
    onChange(next);
  };

  const handleStickerFileChange = (packIndex: number, stickerIndex: number, file: File | null) => {
    const next = stickerPacks.map((pack, pIndex) => {
      if (pIndex !== packIndex) return pack;
      return {
        ...pack,
        stickers: pack.stickers.map((sticker, sIndex) =>
          sIndex === stickerIndex ? { ...sticker, file } : sticker,
        ),
      };
    });
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-[1rem] border border-[var(--outline)]/15 bg-white p-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-[var(--foreground)]/70">关联表情包</label>
        <button
          type="button"
          onClick={handleAddPack}
          disabled={disabled || stickerPacks.length >= wechatThemeMetaLimits.stickerPackCount.max}
          className="rounded-full border border-[var(--outline)]/20 bg-[var(--surface-container)] px-2.5 py-1 text-[10px] font-black text-[var(--foreground)]/78 transition hover:bg-[var(--surface-container)]/70 disabled:opacity-60"
        >
          + 添加表情包
        </button>
      </div>

      {stickerPacks.length === 0 ? (
        <p className="text-[10px] font-bold text-[var(--foreground)]/50">
          暂无关联表情包。点击上方按钮添加，用户安装主题时会自动导入这些表情。
        </p>
      ) : null}

      {stickerPacks.map((pack, packIndex) => (
        <div key={pack.id} className="space-y-2 rounded-[0.9rem] border border-[var(--outline)]/10 bg-[var(--surface-container)]/40 p-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pack.name}
              onChange={(event) => handlePackNameChange(packIndex, event.target.value)}
              placeholder="表情包名称"
              disabled={disabled}
              className="min-w-0 flex-1 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => handleRemovePack(packIndex)}
              disabled={disabled}
              className="shrink-0 rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2 py-1 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:opacity-60"
            >
              删除
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label
              className={`w-fit cursor-pointer rounded-full border px-3 py-1 text-[10px] font-black shadow-sm transition ${
                pack.cover
                  ? "border-[#07C160] bg-[#E6F7ED] text-[#07C160] hover:bg-[#D6F3E3]"
                  : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78 hover:bg-[var(--surface-container)]"
              }`}
            >
              {pack.cover ? "替换封面" : "上传封面"}
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  handleCoverChange(packIndex, selected);
                }}
              />
            </label>
            {pack.cover ? (
              <span className="text-[10px] font-bold text-[#07C160]">{pack.cover.name}</span>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--foreground)]/60">表情列表</span>
              <button
                type="button"
                onClick={() => handleAddSticker(packIndex)}
                disabled={disabled || pack.stickers.length >= wechatThemeMetaLimits.stickersPerPack.max}
                className="rounded-full border border-[var(--outline)]/20 bg-white px-2 py-0.5 text-[10px] font-black text-[var(--foreground)]/78 transition hover:bg-[var(--surface-container)] disabled:opacity-60"
              >
                + 表情
              </button>
            </div>

            {pack.stickers.map((sticker, stickerIndex) => (
              <div key={sticker.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={sticker.name}
                  onChange={(event) => handleStickerNameChange(packIndex, stickerIndex, event.target.value)}
                  placeholder="表情名称"
                  disabled={disabled}
                  className="min-w-0 flex-1 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-1 text-[11px] font-bold text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 focus:border-[var(--outline)] focus:outline-none disabled:opacity-60"
                />
                <label
                  className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm transition ${
                    sticker.file
                      ? "border-[#07C160] bg-[#E6F7ED] text-[#07C160] hover:bg-[#D6F3E3]"
                      : "border-[var(--outline)]/20 bg-white text-[var(--foreground)]/78 hover:bg-[var(--surface-container)]"
                  }`}
                >
                  {sticker.file ? "已上传" : "上传"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={disabled}
                    className="hidden"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      handleStickerFileChange(packIndex, stickerIndex, selected);
                    }}
                  />
                </label>
                {sticker.file ? (
                  <span className="max-w-[6rem] truncate text-[10px] font-bold text-[#07C160]">
                    {sticker.file.name}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleRemoveSticker(packIndex, stickerIndex)}
                  disabled={disabled}
                  className="shrink-0 rounded-full border border-[#ff9c9c] bg-[#fff2f1] px-2 py-1 text-[10px] font-black text-[#b64031] transition hover:bg-[#ffe5e3] disabled:opacity-60"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
