"use client";

export type UploadToPresignedURLOptions = {
  file: File;
  url: string;
  contentType: string;
  onProgress?: (percent: number) => void;
};

export type UploadToPresignedURLResult = {
  etag: string;
};

export function uploadToPresignedURL(options: UploadToPresignedURLOptions): Promise<UploadToPresignedURLResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", options.url, true);
    xhr.setRequestHeader("Content-Type", options.contentType);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const rawEtag = xhr.getResponseHeader("ETag") || "";
        resolve({ etag: rawEtag.replace(/"/g, "") });
      } else {
        reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("上传到存储服务时网络错误"));
    xhr.ontimeout = () => reject(new Error("上传到存储服务时超时"));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.send(options.file);
  });
}
