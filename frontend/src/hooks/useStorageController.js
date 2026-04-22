import { useEffect, useState } from "react";
import { api } from "../api";
import { emptyObjectForm, emptyStorageForm } from "../constants/forms";
import { parseJson } from "../utils/data";

function buildTenantParams(isPlatformAdmin, tenantID) {
  if (!isPlatformAdmin || !tenantID) return undefined;
  return { tenant_id: tenantID };
}

export default function useStorageController({ token, tenantID, isPlatformAdmin, act, setNotice, loadTenant }) {
  const [storageConfigs, setStorageConfigs] = useState([]);
  const [storageForm, setStorageForm] = useState(emptyStorageForm);
  const [objectForm, setObjectForm] = useState(emptyObjectForm);
  const [objects, setObjects] = useState([]);
  const [objectVersions, setObjectVersions] = useState([]);
  const [selectedNamespaceID, setSelectedNamespaceID] = useState("");
  const [selectedObjectKey, setSelectedObjectKey] = useState("");
  const [objectPrefix, setObjectPrefix] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [presignUrl, setPresignUrl] = useState("");
  const [presignPutInfo, setPresignPutInfo] = useState(null);

  useEffect(() => {
    setSelectedNamespaceID("");
    setSelectedObjectKey("");
    setObjectPrefix("");
    setObjects([]);
    setObjectVersions([]);
    setUploadFile(null);
    setPresignUrl("");
    setPresignPutInfo(null);
  }, [tenantID]);

  async function loadStorageConfigs() {
    const list = await api.listStorageConfigs(token, buildTenantParams(isPlatformAdmin, tenantID));
    setStorageConfigs(Array.isArray(list) ? list : []);
  }

  async function loadObjects(namespaceID = selectedNamespaceID, prefix = objectPrefix) {
    if (!namespaceID) {
      setObjects([]);
      setObjectVersions([]);
      setSelectedObjectKey("");
      return;
    }
    const page = await api.listObjects(token, { namespace_id: namespaceID, prefix, page: 1, page_size: 200 });
    setObjects(page?.items || []);
  }

  async function loadObjectVersions(namespaceID, key) {
    if (!namespaceID || !key) {
      setObjectVersions([]);
      return;
    }
    const page = await api.listObjectVersions(token, { namespace_id: namespaceID, key, page: 1, page_size: 200 });
    setObjectVersions(page?.items || []);
  }

  async function onCreateStorageConfig(event) {
    event.preventDefault();
    const ok = await act(
      () =>
        api.createStorageConfig(
          token,
          {
            name: storageForm.name,
            provider: storageForm.provider,
            endpoint: storageForm.endpoint,
            region: storageForm.region,
            bucket: storageForm.bucket,
            access_key: storageForm.accessKey,
            secret_key: storageForm.secretKey,
            path_style: storageForm.pathStyle,
            is_default: storageForm.isDefault,
            extra_config: storageForm.extraConfig,
          },
          buildTenantParams(isPlatformAdmin, tenantID)
        ),
      "存储配置已创建"
    );
    if (ok) {
      setStorageForm(emptyStorageForm);
      await loadStorageConfigs();
    }
  }

  async function onDeleteStorageConfig(id) {
    const ok = await act(() => api.deleteStorageConfig(token, id, buildTenantParams(isPlatformAdmin, tenantID)), "存储配置已删除");
    if (ok) await loadStorageConfigs();
  }

  async function onUploadObject(event) {
    event.preventDefault();
    if (!selectedNamespaceID) return setNotice({ type: "error", text: "请先选择命名空间" });
    if (!uploadFile) return setNotice({ type: "error", text: "请先选择文件" });

    const fd = new FormData();
    fd.append("namespace_id", selectedNamespaceID);
    fd.append("key", objectForm.key || uploadFile.name);
    fd.append("file", uploadFile);
    if (objectForm.contentType) fd.append("content_type", objectForm.contentType);
    if (objectForm.metadata.trim()) fd.append("metadata", objectForm.metadata.trim());

    const ok = await act(() => api.uploadObject(token, fd), "对象上传成功");
    if (ok) {
      setObjectForm(emptyObjectForm);
      setUploadFile(null);
      setPresignPutInfo(null);
      await loadObjects(selectedNamespaceID, objectPrefix);
      await loadTenant();
    }
  }

  async function onDeleteObject(item) {
    const ok = await act(() => api.deleteObject(token, { namespace_id: selectedNamespaceID, key: item.key }), "对象已删除");
    if (ok) {
      if (selectedObjectKey === item.key) {
        setSelectedObjectKey("");
        setObjectVersions([]);
      }
      await loadObjects(selectedNamespaceID, objectPrefix);
      await loadTenant();
    }
  }

  async function onDownloadObject(item) {
    const result = await act(() => api.downloadObject(token, { namespace_id: selectedNamespaceID, key: item.key }));
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onPresign(item) {
    const result = await act(() => api.presignGet(token, { namespace_id: selectedNamespaceID, key: item.key, ttl_seconds: 300 }));
    if (result?.url) setPresignUrl(result.url);
  }

  async function onViewVersions(item) {
    setSelectedObjectKey(item.key);
    const ok = await act(() => loadObjectVersions(selectedNamespaceID, item.key));
    if (ok === null) setObjectVersions([]);
  }

  async function onRollbackVersion(versionID) {
    if (!selectedObjectKey) return;
    const ok = await act(
      () => api.rollbackObjectVersion(token, { namespace_id: selectedNamespaceID, key: selectedObjectKey, version_id: versionID }),
      "版本已回滚"
    );
    if (ok) {
      await loadObjects(selectedNamespaceID, objectPrefix);
      await loadObjectVersions(selectedNamespaceID, selectedObjectKey);
    }
  }

  async function onPresignPut() {
    if (!selectedNamespaceID) return setNotice({ type: "error", text: "请先选择命名空间" });
    const key = (objectForm.key || "").trim();
    if (!key) return setNotice({ type: "error", text: "请先填写对象键" });

    const result = await act(() => api.presignPut(token, { namespace_id: selectedNamespaceID, key, ttl_seconds: 300 }));
    if (result?.url) {
      setPresignPutInfo({
        url: result.url,
        key: result.key || key,
        version_id: result.version_id || "",
      });
    }
  }

  async function onCompletePresignPut() {
    if (!selectedNamespaceID) return setNotice({ type: "error", text: "请先选择命名空间" });
    if (!presignPutInfo?.key || !presignPutInfo?.version_id) {
      return setNotice({ type: "error", text: "请先生成预签名上传地址" });
    }

    let metadata;
    if ((objectForm.metadata || "").trim()) {
      metadata = parseJson(objectForm.metadata, null);
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return setNotice({ type: "error", text: "元数据必须是 JSON 对象" });
      }
    }

    const ok = await act(
      () =>
        api.completePresignPut(token, {
          namespace_id: selectedNamespaceID,
          key: presignPutInfo.key,
          version_id: presignPutInfo.version_id,
          content_type: objectForm.contentType || "",
          metadata,
        }),
      "预签名上传已回写"
    );

    if (ok) {
      await loadObjects(selectedNamespaceID, objectPrefix);
      await loadTenant();
      if (selectedObjectKey === presignPutInfo.key) {
        await loadObjectVersions(selectedNamespaceID, selectedObjectKey);
      }
    }
  }

  function resetStorage() {
    setStorageConfigs([]);
    setStorageForm(emptyStorageForm);
    setObjectForm(emptyObjectForm);
    setObjects([]);
    setObjectVersions([]);
    setSelectedNamespaceID("");
    setSelectedObjectKey("");
    setObjectPrefix("");
    setUploadFile(null);
    setPresignUrl("");
    setPresignPutInfo(null);
  }

  return {
    storageConfigs,
    storageForm,
    setStorageForm,
    objectForm,
    setObjectForm,
    objects,
    objectVersions,
    setObjectVersions,
    selectedNamespaceID,
    setSelectedNamespaceID,
    selectedObjectKey,
    setSelectedObjectKey,
    objectPrefix,
    setObjectPrefix,
    uploadFile,
    setUploadFile,
    presignUrl,
    presignPutInfo,
    setPresignPutInfo,
    loadStorageConfigs,
    loadObjects,
    loadObjectVersions,
    onCreateStorageConfig,
    onDeleteStorageConfig,
    onUploadObject,
    onDeleteObject,
    onDownloadObject,
    onPresign,
    onViewVersions,
    onRollbackVersion,
    onPresignPut,
    onCompletePresignPut,
    resetStorage,
  };
}
