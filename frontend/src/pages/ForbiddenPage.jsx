import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import Panel from "../components/Panel";

export default function ForbiddenPage({ fallbackRoute = "/app/overview" }) {
  return (
    <section className="grid two">
      <Panel title="无权限访问" subtitle="当前账号没有访问该页面所需的权限">
        <div style={{ display: "grid", gap: "12px" }}>
          <p className="muted" style={{ margin: 0 }}>
            请联系管理员为你分配对应角色，或返回到你当前有权限访问的页面。
          </p>
          <div className="toolbar-actions">
            <Link className="btn primary" to={fallbackRoute}>
              <ArrowLeft size={16} />
              返回可访问页面
            </Link>
            <Link className="btn ghost" to="/app/overview">
              <LayoutDashboard size={16} />
              返回总览
            </Link>
          </div>
        </div>
      </Panel>
    </section>
  );
}
