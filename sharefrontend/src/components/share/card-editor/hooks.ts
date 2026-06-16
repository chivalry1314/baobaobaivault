import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  isCategoryEnabled,
  useShareCategorySettings,
} from "@/components/share/category-provider";
import { slotOptions } from "@/components/share/card-editor/slot-registry";
import { useConfirm } from "@/components/share/confirm-dialog";
import {
  composeSearchableSummary,
  computeSlotChanges,
  createEmptySlotItem,
  createSlotItemsFromAssets,
  findDuplicateSlots,
  getDisplayName,
  getSlotLabel,
  isCreatorRole,
  isImageMime,
  type SlotFileItem,
} from "@/components/share/card-editor/helpers";
import { createCompliantDesktopComponentFile } from "@/components/share/card-editor/desktop-component";
import { useShareSession } from "@/components/share/session-provider";
import type {
  CreateMode,
  EditorMode,
  SubmitMode,
} from "@/components/share/card-editor/types";
import { getShareErrorMessage, shareApi } from "@/lib/share-api";
import { uploadToPresignedURL } from "@/lib/upload-presigned";
import type {
  CardContentSlot,
  CardDetailResponse,
  ShareCardAccessMode,
  SharePreparedCardBundleUpload,
  ShareUploadedAssetInfo,
  ShareUploadedMediaInfo,
} from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

type UseShareCardEditorArgs = {
  mode: EditorMode;
  cardId?: string;
};


function parseCardTagsInput(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((item) => item.slice(0, 32).trim())
    .filter((item) => item.length > 0);
}

const MAX_CARD_TAGS = 12;
const MAX_CARD_TAG_LENGTH = 32;

function normalizeSingleTag(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_CARD_TAG_LENGTH).trim();
}

function mergeCardTags(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = normalizeSingleTag(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(normalized);
    if (next.length >= MAX_CARD_TAGS) {
      break;
    }
  }

  return next;
}

