"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import {
  characterPersonaMetaDefaults,
  characterPersonaMetaLimits,
  characterPersonaProtocol,
  type CharacterPersonaContact,
  type CharacterPersonaMetadata,
} from "@/components/share/card-editor/constants";

type PanelMode = "upload" | "build";

interface CharacterPersonaSpecPanelProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingDownloadUrl?: string | null;
  disabled?: boolean;
}

function createEmptyContact(): CharacterPersonaContact {
  return {
    name: "",
    phone: "",
    avatar: "",
    description: "",
    greeting: "",
    note: "",
  };
}

function buildCharacterPersonaFile(metadata: CharacterPersonaMetadata): File {
  const payload = {
    version: metadata.version,
    protocol: characterPersonaProtocol,
    contacts: metadata.contacts.map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      avatar: contact.avatar,
      description: contact.description,
      greeting: contact.greeting,
      note: contact.note,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  return new File([blob], "character-persona.json", { type: "application/json" });
}

async function parseCharacterPersonaFile(file: File | Blob): Promise<CharacterPersonaMetadata | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<CharacterPersonaMetadata>;
    if (!Array.isArray(parsed.contacts)) {
      return null;
    }

    const contacts: CharacterPersonaContact[] = parsed.contacts
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Partial<CharacterPersonaContact>;
        return {
          name: typeof raw.name === "string" ? raw.name : "",
          phone: typeof raw.phone === "string" ? raw.phone : "",
          avatar: typeof raw.avatar === "string" ? raw.avatar : "",
          description: typeof raw.description === "string" ? raw.description : "",
          greeting: typeof raw.greeting === "string" ? raw.greeting : "",
          note: typeof raw.note === "string" ? raw.note : "",
        };
      })
      .filter((item): item is CharacterPersonaContact => item !== null);

    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      contacts,
    };
  } catch {
    return null;
  }
}

