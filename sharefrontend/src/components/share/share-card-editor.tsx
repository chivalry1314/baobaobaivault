"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardDetailResponse, ExternalSessionUser } from "@/lib/shared";

const moodOptions = [
  { id: "sweet", label: "甜系", icon: HeartIcon },
  { id: "gentle", label: "柔和", icon: DropIcon },
  { id: "surprise", label: "惊喜", icon: StarIcon },
] as const;

type EditorMode = "create" | "edit";

type ShareCardEditorProps = {
  mode: EditorMode;
  cardId?: string;
};

function getDisplayName(user: ExternalSessionUser) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const username = user.username.trim();
  if (username) {
    return username;
  }

  return user.email.split("@")[0]?.trim() || "Card Share";
}

function composeSearchableSummary(text: string) {
  const clean = text.trim();
  if (!clean) {
    return "这是一张等待你补充故事的卡片，写下灵感后它会更完整。";
  }
  return clean.length > 44 ? `${clean.slice(0, 44)}...` : clean;
}

function inferMoodTags(title: string, description: string) {
  const text = `${title} ${description}`;
  const tags: string[] = [];

  if (/[甜暖爱花软萌]/.test(text)) {
    tags.push("sweet");
  }
  if (/[静柔雾夜慢淡温]/.test(text)) {
    tags.push("gentle");
  }
  if (/[星惊梦潮闪耀]/.test(text)) {
    tags.push("surprise");
  }

  return tags.length > 0 ? Array.from(new Set(tags)) : ["sweet"];
}

function getStatusLabel(status: CardDetailResponse["card"]["status"]) {
  if (status === "published") {
    return "已发布";
  }
  if (status === "draft") {
    return "草稿";
  }
  return "已归档";
}

