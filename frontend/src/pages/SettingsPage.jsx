import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { defaultUiSettings, readUiSettings, saveUiSettings } from "../utils/uiSettings";

export default function SettingsPage({ apiBase, busy, onSaved, onRefreshNow }) {
  const [form, setForm] = useState(defaultUiSettings);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setForm(readUiSettings());
  }, []);

  function notifySaved(payload) {
    setSavedAt(new Date().toLocaleString());
    if (typeof onSaved === "function") {
      onSaved(payload);
    }
  }

  function onSave(event) {
    event.preventDefault();
    const payload = saveUiSettings(form);
    setForm(payload);
    notifySaved(payload);
  }

  function onResetDefaults() {
    const payload = saveUiSettings(defaultUiSettings);
    setForm(payload);
    notifySaved(payload);
  }

  return (
    <section className="grid two">
      <Panel title="系统设置" subtitle="前端界面偏好与刷新策略">
        <form className="form-grid" onSubmit={onSave}>
          <label className="check">
            <input
              type="checkbox"
              checked={form.compactNav}
              onChange={(e) => setForm((v) => ({ ...v, compactNav: e.target.checked }))}
            />
            启用紧凑侧边栏模式
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.enableAutoRefresh}
              onChange={(e) => setForm((v) => ({ ...v, enableAutoRefresh: e.target.checked }))}
            />
            启用自动刷新
          </label>
          <input
            type="number"
            min="1"
            value={form.refreshMinutes}
            onChange={(e) => setForm((v) => ({ ...v, refreshMinutes: e.target.value }))}
            placeholder="自动刷新间隔（分钟）"
            disabled={!form.enableAutoRefresh}
          />

          <div className="toolbar-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              保存设置
            </button>
            <button className="btn ghost" type="button" onClick={onResetDefaults} disabled={busy}>
              恢复默认
            </button>
            <button className="btn ghost" type="button" onClick={() => typeof onRefreshNow === "function" && onRefreshNow()} disabled={busy}>
              立即刷新一次
            </button>
          </div>
        </form>
        {savedAt ? <p className="muted">最近保存时间：{savedAt}</p> : null}
      </Panel>

      <Panel title="系统信息" subtitle="运行环境与接口配置" delay={120}>
        <ul className="kv-list">
          <li>
            <span>接口地址</span>
            <code>{apiBase}</code>
          </li>
          <li>
            <span>运行端</span>
            <strong>Web 控制台</strong>
          </li>
          <li>
            <span>配置存储</span>
            <strong>浏览器 localStorage</strong>
          </li>
        </ul>
      </Panel>
    </section>
  );
}
