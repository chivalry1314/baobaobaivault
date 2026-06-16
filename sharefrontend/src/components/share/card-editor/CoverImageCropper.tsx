"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { LoadingSpinner } from "@/components/share/loading-spinner";

interface CoverImageCropperProps {
  imageFile: File;
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

function getCroppedBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 canvas 上下文");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("裁剪图片失败"));
    }, "image/jpeg", 0.92);
  });
}

export function CoverImageCropper({
  imageFile,
  aspect = 3 / 2,
  outputWidth = 1200,
  outputHeight = 800,
  onConfirm,
  onCancel,
}: CoverImageCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = event.currentTarget;
      const crop = makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height);
      const centered = centerCrop(crop, width, height);
      setCrop(centered);
      setCompletedCrop(convertToPixelCrop(centered, width, height));
      imgRef.current = event.currentTarget;
    },
    [aspect],
  );

  const handleConfirm = async () => {
    const image = imgRef.current;
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      return;
    }

    try {
      setPending(true);
      const blob = await getCroppedBlob(image, completedCrop, outputWidth, outputHeight);
      const extension = imageFile.name.split(".").pop();
      const baseName = imageFile.name.replace(/\.[^.]+$/, "");
      const croppedFile = new File(
        [blob],
        `${baseName || "cover"}-cropped.${extension || "jpg"}`,
        { type: "image/jpeg" },
      );
      onConfirm(croppedFile);
    } catch (error) {
      console.error("封面裁剪失败:", error);
      window.alert(error instanceof Error ? error.message : "封面裁剪失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.4rem] border-2 border-[var(--outline)] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--outline)]/12 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-[var(--foreground)]">裁剪封面图</h3>
            <p className="mt-0.5 text-[10px] font-bold text-[var(--foreground)]/55">
              拖动调整区域，封面将按 3:2 比例展示
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-[var(--foreground)]/60 transition hover:bg-[var(--surface-container)] hover:text-[var(--foreground)]"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-container)] p-4">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => {
              const image = imgRef.current;
              if (image) {
                setCompletedCrop(convertToPixelCrop(c, image.width, image.height));
              }
            }}
            aspect={aspect}
            minWidth={300}
            minHeight={200}
          >
            <img
              src={objectUrl ?? undefined}
              alt="待裁剪的封面图"
              onLoad={handleImageLoad}
              className="max-h-[60vh] w-auto object-contain"
            />
          </ReactCrop>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--outline)]/12 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-[11px] font-black text-[var(--foreground)]/78 transition hover:bg-[var(--surface-container)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending || !completedCrop}
            className="inline-flex items-center justify-center rounded-full bg-[var(--button-primary)] px-4 py-2 text-[11px] font-black text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <LoadingSpinner size="sm" inline label="裁剪中..." /> : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}
