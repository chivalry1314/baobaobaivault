"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { AppShell } from "@/components/share/app-shell";
import { AuthRedirect } from "@/components/share/auth-redirect";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type { CardAsset, CardContentSlot, CardDetailResponse, ExternalSessionUser, ShareReviewStatus } from "@/lib/shared";

const slotOptions: Array<{ value: CardContentSlot; label: string }> = [
  { value: "system_theme", label: "系统主题" },
  { value: "wechat_theme", label: "微信主题" },
  { value: "app", label: "App" },
  { value: "character_persona", label: "角色人设" },
  { value: "world_book", label: "世界书" },
];

const slotLabelMap: Record<CardContentSlot, string> = {
  system_theme: "系统主题",
  wechat_theme: "微信主题",
  app: "App",
  character_persona: "角色人设",
  world_book: "世界书",
};

type EditorMode = "create" | "edit";
type CreateMode = "single" | "bundle";
type AssetOpMode = "replace" | "remove";

type ShareCardEditorProps = {
  mode: EditorMode;
  cardId?: string;
};

type SlotFileItem = {
  slot: CardContentSlot;
  file: File | null;
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
    return "这是一张等待补充内容的卡片，完善描述后会更完整。";
  }
  return clean.length > 80 ? `${clean.slice(0, 80)}...` : clean;
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

function getReviewStatusLabel(status: ShareReviewStatus) {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "未提交审核";
  }
}

function createEmptySlotItem(index: number): SlotFileItem {
  return {
    slot: slotOptions[index % slotOptions.length].value,
    file: null,
  };
}

function isImageMime(file: File | null) {
  return Boolean(file && file.type.startsWith("image/"));
}