export function ShareCardEditor({ mode, cardId }: ShareCardEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessionChecking, setSessionChecking] = useState(true);
  const [cardLoading, setCardLoading] = useState(mode === "edit");
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [loadedCard, setLoadedCard] = useState<CardDetailResponse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["sweet"]);
  const [publicChecked, setPublicChecked] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitMode, setSubmitMode] = useState<"published" | "draft" | "delete" | null>(null);
  const isEditMode = mode === "edit";

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await shareApi.session();
        if (!active) {
          return;
        }

        if (!session.authenticated || !session.user) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser(session.user);
      } catch {
        if (active) {
          setCurrentUser(null);
        }
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!isEditMode) {
      return () => {
        active = false;
      };
    }

    if (!currentUser) {
      return () => {
        active = false;
      };
    }

    if (!cardId) {
      return () => {
        active = false;
      };
    }
    const targetCardId = cardId;

    async function loadCard() {
      setCardLoading(true);
      setLoadError("");
      setFormError("");

      try {
        const detail = await shareApi.cardDetail(targetCardId);
        if (!active) {
          return;
        }

        if (!detail.canEdit) {
          setLoadedCard(null);
          setLoadError("你没有该卡片的编辑权限。");
          return;
        }

        setLoadedCard(detail);
        setTitle(detail.card.title);
        setDescription(detail.card.description);
        setPublicChecked(detail.card.visibility === "public");
        setPreviewUrl(detail.card.previewUrl);
        setFile(null);
        setSelectedTags(inferMoodTags(detail.card.title, detail.card.description));
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadedCard(null);
        setLoadError(getShareErrorMessage(error, "加载卡片信息失败，请稍后重试。"));
      } finally {
        if (active) {
          setCardLoading(false);
        }
      }
    }

    void loadCard();

    return () => {
      active = false;
    };
  }, [cardId, currentUser, isEditMode]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const pageTitle = mode === "edit" ? "编辑卡片" : "创建卡片";
  const pageDescription =
    mode === "edit"
      ? "更新标题、描述和可见性，让卡片内容与分享节奏保持一致。"
      : "上传封面并写下卡片故事，发布后即可用于访问码分享。";
  const submitPrimaryLabel = mode === "edit" ? "保存并发布" : "创建并发布";
  const submitSecondaryLabel = mode === "edit" ? "保存为草稿" : "创建草稿";
  const previewTitle = title.trim() || "请输入卡片标题";
  const previewDescription = composeSearchableSummary(description);
  const previewTag = moodOptions.find((item) => item.id === selectedTags[0]) ?? moodOptions[0];
  const publishPending = submitMode !== null;
  const afterSuccessPath = mode === "edit" && cardId ? `/creator/cards/${encodeURIComponent(cardId)}/edit` : "/creator";

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t border-white/60 bg-[rgba(255,248,248,0.72)] px-6 py-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="text-3xl font-semibold italic tracking-tight text-[var(--brand-strong)]">CardShare</div>
          <div className="text-sm tracking-[0.14em] text-[color-mix(in_srgb,var(--brand)_28%,var(--foreground))]">© 2026 CARDSHARE. DREAMY STYLE.</div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm uppercase tracking-[0.12em] text-[var(--brand)]/48">
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              About
            </Link>
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              Privacy
            </Link>
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              Terms
            </Link>
            <Link href="/" className="transition hover:text-[var(--brand-strong)]">
              Help
            </Link>
          </div>
        </div>
      </footer>
    ),
    [],
  );

  function validateFile(nextFile: File) {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/gif"]);
    if (!allowedTypes.has(nextFile.type)) {
      return "仅支持 JPG、PNG、GIF 图片格式。";
    }

    if (nextFile.size > 10 * 1024 * 1024) {
      return "图片大小不能超过 10MB。";
    }

    return "";
  }

  function applyFile(nextFile: File) {
    const validationError = validateFile(nextFile);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setFormError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) {
      return;
    }

    applyFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    if (mode !== "create") {
      return;
    }

    event.preventDefault();
    setDragActive(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (!nextFile) {
      return;
    }

    applyFile(nextFile);
  }

  async function submitCard(status: "published" | "draft") {
    if (!title.trim()) {
      setFormError("请输入卡片标题。");
      return;
    }

    if (mode === "create" && !file) {
      setFormError("创建卡片时请先上传图片。");
      return;
    }

    if (mode === "edit" && !cardId) {
      setFormError("缺少卡片 ID，无法保存。");
      return;
    }

    setSubmitMode(status);
    setFormError("");

    try {
      if (mode === "create" && file) {
        await shareApi.createCard({
          title: title.trim(),
          description: description.trim(),
          visibility: publicChecked ? "public" : "private",
          status,
          file,
        });
      } else if (mode === "edit" && cardId) {
        await shareApi.updateCard(cardId, {
          title: title.trim(),
          description: description.trim(),
          visibility: publicChecked ? "public" : "private",
          status,
        });
      }

      router.push("/creator");
      router.refresh();
    } catch (error) {
      setFormError(
        getShareErrorMessage(
          error,
          mode === "edit" ? "更新卡片失败，请稍后重试。" : "创建卡片失败，请稍后重试。",
        ),
      );
      setSubmitMode(null);
    }
  }

  async function handleDelete() {
    if (mode !== "edit" || !cardId) {
      return;
    }

    if (!window.confirm("确认删除这张卡片吗？删除后将无法恢复。")) {
      return;
    }

    setSubmitMode("delete");
    setFormError("");

    try {
      await shareApi.deleteCard(cardId);
      router.push("/creator");
      router.refresh();
    } catch (error) {
      setFormError(getShareErrorMessage(error, "删除卡片失败，请稍后重试。"));
      setSubmitMode(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCard("published");
  }

  if (sessionChecking || (mode === "edit" && currentUser && cardLoading)) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          正在加载编辑器...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessPath} />;
  }

  if (mode === "edit" && loadError) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">{loadError}</p>
            <Link
              href="/creator"
              className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[rgba(203,234,249,0.3)] blur-[110px]" />
          <div className="absolute left-[20%] bottom-[12%] h-[26rem] w-[26rem] rounded-full bg-[rgba(248,219,230,0.22)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1200px] px-4 pb-16 pt-10">
          {mode === "edit" ? (
            <div className="mb-6 flex justify-start">
              <Link
                href="/creator"
                className="btn-subtle inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none"
              >
                <BackIcon className="h-4 w-4" />
                返回创作中心
              </Link>
            </div>
          ) : null}

          <div className="mb-10 text-center">
            <SparklesIcon className="mx-auto h-7 w-7 text-[var(--primary)]/80" />
            <h1 className="mt-3 text-[2rem] font-black tracking-tight text-[var(--foreground)] sm:text-4xl">{pageTitle}</h1>
            <p className="mt-3 text-sm font-bold text-[var(--foreground)]/62">{pageDescription}</p>
          </div>

          {formError ? (
            <div className="mb-6 rounded-[20px] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">
              {formError}
            </div>
          ) : null}

          <form className="flex flex-col gap-6 lg:flex-row lg:items-start" onSubmit={handleSubmit}>
            <div className="w-full space-y-6 lg:w-[55%]">
              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <div className="mb-6 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[var(--text-subtle)]" />
                  <h2 className="text-sm font-black text-[var(--foreground)]">{mode === "edit" ? "封面预览" : "上传封面图"}</h2>
                </div>

                {mode === "create" ? (
                  <label
                    className={`flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                      dragActive ? "border-[var(--primary)] bg-[#eef8ff]" : "border-[var(--line-strong)]/30 bg-[#f8f9fa]"
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={handleDrop}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="卡片预览" className="max-h-[320px] rounded-xl border-[3px] border-[var(--line-strong)] object-cover shadow-[2px_2px_0px_var(--line-strong)]" />
                    ) : (
                      <>
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border-[3px] border-[var(--line-strong)] bg-[var(--button-primary)] text-[var(--foreground)]">
                          <ImageAddIcon className="h-8 w-8" />
                        </div>
                        <p className="mt-6 text-xl font-black text-[var(--foreground)]">拖拽图片到这里，或点击上传</p>
                        <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">支持 JPG、PNG、GIF，最大 10MB</p>
                      </>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line-strong)]/30 bg-[#f8f9fa] px-6 py-8 text-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={previewTitle}
                        className="max-h-[320px] rounded-xl border-[3px] border-[var(--line-strong)] object-cover shadow-[2px_2px_0px_var(--line-strong)]"
                      />
                    ) : (
                      <div className="text-sm font-bold text-[var(--text-muted)]">当前卡片无封面</div>
                    )}
                    <p className="mt-5 text-xs font-bold text-[var(--text-subtle)]">编辑模式暂不支持更换文件，后续可扩展。</p>
                  </div>
                )}
              </section>

              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <div className="mb-6 flex items-center gap-2">
                  <EditIcon className="h-4 w-4 text-[var(--text-subtle)]" />
                  <h2 className="text-sm font-black text-[var(--foreground)]">卡片信息</h2>
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-xs font-black text-[var(--foreground)]/70">标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="输入卡片标题..."
                    className="w-full rounded-full border-[2px] border-[var(--line-strong)] bg-white px-4 py-3 font-bold text-[var(--foreground)] transition focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-xs font-black text-[var(--foreground)]/70">描述</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={6}
                    placeholder="补充卡片故事、来源或使用说明..."
                    className="w-full resize-y rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-4 py-3 font-bold leading-7 text-[var(--foreground)] transition focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black text-[var(--foreground)]/70">情绪标签</label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {moodOptions.map((tag) => {
                      const active = selectedTags.includes(tag.id);
                      const Icon = tag.icon;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTags((current) =>
                              current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id],
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black transition ${
                            active
                              ? "border-[var(--line-strong)] bg-[var(--button-rose)] text-[var(--foreground)] shadow-[2px_2px_0px_var(--line-strong)]"
                              : "border-[var(--line-strong)] bg-white text-[var(--foreground)]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{tag.label}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[var(--line-strong)]/40 text-[var(--foreground)]/60 transition hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="w-full space-y-6 lg:w-[45%]">
              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-black text-[var(--foreground)]">实时预览</h2>
                  <EyeIcon className="h-4 w-4 text-[var(--text-subtle)]" />
                </div>

                <div className="overflow-hidden rounded-[24px] border-[3px] border-[var(--line-strong)] bg-white shadow-[4px_4px_0px_var(--line-strong)]">
                  <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#3b272d_0%,#5a4049_40%,#2e1c21_100%)]">
                    {previewUrl ? (
                      <img src={previewUrl} alt={previewTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-white/76">等待上传封面...</div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-xl font-black text-[var(--foreground)]">{previewTitle}</h3>
                    <p className="mt-2 text-xs font-bold leading-relaxed text-[var(--foreground)]/60">{previewDescription}</p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
                      <HeartIcon className="h-3 w-3 text-[var(--primary)]" />
                      <span>{previewTag.label}</span>
                      <span>·</span>
                      <span>{getDisplayName(currentUser)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <label className="mb-6 flex w-fit cursor-pointer items-center gap-3">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded border-[2px] border-[var(--line-strong)] ${publicChecked ? "bg-[var(--button-primary)] text-[var(--foreground)]" : "bg-white text-transparent"}`}>
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    公开可见 <span className="text-[var(--foreground)]/60">（可在首页展示）</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={publicChecked}
                    onChange={(event) => setPublicChecked(event.target.checked)}
                    className="hidden"
                  />
                </label>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={publishPending}
                    className="btn-primary w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitMode === "published" ? "提交中..." : submitPrimaryLabel}
                  </button>
                  <button
                    type="button"
                    disabled={publishPending}
                    onClick={() => void submitCard("draft")}
                    className="btn-subtle w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitMode === "draft" ? "提交中..." : submitSecondaryLabel}
                  </button>
                  {mode === "edit" && loadedCard ? (
                    <Link
                      href={`/creator/cards/${encodeURIComponent(loadedCard.card.id)}/access-code`}
                      className="btn-rose block w-full rounded-full py-3 text-center text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] transition hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none"
                    >
                      配置访问码
                    </Link>
                  ) : null}
                  {mode === "edit" ? (
                    <button
                      type="button"
                      disabled={publishPending}
                      onClick={() => void handleDelete()}
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
                  </div>
                ) : (
                  <div className="mt-6 space-y-1 text-[10px] font-bold text-[var(--text-subtle)]">
                    <p>创建后可在「访问码配置」中继续设置分享规则。</p>
                    <p>建议先发布，再根据需要调整为草稿或私密。</p>
                  </div>
                )}
              </section>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function SparklesIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m12 2 1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Zm7 9 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4ZM6 14l1.2 2.8L10 18l-2.8 1.2L6 22l-1.2-2.8L2 18l2.8-1.2L6 14Z" fill="currentColor" />
    </svg>
  );
}

function BackIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m13.47 5.47 1.06 1.06-4.47 4.47h9.44v1.5h-9.44l4.47 4.47-1.06 1.06-6.28-6.28 6.28-6.28Z" fill="currentColor" />
    </svg>
  );
}

function ImageIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 5.25h15A2.25 2.25 0 0 1 21.75 7.5v9A2.25 2.25 0 0 1 19.5 18.75h-15A2.25 2.25 0 0 1 2.25 16.5v-9A2.25 2.25 0 0 1 4.5 5.25Zm0 1.5a.75.75 0 0 0-.75.75v9c0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75h-15Zm2.9 8.9 2.9-3.53a.75.75 0 0 1 1.16.02l2.15 2.67 1.58-1.78a.75.75 0 0 1 1.13.01l2.18 2.61v.6H5.52l1.88-.6Zm2.1-5.03a1.13 1.13 0 1 0 0-2.25 1.13 1.13 0 0 0 0 2.25Z" fill="currentColor" />
    </svg>
  );
}

function ImageAddIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4.5 4.5h10.5A2.25 2.25 0 0 1 17.25 6.75v10.5A2.25 2.25 0 0 1 15 19.5H4.5A2.25 2.25 0 0 1 2.25 17.25V6.75A2.25 2.25 0 0 1 4.5 4.5Zm0 1.5a.75.75 0 0 0-.75.75v10.5c0 .41.34.75.75.75H15a.75.75 0 0 0 .75-.75V6.75A.75.75 0 0 0 15 6H4.5Zm2.98 8.78 2.14-2.56a.75.75 0 0 1 1.15.02l1.56 1.94 1.18-1.34a.75.75 0 0 1 1.13.02l1.42 1.7v1.19H6.03l1.45-.97Zm2.02-5.03a1.13 1.13 0 1 0 0-2.25 1.13 1.13 0 0 0 0 2.25Zm10.5-3.75h1.5v2.25h2.25v1.5H21.5V12h-1.5V9.75h-2.25v-1.5H20V6Z" fill="currentColor" />
    </svg>
  );
}

function EditIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m16.58 3.72 3.7 3.7-9.75 9.75-4.42.72.72-4.42 9.75-9.75Zm.98-1.06a1.5 1.5 0 0 0-2.12 0L5.34 12.76a1.5 1.5 0 0 0-.4.76l-.97 5.97a.75.75 0 0 0 .86.86l5.97-.97a1.5 1.5 0 0 0 .76-.4L21.66 8.88a1.5 1.5 0 0 0 0-2.12l-4.1-4.1Z" fill="currentColor" />
    </svg>
  );
}

function EyeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 5.25c4.35 0 8.13 2.63 9.75 6.75-1.62 4.12-5.4 6.75-9.75 6.75S3.87 16.12 2.25 12C3.87 7.88 7.65 5.25 12 5.25Zm0 1.5A8.98 8.98 0 0 0 3.88 12 8.98 8.98 0 0 0 12 17.25 8.98 8.98 0 0 0 20.12 12 8.98 8.98 0 0 0 12 6.75Zm0 2.25a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m9.55 16.2-3.75-3.75 1.06-1.06 2.69 2.69 7.59-7.58 1.06 1.06-8.65 8.64Z" fill="currentColor" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 20.3 4.94 13.6a4.67 4.67 0 0 1 6.6-6.6L12 7.45l.46-.45a4.67 4.67 0 0 1 6.6 6.6L12 20.3Z" fill="currentColor" />
    </svg>
  );
}

function DropIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 2.25c2.93 3.1 6 6.7 6 10.5a6 6 0 1 1-12 0c0-3.8 3.07-7.4 6-10.5Z" fill="currentColor" />
    </svg>
  );
}

function StarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m12 2.75 2.4 4.86 5.37.78-3.88 3.78.92 5.35L12 14.97 7.19 17.5l.92-5.35L4.23 8.39l5.37-.78L12 2.75Z" fill="currentColor" />
    </svg>
  );
}
