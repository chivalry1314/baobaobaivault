import { useMemo, useState } from "react";
import { FileSearch, HardDrive, Plus, Search, Upload } from "lucide-react";
import Panel from "../components/Panel";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

export default function StoragePage({
  activeTab,
  storageConfigs,
  storageForm,
  setStorageForm,
  onCreateStorageConfig,
  onDeleteStorageConfig,
  selectedNamespace,
  selectedNamespaceID,
  setSelectedNamespaceID,
  setSelectedObjectKey,
  setObjectVersions,
  setPresignPutInfo,
  namespaces,
  objectPrefix,
  setObjectPrefix,
  loadObjects,
  busy,
  onUploadObject,
  objectForm,
  setObjectForm,
  setUploadFile,
  onPresignPut,
  onCompletePresignPut,
  presignPutInfo,
  presignUrl,
  objects,
  onDownloadObject,
  onViewVersions,
  onPresign,
  onDeleteObject,
  selectedObjectKey,
  objectVersions,
  onRollbackVersion,
}) {
  const showConfig = activeTab === "storage-config";
  const showObjects = activeTab === "storage-objects";

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [configSearch, setConfigSearch] = useState("");
  const [configPage, setConfigPage] = useState(1);
  const [objectSearch, setObjectSearch] = useState("");
  const [objectPage, setObjectPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  const filteredConfigs = useMemo(() => {
    const q = configSearch.toLowerCase().trim();
    if (!q) return storageConfigs;
    return storageConfigs.filter((c) => [c.name, c.provider, c.bucket, c.endpoint, c.region].some((s) => String(s || "").toLowerCase().includes(q)));
  }, [storageConfigs, configSearch]);

  const filteredObjects = useMemo(() => {
    const q = objectSearch.toLowerCase().trim();
    if (!q) return objects;
    return objects.filter((o) => String(o.key || "").toLowerCase().includes(q));
  }, [objects, objectSearch]);

  const pagedConfigs = filteredConfigs.slice((configPage - 1) * PAGE_SIZE, configPage * PAGE_SIZE);
  const pagedObjects = filteredObjects.slice((objectPage - 1) * PAGE_SIZE, objectPage * PAGE_SIZE);

  function confirmDelete(type, id, label) {
    setDeleteTarget({ type, id, label });
  }

  function executeDelete() {
    if (!deleteTarget) return;
    const { type, id, label } = deleteTarget;
    if (type === "config") onDeleteStorageConfig(id);
    else if (type === "object") onDeleteObject({ key: label });
    setDeleteTarget(null);
  }

  function executeRollback() {
    if (!rollbackTarget) return;
    onRollbackVersion(rollbackTarget);
    setRollbackTarget(null);
  }

  return (
    <section id="section-storage" className="grid one">
      {showConfig ? (
        <Panel title="存储配置" subtitle={`${storageConfigs.length} 条配置`}>
          <div className="section-header">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="搜索名称、Provider、Bucket..." value={configSearch} onChange={(event) => { setConfigSearch(event.target.value); setConfigPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowConfigModal(true)}>
              <Plus size={16} />
              新增配置
            </button>
          </div>

          {pagedConfigs.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedConfigs.map((x) => (
                  <div className="mini-row" key={x.id}>
                    <div>
                      <strong>
                        {x.name} ({x.provider})
                      </strong>
                      <small>{x.bucket}</small>
                    </div>
                    <button className="btn small danger" type="button" onClick={() => confirmDelete("config", x.id, `${x.name} (${x.provider})`)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <Pagination total={filteredConfigs.length} page={configPage} onChange={setConfigPage} />
            </>
          ) : (
            <div className="empty-state">
              <HardDrive size={40} />
              <p>{configSearch ? "未找到匹配配置" : "暂无存储配置"}</p>
            </div>
          )}
        </Panel>
      ) : null}

      {showObjects ? (
        <Panel title="对象管理" subtitle={selectedNamespace ? `命名空间：${selectedNamespace.name}` : "请先选择命名空间"} delay={120}>
          <div className="section-header">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="搜索对象键..." value={objectSearch} onChange={(event) => { setObjectSearch(event.target.value); setObjectPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowUploadModal(true)} disabled={!selectedNamespaceID}>
              <Upload size={16} />
              上传对象
            </button>
          </div>

          <div className="form-grid compact spaced-block">
            <select
              value={selectedNamespaceID}
              onChange={(event) => {
                setSelectedNamespaceID(event.target.value);
                setSelectedObjectKey("");
                setObjectVersions([]);
                setPresignPutInfo(null);
              }}
            >
              <option value="">选择命名空间</option>
              {namespaces.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <div className="inline">
              <input placeholder="前缀" value={objectPrefix} onChange={(event) => setObjectPrefix(event.target.value)} />
              <button className="btn ghost" type="button" onClick={() => void loadObjects(selectedNamespaceID, objectPrefix)} disabled={busy}>
                查询
              </button>
            </div>
          </div>

          <div className="toolbar-actions spaced-block">
            <button className="btn small ghost" type="button" onClick={() => void onPresignPut()} disabled={busy || !selectedNamespaceID}>
              生成预签名 PUT
            </button>
            <button className="btn small ghost" type="button" onClick={() => void onCompletePresignPut()} disabled={busy || !selectedNamespaceID || !presignPutInfo}>
              回写预签名 PUT
            </button>
          </div>

          {presignUrl ? (
            <div className="secret-box">
              <p>预签名 GET 地址（可复制）</p>
              <a href={presignUrl} target="_blank" rel="noreferrer">
                {presignUrl}
              </a>
            </div>
          ) : null}

          {presignPutInfo ? (
            <div className="secret-box">
              <p>预签名 PUT 地址（可复制）</p>
              <a href={presignPutInfo.url} target="_blank" rel="noreferrer">
                {presignPutInfo.url}
              </a>
              <code>对象键：{presignPutInfo.key}</code>
              <code>版本：{presignPutInfo.version_id}</code>
            </div>
          ) : null}

          {pagedObjects.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedObjects.map((x) => (
                  <div className="mini-row" key={x.id}>
                    <div>
                      <strong>{x.key}</strong>
                      <small>{x.size?.toLocaleString()} 字节</small>
                    </div>
                    <div className="actions-inline">
                      <button className="btn small ghost" type="button" onClick={() => void onDownloadObject(x)}>
                        下载
                      </button>
                      <button className="btn small ghost" type="button" onClick={() => void onViewVersions(x)}>
                        版本
                      </button>
                      <button className="btn small ghost" type="button" onClick={() => void onPresign(x)}>
                        预签名 GET
                      </button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("object", x.id, x.key)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredObjects.length} page={objectPage} onChange={setObjectPage} />
            </>
          ) : (
            <div className="empty-state">
              <FileSearch size={40} />
              <p>{objectSearch ? "未找到匹配对象" : selectedNamespaceID ? "当前命名空间暂无对象" : "请先选择命名空间"}</p>
            </div>
          )}

          {selectedObjectKey ? (
            <div className="mini-table version-history">
              <div className="mini-row">
                <div>
                  <strong>版本历史</strong>
                  <small>{selectedObjectKey}</small>
                </div>
              </div>
              {objectVersions.map((x) => (
                <div className="mini-row" key={x.id}>
                  <div>
                    <strong>{x.version_id}</strong>
                    <small>{x.size?.toLocaleString()} 字节</small>
                  </div>
                  <div className="actions-inline">
                    <code>{x.is_latest ? "最新" : "历史"}</code>
                    {!x.is_latest ? (
                      <button className="btn small ghost" type="button" onClick={() => setRollbackTarget(x.version_id)}>
                        回滚
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Modal open={showConfigModal} title="新增存储配置" subtitle="创建一个新的存储配置" onClose={() => setShowConfigModal(false)}>
        <form className="form-grid compact" onSubmit={(event) => { onCreateStorageConfig(event); setShowConfigModal(false); }}>
          <div className="grid two mini-gap">
            <input placeholder="配置名称" value={storageForm.name} onChange={(event) => setStorageForm((v) => ({ ...v, name: event.target.value }))} required />
            <select value={storageForm.provider} onChange={(event) => setStorageForm((v) => ({ ...v, provider: event.target.value }))}>
              <option value="local">本地存储 (Local)</option>
              <option value="s3">Amazon S3</option>
              <option value="minio">MinIO</option>
              <option value="oss">阿里云 OSS</option>
              <option value="cos">腾讯云 COS</option>
            </select>
          </div>
          <div className="grid two mini-gap">
            <input placeholder="Endpoint" value={storageForm.endpoint} onChange={(event) => setStorageForm((v) => ({ ...v, endpoint: event.target.value }))} />
            <input placeholder="Region" value={storageForm.region} onChange={(event) => setStorageForm((v) => ({ ...v, region: event.target.value }))} />
          </div>
          <input placeholder="Bucket / 本地目录前缀" value={storageForm.bucket} onChange={(event) => setStorageForm((v) => ({ ...v, bucket: event.target.value }))} required />
          <div className="grid two mini-gap">
            <input placeholder="Access Key" value={storageForm.accessKey} onChange={(event) => setStorageForm((v) => ({ ...v, accessKey: event.target.value }))} />
            <input type="password" placeholder="Secret Key" value={storageForm.secretKey} onChange={(event) => setStorageForm((v) => ({ ...v, secretKey: event.target.value }))} />
          </div>
          <textarea
            placeholder='额外配置 (JSON)，例如 {"path_style": true}'
            value={storageForm.extraConfig}
            onChange={(event) => setStorageForm((v) => ({ ...v, extraConfig: event.target.value }))}
            rows={2}
          />
          <div className="grid two mini-gap">
            <label className="check">
              <input type="checkbox" checked={storageForm.pathStyle} onChange={(event) => setStorageForm((v) => ({ ...v, pathStyle: event.target.checked }))} />
              <span>Path Style</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={storageForm.isDefault} onChange={(event) => setStorageForm((v) => ({ ...v, isDefault: event.target.checked }))} />
              <span>设为默认配置</span>
            </label>
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              <Plus size={18} />
              <span>创建配置</span>
            </button>
            <button className="btn ghost" type="button" onClick={() => setShowConfigModal(false)}>
              取消
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showUploadModal} title="上传对象" subtitle={`上传到命名空间：${selectedNamespace?.name || ""}`} onClose={() => setShowUploadModal(false)}>
        <form className="form-grid compact" onSubmit={(event) => { onUploadObject(event); setShowUploadModal(false); }}>
          <input placeholder="对象键（不填则使用文件名）" value={objectForm.key} onChange={(event) => setObjectForm((v) => ({ ...v, key: event.target.value }))} />
          <input placeholder="Content-Type（可选）" value={objectForm.contentType} onChange={(event) => setObjectForm((v) => ({ ...v, contentType: event.target.value }))} />
          <input
            placeholder='metadata JSON（可选），例如 {"env":"dev"}'
            value={objectForm.metadata}
            onChange={(event) => setObjectForm((v) => ({ ...v, metadata: event.target.value }))}
          />
          <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} required />
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy || !selectedNamespaceID}>
              上传对象
            </button>
            <button className="btn ghost" type="button" onClick={() => setShowUploadModal(false)}>
              取消
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确认删除"
        subtitle={deleteTarget ? `即将删除：${deleteTarget.label}` : ""}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        confirmText="确认删除"
        cancelText="取消"
        danger
      />

      <ConfirmDialog
        open={Boolean(rollbackTarget)}
        title="确认回滚版本"
        subtitle={rollbackTarget ? `将回滚到版本：${rollbackTarget}` : ""}
        note="回滚后会生成新的最新版本，并保留历史版本。"
        kind="warning"
        changes={
          rollbackTarget
            ? [
                { label: "目标版本", beforeText: "当前最新", afterText: rollbackTarget },
                { label: "回滚结果", beforeText: "当前版本生效", afterText: "目标版本恢复为最新" },
              ]
            : []
        }
        busy={busy}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={executeRollback}
        confirmText="确认回滚"
        cancelText="取消"
      />
    </section>
  );
}