function findDuplicateSlots(items: SlotFileItem[]) {
  const map = new Map<CardContentSlot, number>();
  for (const item of items) {
    map.set(item.slot, (map.get(item.slot) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .filter(([, count]) => count > 1)
    .map(([slot]) => slot);
}

function getSlotLabel(slot: CardContentSlot) {
  return slotLabelMap[slot] ?? slot;
}

function findAssetBySlot(assets: CardAsset[], slot: CardContentSlot) {
  return assets.find((asset) => asset.slot === slot) ?? null;
}

function isCreatorRole(user: ExternalSessionUser | null) {
  if (!user) {
    return false;
  }
  return user.role === "creator" || user.role === "manager";
}

export function ShareCardEditor({ mode, cardId }: ShareCardEditorProps) {
  const router = useRouter();
  const createCoverInputRef = useRef<HTMLInputElement>(null);

  const [sessionChecking, setSessionChecking] = useState(true);
  const [cardLoading, setCardLoading] = useState(mode === "edit");
  const [currentUser, setCurrentUser] = useState<ExternalSessionUser | null>(null);
  const [loadedCard, setLoadedCard] = useState<CardDetailResponse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicChecked, setPublicChecked] = useState(true);
  const [createMode, setCreateMode] = useState<CreateMode>("single");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [slotItems, setSlotItems] = useState<SlotFileItem[]>([createEmptySlotItem(0)]);

  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitMode, setSubmitMode] = useState<"published" | "draft" | "delete" | null>(null);
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);
  const [coverPending, setCoverPending] = useState<"replace" | "remove" | null>(null);
  const [assetPending, setAssetPending] = useState<Record<CardContentSlot, AssetOpMode | null>>({
    system_theme: null,
    wechat_theme: null,
    app: null,
    character_persona: null,
    world_book: null,
  });

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
    if (!currentUser || !cardId) {
      return () => {
        active = false;
      };
    }

    async function loadCard() {
      setCardLoading(true);
      setLoadError("");
      setFormError("");

      try {
        const currentCardId = cardId;
        if (!currentCardId) {
          setLoadError("缺少卡片 ID。");
          return;
        }
        const detail = await shareApi.cardDetail(currentCardId);
        if (!active) {
          return;
        }
        if (!detail.canEdit) {
          setLoadedCard(null);
          setLoadError("你没有这张卡片的编辑权限。");
          return;
        }

        setLoadedCard(detail);
        setTitle(detail.card.title);
        setDescription(detail.card.description);
        setPublicChecked(detail.card.visibility === "public");
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

  const pageTitle = mode === "edit" ? "编辑卡片" : "创建卡片";
  const pageDescription =
    mode === "edit"
      ? "更新标题、描述和可见性，维护卡片基础信息。"
      : "封面图用于浏览，分类文件用于下载。支持单分类或多分类打包创建。";

  const submitPrimaryLabel = mode === "edit" ? "保存并发布" : "创建并发布";
  const submitSecondaryLabel = mode === "edit" ? "保存为草稿" : "创建草稿";
  const previewTitle = title.trim() || "请输入卡片标题";
  const previewDescription = composeSearchableSummary(description);
  const publishPending = submitMode !== null;
  const hasCoverOnCard = Boolean(loadedCard?.card.previewUrl?.includes("/cover/"));
  const hasAssetPending = coverPending !== null || Object.values(assetPending).some((value) => value !== null);
  const afterSuccessPath = mode === "edit" && cardId ? `/creator/cards/${encodeURIComponent(cardId)}/edit` : "/creator";
  const isCreator = isCreatorRole(currentUser);
  const reviewStatus = loadedCard?.card.reviewStatus ?? "unsubmitted";
  const canSubmitReview = Boolean(
    isEditMode && cardId && loadedCard && !publishPending && !hasAssetPending && !reviewSubmitPending && reviewStatus !== "pending",
  );

  const coverPreviewUrl = useMemo(() => {
    if (!coverFile) {
      return "";
    }
    return URL.createObjectURL(coverFile);
  }, [coverFile]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const previewImageFile = useMemo(() => {
    if (mode === "edit") {
      return null;
    }
    if (isImageMime(coverFile)) {
      return coverFile;
    }
    for (const item of slotItems) {
      if (isImageMime(item.file)) {
        return item.file;
      }
    }
    return null;
  }, [coverFile, mode, slotItems]);

  const previewUrl = useMemo(() => {
    if (mode === "edit") {
      return loadedCard?.card.previewUrl ?? "";
    }
    if (!previewImageFile) {
      return "";
    }
    return URL.createObjectURL(previewImageFile);
  }, [loadedCard?.card.previewUrl, mode, previewImageFile]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function setSlotFile(index: number, file: File | null) {
    setSlotItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], file };
      return next;
    });
  }

  function setSlotValue(index: number, slot: CardContentSlot) {
    setSlotItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], slot };
      return next;
    });
  }

  function addSlotRow() {
    setSlotItems((current) => {
      if (current.length >= slotOptions.length) {
        return current;
      }
      return [...current, createEmptySlotItem(current.length)];
    });
  }

  function removeSlotRow(index: number) {
    setSlotItems((current) => {
      if (current.length <= 1) {
        return current;
      }
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  }

  function handleCreateCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormError("卡片封面仅支持图片文件。");
      return;
    }
    setFormError("");
    setCoverFile(file);
  }

  function clearCreateCover() {
    setCoverFile(null);
  }

  function validateCreateInputs() {
    if (!title.trim()) {
      return "请输入卡片标题。";
    }

    const effectiveItems = createMode === "single" ? slotItems.slice(0, 1) : slotItems;
    if (effectiveItems.length === 0) {
      return "请至少添加一个分类文件。";
    }

    const duplicateSlots = findDuplicateSlots(effectiveItems);
    if (duplicateSlots.length > 0) {
      return "同一张卡片内分类不能重复。";
    }

    if (effectiveItems.some((item) => !item.file)) {
      return "请为每个分类选择文件。";
    }

    return "";
  }

  async function submitCard(status: "published" | "draft") {
    if (mode === "edit") {
      if (!cardId) {
        setFormError("缺少卡片 ID，无法保存。");
        return;
      }
      if (!title.trim()) {
        setFormError("请输入卡片标题。");
        return;
      }

      setSubmitMode(status);
      setFormError("");

      try {
        const payload = await shareApi.updateCard(cardId, {
          title: title.trim(),
          description: description.trim(),
          visibility: publicChecked ? "public" : "private",
          status,
        });
        setLoadedCard((current) =>
          current
            ? {
                ...current,
                card: payload.card,
              }
            : current,
        );
        router.push("/creator");
        router.refresh();
      } catch (error) {
        setFormError(getShareErrorMessage(error, "更新卡片失败，请稍后重试。"));
      } finally {
        setSubmitMode(null);
      }
      return;
    }

    const validationError = validateCreateInputs();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const effectiveItems = (createMode === "single" ? slotItems.slice(0, 1) : slotItems).filter(
      (item): item is { slot: CardContentSlot; file: File } => Boolean(item.file),
    );

    setSubmitMode(status);
    setFormError("");

    try {
      await shareApi.createCardBundle({
        title: title.trim(),
        description: description.trim(),
        visibility: publicChecked ? "public" : "private",
        status,
        cover: coverFile ?? undefined,
        items: effectiveItems,
      });
      router.push("/creator");
      router.refresh();
    } catch (error) {
      setFormError(getShareErrorMessage(error, "创建卡片失败，请稍后重试。"));
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleSubmitReview() {
    if (!cardId || !canSubmitReview) {
      return;
    }
    setReviewSubmitPending(true);
    setFormError("");
    try {
      const payload = await shareApi.submitCardReview(cardId);
      setLoadedCard((current) =>
        current
          ? {
              ...current,
              card: payload.card,
            }
          : current,
      );
    } catch (error) {
      setFormError(getShareErrorMessage(error, "提交审核失败，请稍后重试。"));
    } finally {
      setReviewSubmitPending(false);
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
    } finally {
      setSubmitMode(null);
    }
  }

  async function handleReplaceCover(file: File | null) {
    if (!cardId || !file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormError("封面图仅支持图片文件。");
      return;
    }

    setCoverPending("replace");
    setFormError("");
    try {
      const payload = await shareApi.replaceCardCover(cardId, file);
      setLoadedCard((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          card: payload.card,
          assets: payload.assets,
        };
      });
    } catch (error) {
      setFormError(getShareErrorMessage(error, "替换封面图失败，请稍后重试。"));
    } finally {
      setCoverPending(null);
    }
  }

  async function handleDeleteCover() {
    if (!cardId || !loadedCard || !hasCoverOnCard) {
      return;
    }
    if (!window.confirm("确认删除当前封面图吗？删除后将回退为分类文件预览。")) {
      return;
    }

    setCoverPending("remove");
    setFormError("");
    try {
      const payload = await shareApi.deleteCardCover(cardId);
      setLoadedCard((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          card: payload.card,
          assets: payload.assets,
        };
      });
    } catch (error) {
      setFormError(getShareErrorMessage(error, "删除封面图失败，请稍后重试。"));
    } finally {
      setCoverPending(null);
    }
  }

  async function handleReplaceAsset(slot: CardContentSlot, file: File | null) {
    if (!cardId || !file) {
      return;
    }

    setAssetPending((current) => ({ ...current, [slot]: "replace" }));
    setFormError("");

    try {
      const payload = await shareApi.replaceCardAsset(cardId, slot, file);
      setLoadedCard((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          card: payload.card,
          assets: payload.assets,
        };
      });
    } catch (error) {
      setFormError(getShareErrorMessage(error, "替换分类文件失败，请稍后重试。"));
    } finally {
      setAssetPending((current) => ({ ...current, [slot]: null }));
    }
  }

  async function handleDeleteAsset(slot: CardContentSlot) {
    if (!cardId || !loadedCard) {
      return;
    }
    const existing = findAssetBySlot(loadedCard.assets, slot);
    if (!existing) {
      return;
    }
    if (!window.confirm(`确认删除分类「${getSlotLabel(slot)}」文件吗？删除后将无法恢复。`)) {
      return;
    }

    setAssetPending((current) => ({ ...current, [slot]: "remove" }));
    setFormError("");
    try {
      const payload = await shareApi.deleteCardAsset(cardId, slot);
      setLoadedCard((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          card: payload.card,
          assets: payload.assets,
        };
      });
    } catch (error) {
      setFormError(getShareErrorMessage(error, "删除分类文件失败，请稍后重试。"));
    } finally {
      setAssetPending((current) => ({ ...current, [slot]: null }));
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
          正在加载编辑页...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthRedirect nextPath={afterSuccessPath} />;
  }

  if (!isCreator) {
    return (
      <AppShell currentPath="/creator">
        <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">当前账号没有创作权限，无法创建或编辑卡片。</p>
            <Link href="/creator" className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5">
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (mode === "edit" && loadError) {
    return (
      <AppShell currentPath="/creator">
        <div className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-[#f3c8ad] bg-[#fff4ec] px-6 py-10 text-center shadow-[0_24px_64px_-42px_rgba(120,85,94,0.22)]">
            <p className="text-xl font-semibold text-[#9a3412]">{loadError}</p>
            <Link href="/creator" className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5">
              返回创作中心
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/creator">
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#f4fbff_0%,#f8fdff_48%,#f2faff_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[4%] h-[28rem] w-[28rem] rounded-full bg-[rgba(176,232,249,0.38)] blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[rgba(203,234,249,0.3)] blur-[110px]" />
          <div className="absolute left-[20%] bottom-[12%] h-[26rem] w-[26rem] rounded-full bg-[rgba(248,219,230,0.22)] blur-[120px]" />
        </div>

        <section className="relative z-10 mx-auto max-w-[1200px] px-4 pb-16 pt-10">
          {mode === "edit" ? (
            <div className="mb-6 flex justify-start">
              <Link href="/creator" className="btn-subtle inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none">
                返回创作中心
              </Link>
            </div>
          ) : null}

          <div className="mb-10 text-center">
            <h1 className="mt-3 text-[2rem] font-black tracking-tight text-[var(--foreground)] sm:text-4xl">{pageTitle}</h1>
            <p className="mt-3 text-sm font-bold text-[var(--foreground)]/62">{pageDescription}</p>
          </div>

          {formError ? (
            <div className="mb-6 rounded-[20px] border border-[#f3c8ad] bg-[#fff4ec] px-4 py-3 text-sm text-[#9a3412]">{formError}</div>
          ) : null}

          <form className="flex flex-col gap-6 lg:flex-row lg:items-start" onSubmit={handleSubmit}>
            <div className="w-full space-y-6 lg:w-[55%]">
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
                        <button
                          type="button"
                          className="btn-subtle rounded-full px-4 py-2 text-xs font-black"
                          onClick={() => createCoverInputRef.current?.click()}
                        >
                          {coverPreviewUrl ? "替换封面图" : "上传封面图"}
                        </button>
                        {coverPreviewUrl ? (
                          <button
                            type="button"
                            className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-4 py-2 text-xs font-black text-[#ff6b6b]"
                            onClick={clearCreateCover}
                          >
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
                          setSlotItems((current) => [current[0] ?? createEmptySlotItem(0)]);
                        }}
                      >
                        单分类
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border-[2px] px-4 py-2 text-sm font-black ${createMode === "bundle" ? "bg-[var(--button-primary)]" : "bg-white"}`}
                        onClick={() => {
                          setCreateMode("bundle");
                          setSlotItems((current) => (current.length > 0 ? current : [createEmptySlotItem(0)]));
                        }}
                      >
                        多分类打包
                      </button>
                    </div>

                    {slotItems.map((item, index) => (
                      <div key={`${item.slot}-${index}`} className="rounded-xl border-[2px] border-[var(--line-strong)]/30 bg-[#f8f9fa] p-4">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                          <select
                            className="rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-bold"
                            value={item.slot}
                            onChange={(event) => setSlotValue(index, event.target.value as CardContentSlot)}
                          >
                            {slotOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <input
                            type="file"
                            className="rounded-xl border-[2px] border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-bold"
                            onChange={(event) => setSlotFile(index, event.target.files?.[0] ?? null)}
                          />

                          {createMode === "bundle" ? (
                            <button
                              type="button"
                              className="rounded-full border-[2px] border-[#ff9c9c] bg-[#fce4e4] px-3 py-2 text-xs font-black text-[#ff6b6b]"
                              onClick={() => removeSlotRow(index)}
                              disabled={slotItems.length <= 1}
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-subtle)]">{item.file ? item.file.name : "未选择文件"}</p>
                      </div>
                    ))}

                    {createMode === "bundle" ? (
                      <button
                        type="button"
                        className="btn-subtle rounded-full px-4 py-2 text-sm font-black"
                        onClick={addSlotRow}
                        disabled={slotItems.length >= slotOptions.length}
                      >
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
                                  <p className="mt-1 text-xs font-bold text-[var(--text-subtle)]">
                                    {asset ? `${asset.originalFileName} (${Math.max(1, Math.round(asset.size / 1024))} KB)` : "该分类暂无文件"}
                                  </p>
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
            </div>

            <div className="w-full space-y-6 lg:w-[45%]">
              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-black text-[var(--foreground)]">实时预览</h2>
                </div>

                <div className="overflow-hidden rounded-[24px] border-[3px] border-[var(--line-strong)] bg-white shadow-[4px_4px_0px_var(--line-strong)]">
                  <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#3b272d_0%,#5a4049_40%,#2e1c21_100%)]">
                    {previewUrl ? (
                      <img src={previewUrl} alt={previewTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-white/76">等待可预览文件...</div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-xl font-black text-[var(--foreground)]">{previewTitle}</h3>
                    <p className="mt-2 text-xs font-bold leading-relaxed text-[var(--foreground)]/60">{previewDescription}</p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
                      <span>{getDisplayName(currentUser)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="dream-panel p-6 shadow-[4px_4px_0px_var(--line-strong)]">
                <label className="mb-6 flex w-fit cursor-pointer items-center gap-3">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded border-[2px] border-[var(--line-strong)] ${
                      publicChecked ? "bg-[var(--button-primary)] text-[var(--foreground)]" : "bg-white text-transparent"
                    }`}
                  >
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
                    onClick={() => void submitCard("draft")}
                    className="btn-subtle w-full rounded-full py-3 text-sm font-black shadow-[2px_2px_0px_var(--line-strong)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitMode === "draft" ? "提交中..." : submitSecondaryLabel}
                  </button>

                  {mode === "edit" && loadedCard ? (
                    <button
                      type="button"
                      disabled={!canSubmitReview}
                      onClick={() => void handleSubmitReview()}
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
                    <p>审核状态：{getReviewStatusLabel(loadedCard.card.reviewStatus)}</p>
                    {loadedCard.card.reviewReason ? <p>驳回原因：{loadedCard.card.reviewReason}</p> : null}
                  </div>
                ) : (
                  <div className="mt-6 space-y-1 text-[10px] font-bold text-[var(--text-subtle)]">
                    <p>创建后可在「访问码配置」中继续设置分享规则。</p>
                    <p>封面图只用于展示，分类文件才用于用户下载。</p>
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
