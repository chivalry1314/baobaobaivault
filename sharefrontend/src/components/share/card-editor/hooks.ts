import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { slotOptions } from "@/components/share/card-editor/constants";
import {
  composeSearchableSummary,
  createEmptySlotItem,
  findAssetBySlot,
  findDuplicateSlots,
  getDisplayName,
  getSlotLabel,
  isCreatorRole,
  isImageMime,
  type SlotFileItem,
} from "@/components/share/card-editor/helpers";
import { useShareSession } from "@/components/share/session-provider";
import type {
  AssetPendingMap,
  CreateMode,
  EditorMode,
  SubmitMode,
} from "@/components/share/card-editor/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import type {
  CardContentSlot,
  CardDetailResponse,
  ShareCardAccessMode,
} from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

type UseShareCardEditorArgs = {
  mode: EditorMode;
  cardId?: string;
};

const initialAssetPending: AssetPendingMap = {
  system_theme: null,
  wechat_theme: null,
  app: null,
  character_persona: null,
  world_book: null,
};

export function useShareCardEditor({ mode, cardId }: UseShareCardEditorArgs) {
  const router = useRouter();
  const { user: currentUser, sessionChecking } = useShareSession();

  const [cardLoading, setCardLoading] = useState(mode === "edit");
  const [loadedCard, setLoadedCard] = useState<CardDetailResponse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicChecked, setPublicChecked] = useState(true);
  const [accessMode, setAccessMode] = useState<ShareCardAccessMode>("free");
  const [createMode, setCreateMode] = useState<CreateMode>("single");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [slotItems, setSlotItems] = useState<SlotFileItem[]>([
    createEmptySlotItem(0),
  ]);

  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);
  const [coverPending, setCoverPending] = useState<"replace" | "remove" | null>(
    null,
  );
  const [assetPending, setAssetPending] =
    useState<AssetPendingMap>(initialAssetPending);

  const isEditMode = mode === "edit";

  useEffect(() => {
    let active = true;

    if (!isEditMode) {
      setCardLoading(false);
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
        setAccessMode(detail.card.accessMode ?? "free");
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadedCard(null);
        setLoadError(
          getShareErrorMessage(error, "加载卡片信息失败，请稍后重试。"),
        );
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
  const hasAssetPending =
    coverPending !== null ||
    Object.values(assetPending).some((value) => value !== null);
  const afterSuccessPath =
    mode === "edit" && cardId
      ? `/creator/cards/${encodeURIComponent(cardId)}/edit`
      : "/creator";
  const isCreator = isCreatorRole(currentUser);
  const reviewStatus = loadedCard?.card.reviewStatus ?? "unsubmitted";
  const canSubmitReview = Boolean(
    isEditMode &&
      cardId &&
      loadedCard &&
      !publishPending &&
      !hasAssetPending &&
      !reviewSubmitPending &&
      reviewStatus !== "pending",
  );
  const authorName = currentUser ? getDisplayName(currentUser) : shareSiteBrand.defaultDisplayName;

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

  function handleCreateModeChange(nextMode: CreateMode) {
    setCreateMode(nextMode);
    if (nextMode === "single") {
      setSlotItems((current) => [current[0] ?? createEmptySlotItem(0)]);
      return;
    }
    setSlotItems((current) =>
      current.length > 0 ? current : [createEmptySlotItem(0)],
    );
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
          accessMode,
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

    const effectiveItems = (
      createMode === "single" ? slotItems.slice(0, 1) : slotItems
    ).filter(
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
        accessMode,
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
    if (
      !window.confirm(
        `确认删除分类「${getSlotLabel(slot)}」文件吗？删除后将无法恢复。`,
      )
    ) {
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

  return {
    mode,
    cardId,
    isEditMode,
    sessionChecking,
    cardLoading,
    currentUser,
    loadedCard,
    title,
    setTitle,
    description,
    setDescription,
    publicChecked,
    setPublicChecked,
    accessMode,
    setAccessMode,
    createMode,
    slotItems,
    setSlotValue,
    setSlotFile,
    addSlotRow,
    removeSlotRow,
    handleCreateModeChange,
    coverPreviewUrl,
    coverPending,
    coverFile,
    handleCreateCoverChange,
    clearCreateCover,
    previewUrl,
    previewTitle,
    previewDescription,
    authorName,
    loadError,
    formError,
    submitMode,
    reviewSubmitPending,
    publishPending,
    hasCoverOnCard,
    hasAssetPending,
    assetPending,
    pageTitle,
    pageDescription,
    submitPrimaryLabel,
    submitSecondaryLabel,
    afterSuccessPath,
    isCreator,
    canSubmitReview,
    submitCard,
    handleSubmitReview,
    handleDelete,
    handleReplaceCover,
    handleDeleteCover,
    handleReplaceAsset,
    handleDeleteAsset,
  };
}
