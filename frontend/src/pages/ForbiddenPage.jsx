import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import Panel from "../components/Panel";

export default function ForbiddenPage({ fallbackRoute = "/app/overview" }) {
  return (
    <section className="grid two">
      <Panel title="无权限访问" subtitle="当前账号没有该页面的访问权限">
        <div style={{ display: "grid", gap: "12px" }}>
          <p className="muted" style={{ margin: 0 }}>
            请联系租户管理员分配相应权限，或返回你有访问权限的功能页面。
          </p>
          <div className="toolbar-actions">
            <Link className="btn primary" to={fallbackRoute}>
              <Icons.ArrowLeft size={16} />
              返回可用页面
            </Link>
            <Link className="btn ghost" to="/app/overview">
              <Icons.LayoutDashboard size={16} />
              前往总览
            </Link>
          </div>
        </div>
      </Panel>
    </section>
  );
}