function getPendingTagCandidates(currentTags: string[], draft: string): string[] {
  const existingKeys = new Set(currentTags.map((item) => item.toLowerCase()));
  const pendingKeys = new Set<string>();
  const next: string[] = [];

  for (const value of parseCardTagsInput(draft)) {
    const normalized = normalizeSingleTag(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (existingKeys.has(key) || pendingKeys.has(key)) {
      continue;
    }

    pendingKeys.add(key);
    next.push(normalized);

    if (currentTags.length + next.length >= MAX_CARD_TAGS) {
      break;
    }
  }

  return next;
}

function sanitizeTagDraftInput(value: string): string {
  return value.replace(/^\s+/, "").replace(/[，、]/g, ",");
}

function formatTagDraftForBlur(value: string): string {
  return parseCardTagsInput(value).join(", ");
}

export function useShareCardEditor({ mode, cardId }: UseShareCardEditorArgs) {
  const router = useRouter();
  const confirm = useConfirm();
  const { user: currentUser, sessionChecking } = useShareSession();
  const categorySettings = useShareCategorySettings();
  const enabledSlotList = useMemo<CardContentSlot[]>(
    () => slotOptions.filter((option) => isCategoryEnabled(categorySettings, option.value)).map((option) => option.value),
    [categorySettings],
  );

  const [cardLoading, setCardLoading] = useState(mode === "edit");
  const [loadedCard, setLoadedCard] = useState<CardDetailResponse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [publicChecked, setPublicChecked] = useState(true);
  const [accessMode, setAccessMode] = useState<ShareCardAccessMode>("free");
  const [createMode, setCreateMode] = useState<CreateMode>("single");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverChange, setCoverChange] = useState<"none" | "replace" | "delete">("none");
  const [slotItems, setSlotItems] = useState<SlotFileItem[]>([
    createEmptySlotItem(0, enabledSlotList),
  ]);

  useEffect(() => {
    setSlotItems((current) => {
      if (current.length === 0) {
        return [createEmptySlotItem(0, enabledSlotList)];
      }
      const defaultSlot = enabledSlotList[0];
      if (!defaultSlot) {
        return current;
      }
      const next = current.map((item) =>
        isCategoryEnabled(categorySettings, item.slot) ? item : { ...item, slot: defaultSlot },
      );
      return next;
    });
  }, [categorySettings, enabledSlotList]);

  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitMode, setSubmitMode] = useState<SubmitMode>(null);
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);

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
        setCoverFile(null);
        setTitle(detail.card.title);
        setDescription(detail.card.description);
        setTags(mergeCardTags(detail.card.tags || []));
        setPublicChecked(detail.card.visibility === "public");
        setAccessMode(detail.card.accessMode ?? "free");
        const initialItems = createSlotItemsFromAssets(detail.assets, enabledSlotList);
        setSlotItems(initialItems);
        setCreateMode(initialItems.length > 1 ? "bundle" : "single");
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
  }, [cardId, currentUser, isEditMode, enabledSlotList]);

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
      !reviewSubmitPending &&
      reviewStatus !== "pending",
  );
  const authorName = currentUser ? getDisplayName(currentUser) : shareSiteBrand.defaultDisplayName;
  const tagLimitReached = tags.length >= MAX_CARD_TAGS;
  const tagSlotsRemaining = Math.max(0, MAX_CARD_TAGS - tags.length);
  const parsedTagDraft = useMemo(
    () => mergeCardTags(parseCardTagsInput(tagDraft)),
    [tagDraft],
  );
  const pendingTagCandidates = useMemo(
    () => getPendingTagCandidates(tags, tagDraft),
    [tagDraft, tags],
  );
  const canAddTag = !tagLimitReached && pendingTagCandidates.length > 0;
  const tagHelperText = tagLimitReached
    ? `已达到 ${MAX_CARD_TAGS} 个标签上限，可先删除已有标签再继续添加。`
    : parsedTagDraft.length > 0 && pendingTagCandidates.length === 0
      ? "这些标签已经添加过了，无需重复添加。"
      : parsedTagDraft.length > pendingTagCandidates.length &&
          pendingTagCandidates.length > 0
        ? `将添加 ${pendingTagCandidates.length} 个标签，其余重复或超出上限的内容会自动忽略。`
        : pendingTagCandidates.length > 0
          ? `将添加 ${pendingTagCandidates.length} 个标签，添加后共 ${
              tags.length + pendingTagCandidates.length
            }/${MAX_CARD_TAGS} 个。`
          : `已添加 ${tags.length}/${MAX_CARD_TAGS} 个标签，每个标签最多 ${MAX_CARD_TAG_LENGTH} 个字。`;

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
    if (isImageMime(coverFile)) {
      return coverFile;
    }
    for (const item of slotItems) {
      if (isImageMime(item.file) && !item.pendingDelete) {
        return item.file;
      }
    }
    return null;
  }, [coverFile, slotItems]);

  const previewUrl = useMemo(() => {
    if (mode === "edit") {
      if (coverChange === "replace" && coverFile) {
        return URL.createObjectURL(coverFile);
      }
      if (coverChange === "delete" || !loadedCard?.card.previewUrl) {
        if (previewImageFile) {
          return URL.createObjectURL(previewImageFile);
        }
        const imageAsset = loadedCard?.assets.find((a) => a.mimeType.startsWith("image/"));
        return imageAsset?.previewUrl ?? loadedCard?.card.previewUrl ?? "";
      }
      return loadedCard?.card.previewUrl ?? "";
    }
    if (!previewImageFile) {
      return "";
    }
    return URL.createObjectURL(previewImageFile);
  }, [loadedCard?.card.previewUrl, loadedCard?.assets, mode, previewImageFile, coverFile, coverChange]);

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
      if (current.length >= enabledSlotList.length) {
        return current;
      }
      return [...current, createEmptySlotItem(current.length, enabledSlotList)];
    });
  }

  function removeSlotRow(index: number) {
    setSlotItems((current) => {
      const item = current[index];
      if (item?.pendingDelete) {
        return current.map((it, idx) => (idx === index ? { ...it, pendingDelete: false } : it));
      }
      const isEffective = (it: SlotFileItem) => !it.pendingDelete && (Boolean(it.file) || Boolean(it.originalAsset));
      const effectiveCount = current.filter(isEffective).length;
      if (effectiveCount <= 1 && item && isEffective(item)) {
        return current;
      }
      if (mode === "edit" && item?.originalAsset) {
        // 编辑模式下删除已有资产行时标记为待删除，而不是直接移除
        return current.map((it, idx) => (idx === index ? { ...it, file: null, pendingDelete: true } : it));
      }
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  }

  function handleCreateCoverFile(file: File | null) {
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
      setSlotItems((current) => {
        if (current.length <= 1) {
          return current;
        }
        if (mode === "edit") {
          // 编辑模式下保留第一行，已有资产标记为待删除，新添加但未保存的行直接移除
          const first = current[0];
          if (!first) {
            return current;
          }
          const remaining = current.slice(1).filter((item) => item.originalAsset);
          return [
            { ...first, pendingDelete: false },
            ...remaining.map((item) => ({ ...item, file: null, pendingDelete: true })),
          ];
        }
        return [current[0] ?? createEmptySlotItem(0, enabledSlotList)];
      });
      return;
    }
    setSlotItems((current) => {
      if (current.length === 0) {
        return [createEmptySlotItem(0, enabledSlotList)];
      }
      if (mode === "edit") {
        // 从 single 切回 bundle 时恢复所有待删除行
        return current.map((item) => ({ ...item, pendingDelete: false }));
      }
      return current;
    });
  }

  function handleAddTag() {
    if (!canAddTag) {
      return;
    }

    setTags((current) => mergeCardTags([...current, ...pendingTagCandidates]));
    setTagDraft("");
  }

  function handleTagDraftChange(value: string) {
    setTagDraft(sanitizeTagDraftInput(value));
  }

  function handleTagDraftBlur() {
    setTagDraft((current) => formatTagDraftForBlur(current));
  }

  function handleRemoveTag(index: number) {
    setTags((current) => current.filter((_, currentIndex) => currentIndex !== index));
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

      // 编辑模式下处理所有 slotItems（包括 pendingDelete），确保删除操作也能被提交
      const effectiveItems = slotItems;
      const duplicateSlots = findDuplicateSlots(effectiveItems.filter((item) => !item.pendingDelete));
      if (duplicateSlots.length > 0) {
        setFormError("同一张卡片内分类不能重复。");
        return;
      }

      if (effectiveItems.some((item) => !item.file && !item.originalAsset)) {
        setFormError("请为每个分类选择文件。");
        return;
      }

      setSubmitMode(status);
      setFormError("");
      const errors: string[] = [];

      try {
        const settingsResponse = await shareApi.publicMediaStorageSettings();
        const useObjectStorage = settingsResponse.storage_mode === "object_storage";

        await shareApi.updateCard(cardId, {
          title: title.trim(),
          description: description.trim(),
          tags,
          visibility: publicChecked ? "public" : "private",
          status,
          accessMode,
        });

        if (coverChange === "replace" && coverFile) {
          if (useObjectStorage) {
            const presign = await shareApi.presignCardCoverReplace(
              cardId,
              coverFile.type || "application/octet-stream",
              coverFile.size,
            );
            const result = await uploadToPresignedURL({
              file: coverFile,
              url: presign.url,
              contentType: presign.content_type || coverFile.type || "application/octet-stream",
            });
            await shareApi.completeCardCoverReplace(cardId, {
              object_key: presign.object_key,
              version_id: presign.version_id,
              etag: result.etag,
              size: coverFile.size,
              file_name: coverFile.name,
              mime_type: coverFile.type || presign.content_type || "application/octet-stream",
              namespace_id: presign.namespace_id,
            });
          } else {
            await shareApi.replaceCardCover(cardId, coverFile);
          }
        } else if (coverChange === "delete" && hasCoverOnCard) {
          await shareApi.deleteCardCover(cardId);
        }

        const { changes, deletes } = computeSlotChanges(effectiveItems);

        for (const del of deletes) {
          try {
            await shareApi.deleteCardAsset(cardId, del.slot);
          } catch (error) {
            errors.push(`删除「${getSlotLabel(del.slot)}」失败：${getShareErrorMessage(error, "未知错误")}`);
          }
        }

        for (const change of changes) {
          try {
            let uploadFile = change.file;

            if (change.slot === "desktop_component" && loadedCard?.desktopComponent) {
              const metadata = {
                name: loadedCard.desktopComponent.name,
                width: loadedCard.desktopComponent.width,
                height: loadedCard.desktopComponent.height,
                cornerRadius: loadedCard.desktopComponent.cornerRadius,
                frosted: loadedCard.desktopComponent.frosted,
                shadow: loadedCard.desktopComponent.shadow,
                backgroundOpacity: loadedCard.desktopComponent.backgroundOpacity,
              };
              uploadFile = await createCompliantDesktopComponentFile(change.file, metadata);
            }

            if (change.originalAsset && change.originalAsset.slot !== change.slot) {
              try {
                await shareApi.deleteCardAsset(cardId, change.originalAsset.slot);
              } catch (error) {
                errors.push(
                  `删除原分类「${getSlotLabel(change.originalAsset.slot)}」失败：${getShareErrorMessage(error, "未知错误")}`,
                );
                continue;
              }
            }

            if (useObjectStorage) {
              const presign = await shareApi.presignCardAssetReplace(
                cardId,
                change.slot,
                uploadFile.type || "application/octet-stream",
                uploadFile.size,
              );
              const result = await uploadToPresignedURL({
                file: uploadFile,
                url: presign.url,
                contentType: presign.content_type || uploadFile.type || "application/octet-stream",
              });
              await shareApi.completeCardAssetReplace(cardId, change.slot, {
                object_key: presign.object_key,
                version_id: presign.version_id,
                etag: result.etag,
                size: uploadFile.size,
                file_name: uploadFile.name,
                mime_type: uploadFile.type || presign.content_type || "application/octet-stream",
                namespace_id: presign.namespace_id,
              });
            } else {
              await shareApi.replaceCardAsset(cardId, change.slot, uploadFile);
            }
          } catch (error) {
            errors.push(`更新「${getSlotLabel(change.slot)}」失败：${getShareErrorMessage(error, "未知错误")}`);
          }
        }

        const freshDetail = await shareApi.cardDetail(cardId);
        setLoadedCard(freshDetail);
        setCoverChange("none");
        setCoverFile(null);
        setSlotItems(createSlotItemsFromAssets(freshDetail.assets, enabledSlotList));
        setCreateMode(freshDetail.assets.length > 1 ? "bundle" : "single");

        if (errors.length > 0) {
          setFormError(errors.join("；"));
        } else {
          router.push("/creator");
          router.refresh();
        }
      } catch (error) {
        setFormError(getShareErrorMessage(error, "保存卡片失败，请稍后重试。"));
        try {
          if (cardId) {
            const freshDetail = await shareApi.cardDetail(cardId);
            setLoadedCard(freshDetail);
            setCoverChange("none");
            setCoverFile(null);
            setSlotItems(createSlotItemsFromAssets(freshDetail.assets, enabledSlotList));
            setCreateMode(freshDetail.assets.length > 1 ? "bundle" : "single");
          }
        } catch {
          // ignore refresh error
        }
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
      const settingsResponse = await shareApi.publicMediaStorageSettings();
      const useObjectStorage = settingsResponse.storage_mode === "object_storage";

      if (useObjectStorage) {
        const presign = await shareApi.presignCardBundle({
          title: title.trim(),
          description: description.trim(),
          tags,
          visibility: publicChecked ? "public" : "private",
          status,
          accessMode,
          cover: coverFile
            ? {
                contentType: coverFile.type || "application/octet-stream",
                size: coverFile.size,
              }
            : undefined,
          assets: effectiveItems.map((item) => ({
            slot: item.slot,
            contentType: item.file.type || "application/octet-stream",
            size: item.file.size,
          })),
        });

        const coverInfo = await uploadPresignedCover(presign.cover, coverFile);
        const assetInfos = await uploadPresignedAssets(presign.assets, effectiveItems);

        await shareApi.completeCardBundle({
          cardId: presign.card_id,
          title: title.trim(),
          description: description.trim(),
          tags,
          visibility: publicChecked ? "public" : "private",
          status,
          accessMode,
          cover: coverInfo,
          assets: assetInfos,
        });
      } else {
        await shareApi.createCardBundle({
          title: title.trim(),
          description: description.trim(),
          tags,
          visibility: publicChecked ? "public" : "private",
          status,
          accessMode,
          cover: coverFile ?? undefined,
          items: effectiveItems,
        });
      }

      router.push("/creator");
      router.refresh();
    } catch (error) {
      setFormError(getShareErrorMessage(error, "创建卡片失败，请稍后重试。"));
    } finally {
      setSubmitMode(null);
    }
  }

  async function uploadPresignedCover(
    coverEntry: SharePreparedCardBundleUpload["cover"],
    file: File | null,
  ): Promise<ShareUploadedMediaInfo | undefined> {
    if (!coverEntry || !file) {
      return undefined;
    }
    const result = await uploadToPresignedURL({
      file,
      url: coverEntry.url,
      contentType: coverEntry.content_type || file.type || "application/octet-stream",
    });
    return {
      object_key: coverEntry.object_key,
      version_id: coverEntry.version_id,
      etag: result.etag,
      size: file.size,
      file_name: file.name,
      mime_type: file.type || coverEntry.content_type || "application/octet-stream",
      namespace_id: coverEntry.namespace_id,
    };
  }

  async function uploadPresignedAssets(
    presignAssets: SharePreparedCardBundleUpload["assets"],
    items: { slot: CardContentSlot; file: File }[],
  ): Promise<ShareUploadedAssetInfo[]> {
    const entryBySlot = new Map(presignAssets.map((a) => [a.slot, a]));
    const results: ShareUploadedAssetInfo[] = [];
    for (const item of items) {
      const entry = entryBySlot.get(item.slot);
      if (!entry) {
        throw new Error(`找不到分类 ${item.slot} 的上传地址`);
      }
      const result = await uploadToPresignedURL({
        file: item.file,
        url: entry.url,
        contentType: entry.content_type || item.file.type || "application/octet-stream",
      });
      results.push({
        slot: item.slot,
        object_key: entry.object_key,
        version_id: entry.version_id,
        etag: result.etag,
        size: item.file.size,
        file_name: item.file.name,
        mime_type: item.file.type || entry.content_type || "application/octet-stream",
        namespace_id: entry.namespace_id,
      });
    }
    return results;
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
    const confirmed = await confirm({
      title: "删除卡片",
      description: "确认删除这张卡片吗？删除后将无法恢复。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive",
    });
    if (!confirmed) {
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
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormError("封面图仅支持图片文件。");
      return;
    }
    setFormError("");
    setCoverFile(file);
    if (mode === "edit") {
      setCoverChange("replace");
    }
  }

  async function handleDeleteCover() {
    if (mode === "edit") {
      if (!loadedCard || !hasCoverOnCard) {
        return;
      }
      const confirmed = await confirm({
        title: "删除封面图",
        description: "确认删除当前封面图吗？删除后将回退为分类文件预览。",
        confirmText: "删除",
        cancelText: "取消",
        variant: "destructive",
      });
      if (!confirmed) {
        return;
      }
      setCoverFile(null);
      setCoverChange("delete");
      setFormError("");
      return;
    }

    clearCreateCover();
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
    tags,
    tagDraft,
    handleTagDraftChange,
    handleTagDraftBlur,
    canAddTag,
    tagLimitReached,
    tagSlotsRemaining,
    tagHelperText,
    handleAddTag,
    handleRemoveTag,
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
    coverFile,
    handleCreateCoverFile,
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
  };
}
