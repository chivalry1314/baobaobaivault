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
import { AuthCard } from "@/components/share/auth-card";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardDetailResponse, ExternalSessionUser } from "@/lib/shared";

const moodOptions = [
  { id: "sweet", label: "甜蜜", icon: HeartIcon },
  { id: "gentle", label: "温柔", icon: DropIcon },
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
    return "写下你想对 Ta 说的话，让这份心意成为卡片上的主角。";
  }

  return clean.length > 44 ? `${clean.slice(0, 44)}...` : clean;
}

function inferMoodTags(title: string, description: string) {
  const text = `${title} ${description}`;
  const tags: string[] = [];

  if (/[甜爱恋约浪漫喜欢]/.test(text)) {
    tags.push("sweet");
  }
  if (/[柔风光云陪伴治愈温暖]/.test(text)) {
    tags.push("gentle");
  }
  if (/[喜惊星梦愿心动]/.test(text)) {
    tags.push("surprise");
  }

  return tags.length > 0 ? Array.from(new Set(tags)) : ["sweet"];
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

    if (mode !== "edit") {
      setCardLoading(false);
      setLoadedCard(null);
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
      setLoadError("缺少卡片编号，暂时无法进入编辑页面。");
      setCardLoading(false);
      return () => {
        active = false;
      };
    }

    async function loadCard() {
      const editingCardId = cardId;
      if (!editingCardId) {
        setLoadError("缺少卡片编号，暂时无法进入编辑页面。");
        setCardLoading(false);
        return;
      }

      setCardLoading(true);
      setLoadError("");
      setFormError("");

      try {
        const detail = await shareApi.cardDetail(editingCardId);
        if (!active) {
          return;
        }

        if (!detail.canEdit) {
          setLoadedCard(null);
          setLoadError("这张卡片暂时不能在这里编辑。");
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
        setLoadError(getShareErrorMessage(error, "卡片内容加载失败，请稍后再试。"));
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
  }, [cardId, currentUser, mode]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const pageTitle = mode === "edit" ? "编辑卡片" : "创作中心";
  const pageDescription =
    mode === "edit" ? "在完整编辑页里调整标题、心语和发布状态。" : "发布你的浪漫瞬间，编织属于你们的故事。";
  const submitPrimaryLabel = mode === "edit" ? "保存并发布" : "发布浪漫瞬间";
  const submitSecondaryLabel = mode === "edit" ? "保存为草稿" : "保存草稿";
  const previewTitle = title.trim() || "给这份心意起个名字吧";
  const previewDescription = composeSearchableSummary(description);
  const previewTag = moodOptions.find((item) => item.id === selectedTags[0]) ?? moodOptions[0];
  const publishPending = submitMode !== null;
  const afterSuccessPath = mode === "edit" && cardId ? `/creator/cards/${encodeURIComponent(cardId)}/edit` : "/creator/new";

  const footer = useMemo(
    () => (
      <footer className="relative z-10 border-t border-white/60 bg-[rgba(255,248,248,0.72)] px-6 py-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="text-3xl font-semibold italic tracking-tight text-[var(--brand-strong)]">CardShare</div>

          <div className="text-sm tracking-[0.14em] text-[var(--brand)]/55">© 2024 CARDSHARE. HANDCRAFTED WITH SAKURA DREAMS.</div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm uppercase tracking-[0.12em] text-[var(--brand)]/48">
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              About Us
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Privacy Policy
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Terms Of Service
            </Link>
            <Link href="/discover" className="transition hover:text-[var(--brand-strong)]">
              Help Center
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
      return "仅支持 JPG、PNG、GIF 格式图片。";
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
      setFormError("请先填写卡片标题。");
      return;
    }

    if (mode === "create" && !file) {
      setFormError("请先上传一张卡片封面图片。");
      return;
    }

    if (mode === "edit" && !cardId) {
      setFormError("当前卡片编号无效，无法保存。");
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
          mode === "edit" ? "卡片保存失败，请稍后再试。" : "卡片创建失败，请稍后再试。",
        ),
      );
      setSubmitMode(null);
    }
  }

  async function handleDelete() {
    if (mode !== "edit" || !cardId) {
      return;
    }

    if (!window.confirm("确认删除这张卡片吗？删除后无法恢复。")) {
      return;
    }

    setSubmitMode("delete");
    setFormError("");

    try {
      await shareApi.deleteCard(cardId);
      router.push("/creator");
      router.refresh();
    } catch (error) {
      setFormError(getShareErrorMessage(error, "删除卡片失败，请稍后再试。"));
      setSubmitMode(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCard("published");
  }

  if (sessionChecking || (mode === "edit" && currentUser && cardLoading)) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/82 px-6 py-14 text-center text-[var(--foreground)]/72 shadow-[0_24px_64px_-42px_rgba(120,85,94,0.32)]">
          正在加载编辑页面...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
        <AuthCard afterSuccess={afterSuccessPath} />
      </div>
    );
  }

  if (mode === "edit" && loadError) {
    return (
      <AppShell currentPath="/creator" footerSlot={footer}>
        <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">{loadError}</p>
            <Link
              href="/creator"
              className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              返回我的创作
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/creator" footerSlot={footer}>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8f9_0%,#fff7f8_48%,#fff5f7_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-[rgba(255,210,221,0.35)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[rgba(237,215,240,0.26)] blur-[110px]" />
          <div className="absolute left-[20%] bottom-[12%] h-[26rem] w-[26rem] rounded-full bg-[rgba(255,231,236,0.32)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1520px] px-4 pb-16 pt-16 sm:px-6">
          {mode === "edit" ? (
            <div className="mb-6 flex justify-center sm:justify-start">
              <Link
                href="/creator"
                className="inline-flex rounded-full border border-[rgba(210,185,191,0.78)] bg-white/80 px-5 py-2.5 text-sm text-[var(--foreground)]/72 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                返回我的创作
              </Link>
            </div>
          ) : null}

          <div className="text-center">
            <SparklesIcon className="mx-auto h-12 w-12 text-[var(--primary)]/72" />
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">{pageTitle}</h1>
            <p className="mt-4 text-lg text-[var(--foreground)]/62">{pageDescription}</p>
          </div>

          {formError ? (
            <div className="mx-auto mt-8 max-w-5xl rounded-[24px] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">
              {formError}
            </div>
          ) : null}

          <form className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.8fr)]" onSubmit={handleSubmit}>
            <div className="space-y-8">
              <section className="rounded-[40px] border border-[rgba(241,193,207,0.72)] bg-[rgba(255,251,252,0.82)] p-6 shadow-[0_30px_70px_-50px_rgba(120,85,94,0.28)] sm:p-8">
                <div className="flex items-center gap-3 text-[1.1rem] font-medium text-[var(--foreground)]">
                  <ImageIcon className="h-6 w-6 text-[var(--primary)]" />
                  <span>{mode === "edit" ? "卡片封面" : "上传浪漫影像"}</span>
                </div>

                {mode === "create" ? (
                  <label
                    className={`mt-6 flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed bg-[rgba(255,248,249,0.86)] px-6 py-8 text-center transition ${
                      dragActive ? "border-[var(--primary)] bg-[rgba(255,240,244,0.92)]" : "border-[rgba(206,186,190,0.78)]"
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
                      <img src={previewUrl} alt="卡片预览" className="max-h-[320px] rounded-[24px] object-cover shadow-[0_20px_40px_-32px_rgba(120,85,94,0.45)]" />
                    ) : (
                      <>
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffdbe7_0%,#ffd0dc_100%)] text-[var(--primary)] shadow-[0_18px_40px_-28px_rgba(214,113,145,0.62)]">
                          <ImageAddIcon className="h-10 w-10" />
                        </div>
                        <p className="mt-8 text-[1.8rem] font-medium text-[var(--foreground)]">点击或拖拽图片到这里</p>
                        <p className="mt-3 text-xl text-[var(--foreground)]/58">支持 JPG、PNG、GIF，最大 10MB</p>
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
                  <div className="mt-6 min-h-[320px] rounded-[28px] border-2 border-dashed border-[rgba(206,186,190,0.78)] bg-[rgba(255,248,249,0.86)] px-6 py-8 text-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={previewTitle}
                        className="mx-auto max-h-[320px] rounded-[24px] object-cover shadow-[0_20px_40px_-32px_rgba(120,85,94,0.45)]"
                      />
                    ) : (
                      <>
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffdbe7_0%,#ffd0dc_100%)] text-[var(--primary)] shadow-[0_18px_40px_-28px_rgba(214,113,145,0.62)]">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                        <p className="mt-8 text-[1.8rem] font-medium text-[var(--foreground)]">当前卡片没有可预览的封面图片</p>
                      </>
                    )}
                    <p className="mt-6 text-base text-[var(--foreground)]/56">当前版本暂不支持在编辑页更换素材文件。</p>
                  </div>
                )}
              </section>

              <section className="rounded-[40px] border border-[rgba(241,193,207,0.72)] bg-[rgba(255,251,252,0.82)] p-6 shadow-[0_30px_70px_-50px_rgba(120,85,94,0.28)] sm:p-8">
                <div className="flex items-center gap-3 text-[1.1rem] font-medium text-[var(--foreground)]">
                  <EditIcon className="h-6 w-6 text-[var(--primary)]" />
                  <span>编辑心语</span>
                </div>

                <div className="mt-8">
                  <label className="block text-base text-[var(--foreground)]/72">标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="给这份心意起个名字吧..."
                    className="mt-3 w-full rounded-full border border-[rgba(210,185,191,0.78)] bg-white px-6 py-4 text-xl text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground)]/28 focus:border-[var(--primary)]"
                  />
                </div>

                <div className="mt-8">
                  <label className="block text-base text-[var(--foreground)]/72">正文</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={6}
                    placeholder="写下你想对 Ta 说的话..."
                    className="mt-3 w-full rounded-[28px] border border-[rgba(210,185,191,0.78)] bg-white px-6 py-5 text-lg leading-8 text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground)]/28 focus:border-[var(--primary)]"
                  />
                </div>

                <div className="mt-8">
                  <label className="block text-base text-[var(--foreground)]/72">心情标签</label>
                  <div className="mt-4 flex flex-wrap gap-3">
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
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-lg transition ${
                            active
                              ? "border-[rgba(236,180,197,0.86)] bg-[linear-gradient(135deg,#ffd5df_0%,#ffe9ef_100%)] text-[var(--foreground)]"
                              : "border-[rgba(210,185,191,0.78)] bg-white text-[var(--foreground)]/72"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span>{tag.label}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[rgba(210,185,191,0.78)] bg-white text-[var(--foreground)]/48 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section className="rounded-[40px] border border-[rgba(241,193,207,0.78)] bg-[rgba(255,251,252,0.84)] p-5 shadow-[0_30px_70px_-50px_rgba(120,85,94,0.28)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[1.1rem] font-medium text-[var(--foreground)]">实时预览</h2>
                  <EyeIcon className="h-6 w-6 text-[var(--foreground)]/24" />
                </div>

                <article className="mt-4 overflow-hidden rounded-[30px] bg-white shadow-[0_20px_40px_-34px_rgba(120,85,94,0.4)]">
                  <div className="relative h-[300px] overflow-hidden bg-[linear-gradient(135deg,#3b272d_0%,#5a4049_40%,#2e1c21_100%)]">
                    {previewUrl ? (
                      <img src={previewUrl} alt={previewTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-2xl text-white/76">等待封面图片...</div>
                    )}

                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_62%,rgba(40,24,29,0.12)_100%)]" />
                  </div>

                  <div className="px-6 py-6">
                    <h3 className="text-[2rem] font-semibold leading-tight text-[var(--foreground)]">{previewTitle}</h3>
                    <p className="mt-4 text-lg leading-8 text-[var(--foreground)]/72">{previewDescription}</p>

                    <div className="mt-5 flex items-center gap-2 text-base text-[var(--foreground)]/58">
                      <HeartIcon className="h-5 w-5 text-[var(--primary)]" />
                      <span>{previewTag.label}</span>
                      <span className="text-[var(--foreground)]/36">·</span>
                      <span>{getDisplayName(currentUser)}</span>
                    </div>
                  </div>
                </article>
              </section>

              <section className="rounded-[40px] border border-[rgba(241,193,207,0.78)] bg-[rgba(255,251,252,0.84)] p-5 shadow-[0_30px_70px_-50px_rgba(120,85,94,0.28)] sm:p-6">
                <label className="flex items-center gap-3 text-xl text-[var(--foreground)]/78">
                  <input
                    type="checkbox"
                    checked={publicChecked}
                    onChange={(event) => setPublicChecked(event.target.checked)}
                    className="h-7 w-7 rounded border-[rgba(210,185,191,0.78)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span>公开分享到广场</span>
                </label>

                <button
                  type="submit"
                  disabled={publishPending}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#7d5a73_0%,#8d6780_100%)] px-6 py-5 text-[1.9rem] font-semibold text-white shadow-[0_24px_40px_-26px_rgba(125,90,115,0.8)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowBurstIcon className="h-7 w-7" />
                  <span>
                    {submitMode === "published" ? (mode === "edit" ? "正在保存..." : "正在发布...") : submitPrimaryLabel}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={publishPending}
                  onClick={() => void submitCard("draft")}
                  className="mt-4 w-full rounded-full border border-[rgba(220,189,196,0.92)] bg-white px-6 py-5 text-[1.9rem] font-semibold text-[var(--foreground)]/72 transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitMode === "draft" ? "正在保存..." : submitSecondaryLabel}
                </button>

                {mode === "edit" && loadedCard ? (
                  <Link
                    href={`/creator/cards/${encodeURIComponent(loadedCard.card.id)}/access-code`}
                    className="mt-4 flex w-full items-center justify-center rounded-full border border-[rgba(236,180,197,0.92)] bg-[rgba(255,244,246,0.92)] px-6 py-4 text-lg font-semibold text-[var(--brand-strong)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-white"
                  >
                    提取码管理
                  </Link>
                ) : null}

                {mode === "edit" ? (
                  <button
                    type="button"
                    disabled={publishPending}
                    onClick={() => void handleDelete()}
                    className="mt-4 w-full rounded-full border border-[#efb8c8] bg-[rgba(255,244,246,0.9)] px-6 py-4 text-lg font-semibold text-[#9d3656] transition hover:border-[#c45a7d] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitMode === "delete" ? "正在删除..." : "删除这张卡片"}
                  </button>
                ) : null}

                {mode === "edit" && loadedCard ? (
                  <div className="mt-6 rounded-[24px] bg-[rgba(255,244,246,0.78)] px-5 py-4 text-sm leading-7 text-[var(--foreground)]/58">
                    卡片编号：{loadedCard.card.id}
                    <br />
                    当前状态：{loadedCard.card.status === "draft" ? "草稿" : loadedCard.card.status === "published" ? "已发布" : "已归档"}
                  </div>
                ) : null}
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

function ArrowBurstIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5.25 7.5h13.5L12 18.75 5.25 7.5Z" fill="currentColor" />
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

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M11.25 5.25h1.5v5.25h5.25v1.5h-5.25v5.25h-1.5V12h-5.25v-1.5h5.25V5.25Z" fill="currentColor" />
    </svg>
  );
}