export function CharacterPersonaSpecPanel({
  file,
  onFileChange,
  existingDownloadUrl,
  disabled = false,
}: CharacterPersonaSpecPanelProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>("upload");
  const [buildForm, setBuildForm] = useState<CharacterPersonaMetadata>({ ...characterPersonaMetaDefaults });
  const [buildPending, setBuildPending] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildSuccess, setBuildSuccess] = useState(false);
  const [existingLoading, setExistingLoading] = useState(false);
  const [loadedExistingUrl, setLoadedExistingUrl] = useState<string | null>(null);
  const baseId = useId();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const greetingRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    if (!file || panelMode !== "upload") {
      return;
    }

    let active = true;
    parseCharacterPersonaFile(file).then((parsed) => {
      if (!active || !parsed) return;
      setBuildForm((current) => ({
        ...current,
        contacts: parsed.contacts.length ? parsed.contacts : current.contacts,
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
    if (buildForm.contacts.length > 0) {
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
        const parsed = await parseCharacterPersonaFile(await response.blob());
        if (!active || !parsed) return;
        setBuildForm((current) => ({
          ...current,
          contacts: parsed.contacts.length ? parsed.contacts : current.contacts,
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
  }, [panelMode, existingDownloadUrl, loadedExistingUrl, buildForm.contacts.length]);

  const handleContactChange = <K extends keyof CharacterPersonaContact>(key: K, value: CharacterPersonaContact[K]) => {
    setBuildForm((current) => {
      const nextContacts = [...current.contacts];
      if (nextContacts.length === 0) {
        nextContacts.push(createEmptyContact());
      }
      nextContacts[0] = { ...nextContacts[0], [key]: value };
      return { ...current, contacts: nextContacts };
    });
  };

  const contact = buildForm.contacts[0] ?? createEmptyContact();

  useLayoutEffect(() => {
    adjustTextareaHeight(descriptionRef.current);
  }, [contact.description]);

  useLayoutEffect(() => {
    adjustTextareaHeight(greetingRef.current);
  }, [contact.greeting]);

  const handleBuildFile = () => {
    setBuildError(null);
    const contactName = contact.name.trim();
    if (!contactName) {
      setBuildError("请先填写联系人姓名");
      return;
    }

    setBuildPending(true);
    try {
      const nextFile = buildCharacterPersonaFile(buildForm);
      setBuildSuccess(true);
      onFileChange(nextFile);
      setPanelMode("upload");
    } finally {
      setBuildPending(false);
    }
  };

  const handleResetForm = () => {
    setBuildForm({ ...characterPersonaMetaDefaults });
    setBuildError(null);
    setBuildSuccess(false);
    onFileChange(null);
  };

  return (
    <div className="mt-4 space-y-4 rounded-[1.2rem] border border-[var(--outline)]/20 bg-[var(--surface-container)] p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelMode("upload")}
          disabled={disabled}
          className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${
            panelMode === "upload"
              ? "bg-[var(--button-primary)] text-[var(--foreground)]"
              : "border border-[var(--outline)]/20 bg-white text-[var(--foreground)]/70 hover:bg-[var(--surface-container)]"
          }`}
        >
          上传 JSON
        </button>
        <button
          type="button"
          onClick={() => setPanelMode("build")}
          disabled={disabled}
          className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${
            panelMode === "build"
              ? "bg-[var(--button-primary)] text-[var(--foreground)]"
              : "border border-[var(--outline)]/20 bg-white text-[var(--foreground)]/70 hover:bg-[var(--surface-container)]"
          }`}
        >
          填写信息生成
        </button>
      </div>

      {panelMode === "upload" ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--outline)]/20 bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)]">
            <span>选择角色人设 JSON 文件</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                setBuildSuccess(false);
                onFileChange(event.target.files?.[0] ?? null);
              }}
            />
          </label>
          {file ? (
            <div
              className={`rounded-xl bg-white px-3 py-2 text-xs font-bold ${
                buildSuccess ? "text-emerald-600" : "text-[var(--foreground)]/80"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {buildSuccess ? (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">
                    ✓
                  </span>
                ) : null}
                已选择：{file.name}
                {buildSuccess ? <span className="text-[10px]">（已成功生成）</span> : null}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {existingLoading ? (
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)]/60">
              正在加载已有角色人设信息…
            </div>
          ) : null}

          <div className="rounded-[1rem] border border-[var(--outline)]/15 bg-white p-3 space-y-3">
            <p className="text-xs font-black text-[var(--foreground)]/70">联系人信息</p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[var(--foreground)]/60">头像（可选）</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-[var(--outline)]/20 bg-white px-3 py-2 text-xs font-bold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-container)] disabled:opacity-60">
                  上传图片
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={disabled}
                    onChange={async (event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = "";
                      if (!selected) return;
                      if (selected.size > 1024 * 1024) {
                        setBuildError("头像图片请控制在 1MB 以内");
                        return;
                      }
                      try {
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onerror = () => reject(new Error("读取图片失败"));
                          reader.onload = () => resolve(String(reader.result || ""));
                          reader.readAsDataURL(selected);
                        });
                        handleContactChange("avatar", dataUrl);
                        setBuildError(null);
                      } catch {
                        setBuildError("头像读取失败，请换一张图片重试");
                      }
                    }}
                  />
                </label>
                {contact.avatar ? (
                  <button
                    type="button"
                    onClick={() => handleContactChange("avatar", "")}
                    disabled={disabled}
                    className="rounded-lg border border-[#ff9c9c] bg-[#fff2f1] px-3 py-2 text-xs font-bold text-[#b64031] transition hover:bg-[#ffe5e3] disabled:opacity-60"
                  >
                    清除头像
                  </button>
                ) : null}
              </div>
              {contact.avatar ? (
                <div className="inline-block overflow-hidden rounded-lg border border-[var(--outline)]/20">
                  <img src={contact.avatar} alt="头像预览" className="h-16 w-16 object-cover" />
                </div>
              ) : (
                <p className="text-[10px] font-bold text-[var(--foreground)]/50">未上传头像</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-contact-name`} className="text-[10px] font-black text-[var(--foreground)]/60">
                  姓名
                </label>
                <input
                  id={`${baseId}-contact-name`}
                  type="text"
                  value={contact.name}
                  maxLength={characterPersonaMetaLimits.contact.name.max}
                  onChange={(event) => handleContactChange("name", event.target.value)}
                  placeholder="必填"
                  disabled={disabled}
                  className="w-full rounded-lg border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-contact-phone`} className="text-[10px] font-black text-[var(--foreground)]/60">
                  手机号
                </label>
                <input
                  id={`${baseId}-contact-phone`}
                  type="text"
                  value={contact.phone}
                  maxLength={characterPersonaMetaLimits.contact.phone.max}
                  onChange={(event) => handleContactChange("phone", event.target.value)}
                  placeholder="可选"
                  disabled={disabled}
                  className="w-full rounded-lg border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-contact-description`} className="text-[10px] font-black text-[var(--foreground)]/60">
                描述
              </label>
              <textarea
                id={`${baseId}-contact-description`}
                ref={descriptionRef}
                value={contact.description}
                maxLength={characterPersonaMetaLimits.contact.description.max}
                onChange={(event) => handleContactChange("description", event.target.value)}
                onInput={(event) => adjustTextareaHeight(event.currentTarget)}
                placeholder="简要描述这个角色的身份和特点"
                disabled={disabled}
                rows={1}
                style={{ overflow: "hidden" }}
                className="w-full resize-none rounded-lg border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-contact-greeting`} className="text-[10px] font-black text-[var(--foreground)]/60">
                开场白
              </label>
              <textarea
                id={`${baseId}-contact-greeting`}
                ref={greetingRef}
                value={contact.greeting}
                maxLength={characterPersonaMetaLimits.contact.greeting.max}
                onChange={(event) => handleContactChange("greeting", event.target.value)}
                onInput={(event) => adjustTextareaHeight(event.currentTarget)}
                placeholder="这个角色接到电话时会说什么"
                disabled={disabled}
                rows={1}
                style={{ overflow: "hidden" }}
                className="w-full resize-none rounded-lg border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-contact-note`} className="text-[10px] font-black text-[var(--foreground)]/60">
                备注
              </label>
              <textarea
                id={`${baseId}-contact-note`}
                value={contact.note}
                maxLength={characterPersonaMetaLimits.contact.note.max}
                onChange={(event) => handleContactChange("note", event.target.value)}
                placeholder="额外备注"
                disabled={disabled}
                rows={2}
                className="w-full resize-none rounded-lg border border-[var(--outline)]/20 bg-[var(--surface-container)] px-3 py-2 text-xs font-bold text-[var(--foreground)] placeholder:text-[var(--text-subtle)] transition focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>

          {buildError ? (
            <p className="rounded-xl border border-[#e59273] bg-[#ffe8dd] px-3.5 py-2 text-xs font-bold text-[#8a2a14]">
              {buildError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBuildFile}
              disabled={disabled || buildPending}
              className="rounded-full bg-[var(--button-primary)] px-4 py-2 text-xs font-black text-[var(--foreground)] shadow-sm transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buildPending ? "生成中…" : "生成角色人设文件"}
            </button>
            <button
              type="button"
              onClick={handleResetForm}
              disabled={disabled || buildPending}
              className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-xs font-black text-[var(--foreground)]/78 transition hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
