import { Link } from "react-router-dom";
import Panel from "../components/Panel";

export default function NotFoundPage() {
  return (
    <section className="grid two">
      <Panel title="页面不存在" subtitle="你访问的页面已移除或地址有误">
        <p className="muted">请检查左侧菜单，或使用下方快捷入口返回。</p>
        <div className="toolbar-actions">
          <Link className="btn ghost" to="/app/overview">
            返回总览
          </Link>
          <Link className="btn ghost" to="/app/storage-objects">
            前往存储对象
          </Link>
          <Link className="btn ghost" to="/app/audit">
            前往审计日志
          </Link>
        </div>
      </Panel>
    </section>
  );
}
