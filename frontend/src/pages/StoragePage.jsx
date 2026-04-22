import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
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
    return storageConfigs.filter((c) =>
      [c.name, c.provider, c.bucket, c.endpoint, c.region].some((s) => String(s || "").toLowerCase().includes(q))
    );
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
      {showConfig && (
        <Panel title="存储配置" subtitle={`${storageConfigs.length} 条`}>
          <div className="section-header">
            <div className="search-bar">
              <Icons.Search size={16} />
              <input placeholder="搜索名称、Provider、Bucket..." value={configSearch} onChange={(e) => { setConfigSearch(e.target.value); setConfigPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowConfigModal(true)}>
              <Icons.Plus size={16} />
              新增配置
            </button>
          </div>

          {pagedConfigs.length > 0 ? (
            <>
              <div className="mini-table">
                {pagedConfigs.map((x) => (
                  <div className="mini-row" key={x.id}>
                    <div>
                      <strong>{x.name} ({x.provider})</strong>
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
              <Icons.HardDrive size={40} />
              <p>{configSearch ? "没有匹配的配置" : "暂无存储配置，点击新增"}</p>
            </div>
          )}
        </Panel>
      )}

      {showObjects && (
        <Panel title="对象管理" subtitle={selectedNamespace ? `命名空间：${selectedNamespace.name}` : "请先选择命名空间"} delay={120}>
          <div className="section-header">
            <div className="search-bar">
              <Icons.Search size={16} />
              <input placeholder="搜索对象键..." value={objectSearch} onChange={(e) => { setObjectSearch(e.target.value); setObjectPage(1); }} />
            </div>
            <button className="btn small primary" type="button" onClick={() => setShowUploadModal(true)} disabled={!selectedNamespaceID}>
              <Icons.Upload size={16} />
              上传对象
            </button>
          </div>

          <div className="form-grid compact spaced-block">
            <select
              value={selectedNamespaceID}
              onChange={(e) => {
                setSelectedNamespaceID(e.target.value);
                setSelectedObjectKey("");
                setObjectVersions([]);
                setPresignPutInfo(null);
              }}
            >
              <option value="">选择命名空间</option>
              {namespaces.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            <div className="inline">
              <input placeholder="前缀" value={objectPrefix} onChange={(e) => setObjectPrefix(e.target.value)} />
              <button className="btn ghost" type="button" onClick={() => void loadObjects(selectedNamespaceID, objectPrefix)} disabled={busy}>查询</button>
            </div>
          </div>

          <div className="toolbar-actions spaced-block">
            <button className="btn small ghost" type="button" onClick={() => void onPresignPut()} disabled={busy || !selectedNamespaceID}>预签名上传</button>
            <button className="btn small ghost" type="button" onClick={() => void onCompletePresignPut()} disabled={busy || !selectedNamespaceID || !presignPutInfo}>回写预签名</button>
          </div>

          {presignUrl ? (
            <div className="secret-box">
              <p>预签名下载地址（5 分钟）</p>
              <a href={presignUrl} target="_blank" rel="noreferrer">{presignUrl}</a>
            </div>
          ) : null}

          {presignPutInfo ? (
            <div className="secret-box">
              <p>预签名上传地址（5 分钟）</p>
              <a href={presignPutInfo.url} target="_blank" rel="noreferrer">{presignPutInfo.url}</a>
              <code>键：{presignPutInfo.key}</code>
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
                      <button className="btn small ghost" type="button" onClick={() => void onDownloadObject(x)}>下载</button>
                      <button className="btn small ghost" type="button" onClick={() => void onViewVersions(x)}>版本</button>
                      <button className="btn small ghost" type="button" onClick={() => void onPresign(x)}>预签名</button>
                      <button className="btn small danger" type="button" onClick={() => confirmDelete("object", x.id, x.key)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination total={filteredObjects.length} page={objectPage} onChange={setObjectPage} />
            </>
          ) : (
            <div className="empty-state">
              <Icons.FileSearch size={40} />
              <p>{objectSearch ? "没有匹配的对象" : selectedNamespaceID ? "该命名空间下暂无对象" : "请先选择命名空间"}</p>
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
                      <button className="btn small ghost" type="button" onClick={() => setRollbackTarget(x.version_id)}>恢复备份</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      )}

      {/* ── 存储配置创建弹窗 ── */}
      <Modal open={showConfigModal} title="新增存储配置" subtitle="添加一个新的存储后端" onClose={() => setShowConfigModal(false)}>
        <form className="form-grid compact" onSubmit={(e) => { onCreateStorageConfig(e); setShowConfigModal(false); }}>
          <div className="grid two mini-gap">
            <input placeholder="显示名称" value={storageForm.name} onChange={(e) => setStorageForm((v) => ({ ...v, name: e.target.value }))} required />
            <select value={storageForm.provider} onChange={(e) => setStorageForm((v) => ({ ...v, provider: e.target.value }))}>
              <option value="local">本地存储 (Local)</option>
              <option value="s3">Amazon S3</option>
              <option value="minio">MinIO</option>
              <option value="oss">阿里云 OSS</option>
              <option value="cos">腾讯云 COS</option>
            </select>
          </div>
          <div className="grid two mini-gap">
            <input placeholder="访问端点 (Endpoint)" value={storageForm.endpoint} onChange={(e) => setStorageForm((v) => ({ ...v, endpoint: e.target.value }))} />
            <input placeholder="区域 (Region)" value={storageForm.region} onChange={(e) => setStorageForm((v) => ({ ...v, region: e.target.value }))} />
          </div>
          <input placeholder="存储桶名称 / 基础路径 (Bucket)" value={storageForm.bucket} onChange={(e) => setStorageForm((v) => ({ ...v, bucket: e.target.value }))} required />
          <div className="grid two mini-gap">
            <input placeholder="访问密钥 (Access Key)" value={storageForm.accessKey} onChange={(e) => setStorageForm((v) => ({ ...v, accessKey: e.target.value }))} />
            <input type="password" placeholder="安全密钥 (Secret Key)" value={storageForm.secretKey} onChange={(e) => setStorageForm((v) => ({ ...v, secretKey: e.target.value }))} />
          </div>
          <textarea placeholder='额外配置 (JSON)，例如 {"path_style": true}' value={storageForm.extraConfig} onChange={(e) => setStorageForm((v) => ({ ...v, extraConfig: e.target.value }))} rows={2} />
          <div className="grid two mini-gap">
            <label className="check">
              <input type="checkbox" checked={storageForm.pathStyle} onChange={(e) => setStorageForm((v) => ({ ...v, pathStyle: e.target.checked }))} />
              <span>路径风格</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={storageForm.isDefault} onChange={(e) => setStorageForm((v) => ({ ...v, isDefault: e.target.checked }))} />
              <span>设为默认</span>
            </label>
          </div>
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              <Icons.Plus size={18} />
              <span>保存配置</span>
            </button>
            <button className="btn ghost" type="button" onClick={() => setShowConfigModal(false)}>取消</button>
          </div>
        </form>
      </Modal>

      {/* ── 对象上传弹窗 ── */}
      <Modal open={showUploadModal} title="上传对象" subtitle={`上传到命名空间：${selectedNamespace?.name || ""}`} onClose={() => setShowUploadModal(false)}>
        <form className="form-grid compact" onSubmit={(e) => { onUploadObject(e); setShowUploadModal(false); }}>
          <input placeholder="对象键（可选，默认文件名）" value={objectForm.key} onChange={(e) => setObjectForm((v) => ({ ...v, key: e.target.value }))} />
          <input placeholder="内容类型（可选）" value={objectForm.contentType} onChange={(e) => setObjectForm((v) => ({ ...v, contentType: e.target.value }))} />
          <input placeholder='元数据 JSON（可选），例如 {"env":"dev"}' value={objectForm.metadata} onChange={(e) => setObjectForm((v) => ({ ...v, metadata: e.target.value }))} />
          <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy || !selectedNamespaceID}>上传对象</button>
            <button className="btn ghost" type="button" onClick={() => setShowUploadModal(false)}>取消</button>
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
        title="确认恢复选中备份"
        subtitle={rollbackTarget ? `将对象恢复到版本：${rollbackTarget}` : ""}
        note="恢复后，当前最新版本会保留为历史版本，数据不会被永久删除。"
        kind="warning"
        changes={
          rollbackTarget
            ? [
                { label: "目标版本", beforeText: "当前最新", afterText: rollbackTarget },
                { label: "恢复策略", beforeText: "直接覆盖", afterText: "保留历史并恢复" },
              ]
            : []
        }
        busy={busy}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={executeRollback}
        confirmText="确认恢复"
        cancelText="取消"
      />
    </section>
  );
}
