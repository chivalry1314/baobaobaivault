import Panel from "../components/Panel";

export default function StoragePage({
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
  return (
    <section id="section-storage" className="grid two">
      <Panel title="存储配置" subtitle={`${storageConfigs.length} 条`}>
        <form className="form-grid compact" onSubmit={onCreateStorageConfig}>
          <input placeholder="名称" value={storageForm.name} onChange={(e) => setStorageForm((v) => ({ ...v, name: e.target.value }))} required />
          <select value={storageForm.provider} onChange={(e) => setStorageForm((v) => ({ ...v, provider: e.target.value }))}>
            <option value="local">本地</option>
            <option value="s3">s3</option>
            <option value="minio">minio</option>
            <option value="oss">oss</option>
            <option value="cos">cos</option>
          </select>
          <input placeholder="访问端点" value={storageForm.endpoint} onChange={(e) => setStorageForm((v) => ({ ...v, endpoint: e.target.value }))} />
          <input placeholder="区域" value={storageForm.region} onChange={(e) => setStorageForm((v) => ({ ...v, region: e.target.value }))} />
          <input
            placeholder="存储桶 / 基础目录"
            value={storageForm.bucket}
            onChange={(e) => setStorageForm((v) => ({ ...v, bucket: e.target.value }))}
            required
          />
          <input
            placeholder="访问密钥（access_key）"
            value={storageForm.accessKey}
            onChange={(e) => setStorageForm((v) => ({ ...v, accessKey: e.target.value }))}
          />
          <input
            placeholder="密钥（secret_key）"
            value={storageForm.secretKey}
            onChange={(e) => setStorageForm((v) => ({ ...v, secretKey: e.target.value }))}
          />
          <textarea
            placeholder='额外配置 JSON，例如 {"foo":"bar"}'
            value={storageForm.extraConfig}
            onChange={(e) => setStorageForm((v) => ({ ...v, extraConfig: e.target.value }))}
          />
          <label className="check">
            <input type="checkbox" checked={storageForm.pathStyle} onChange={(e) => setStorageForm((v) => ({ ...v, pathStyle: e.target.checked }))} />
            路径风格 (path_style)
          </label>
          <label className="check">
            <input type="checkbox" checked={storageForm.isDefault} onChange={(e) => setStorageForm((v) => ({ ...v, isDefault: e.target.checked }))} />
            默认配置
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            创建配置
          </button>
        </form>
        <div className="mini-table">
          {storageConfigs.map((x) => (
            <div className="mini-row" key={x.id}>
              <div>
                <strong>
                  {x.name} ({x.provider})
                </strong>
                <small>{x.bucket}</small>
              </div>
              <button className="btn small danger" type="button" onClick={() => void onDeleteStorageConfig(x.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="对象管理" subtitle={selectedNamespace ? `命名空间：${selectedNamespace.name}` : "请先选择命名空间"} delay={120}>
        <div className="form-grid compact">
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
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <div className="inline">
            <input placeholder="前缀" value={objectPrefix} onChange={(e) => setObjectPrefix(e.target.value)} />
            <button className="btn ghost" type="button" onClick={() => void loadObjects(selectedNamespaceID, objectPrefix)} disabled={busy}>
              查询
            </button>
          </div>
        </div>

        <form className="form-grid compact" onSubmit={onUploadObject}>
          <input placeholder="对象键（可选）" value={objectForm.key} onChange={(e) => setObjectForm((v) => ({ ...v, key: e.target.value }))} />
          <input
            placeholder="内容类型（可选）"
            value={objectForm.contentType}
            onChange={(e) => setObjectForm((v) => ({ ...v, contentType: e.target.value }))}
          />
          <input
            placeholder='元数据 JSON（可选），例如 {"env":"dev"}'
            value={objectForm.metadata}
            onChange={(e) => setObjectForm((v) => ({ ...v, metadata: e.target.value }))}
          />
          <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
          <button className="btn primary" type="submit" disabled={busy || !selectedNamespaceID}>
            上传对象
          </button>
        </form>

        <div className="toolbar-actions">
          <button className="btn ghost" type="button" onClick={() => void onPresignPut()} disabled={busy || !selectedNamespaceID}>
            生成预签名上传地址
          </button>
          <button className="btn ghost" type="button" onClick={() => void onCompletePresignPut()} disabled={busy || !selectedNamespaceID || !presignPutInfo}>
            回写预签名上传
          </button>
        </div>

        {presignUrl ? (
          <div className="secret-box">
            <p>预签名下载地址（5 分钟）</p>
            <a href={presignUrl} target="_blank" rel="noreferrer">
              {presignUrl}
            </a>
          </div>
        ) : null}

        {presignPutInfo ? (
          <div className="secret-box">
            <p>预签名上传地址（5 分钟）</p>
            <a href={presignPutInfo.url} target="_blank" rel="noreferrer">
              {presignPutInfo.url}
            </a>
            <code>键：{presignPutInfo.key}</code>
            <code>版本：{presignPutInfo.version_id}</code>
          </div>
        ) : null}

        <div className="mini-table">
          {objects.map((x) => (
            <div className="mini-row object" key={x.id}>
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
                  预签名
                </button>
                <button className="btn small danger" type="button" onClick={() => void onDeleteObject(x)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedObjectKey ? (
          <div className="mini-table">
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
                    <button className="btn small ghost" type="button" onClick={() => void onRollbackVersion(x.version_id)}>
                      回滚
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
