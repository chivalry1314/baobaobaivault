"use client";

import Link from "next/link";

import { AuthRedirect } from "@/components/share/auth-redirect";
import { useShareSession } from "@/components/share/session-provider";
import { SystemWorkspace } from "@/components/share/system-shell/index";

export function ShareSystemHome() {
  const { user, sessionChecking } = useShareSession();

  if (sessionChecking) {
    return <SystemStateView currentPath="/system" text="正在检查系统管理权限..." />;
  }

  if (!user) {
    return <AuthRedirect nextPath="/system" />;
  }

  if (!user.isConfiguredSuperAdmin) {
    return (
      <SystemStateView
        currentPath="/system"
        title="系统管理"
        text="当前账号不是系统初始化超级管理员，暂时无法访问系统管理专区。"
      />
    );
  }

  return (
    <SystemWorkspace
      currentPath="/system"
      title="系统总览"
      description="这里集中承载系统级后台能力。你可以从左侧菜单进入存储配置、命名空间、对象管理、操作审计、访问密钥、角色权限、用户管理和认证设置。"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SystemCard
          title="存储配置"
          description="统一管理本地、OSS、S3、MinIO 等第三方存储配置。"
          href="/system/storage"
        />
        <SystemCard
          title="命名空间"
          description="管理命名空间、容量配额、路径前缀与绑定的存储配置。"
          href="/system/namespaces"
        />
        <SystemCard
          title="对象管理"
          description="浏览对象、上传下载、版本回滚，以及预签名调试能力。"
          href="/system/objects"
        />
        <SystemCard
          title="操作审计"
          description="筛选系统操作日志，回溯变更并定位平台问题。"
          href="/system/audit"
        />
        <SystemCard
          title="访问密钥"
          description="管理平台管理员账号的 AK/SK，用于程序化访问。"
          href="/system/access-keys"
        />
        <SystemCard
          title="角色权限"
          description="管理系统角色、权限绑定以及命名空间作用范围。"
          href="/system/roles"
        />
        <SystemCard
          title="用户管理"
          description="管理站点用户角色，并对违规或停用账号执行注销。"
          href="/system/users"
        />
        <SystemCard
          title="认证设置"
          description="集中维护邮箱注册策略、SMTP 发信健康状态和测试发信。"
          href="/system/auth-settings"
        />
      </section>
    </SystemWorkspace>
  );
}

function SystemCard(props: { title: string; description: string; href: string }) {
  const { title, description, href } = props;
  return (
    <article className="dream-panel-soft rounded-[28px] px-5 py-5">
      <h3 className="text-lg font-black text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-sm font-bold leading-7 text-[var(--foreground)]/68">{description}</p>
      <div className="mt-5">
        <Link href={href} className="btn-primary inline-flex rounded-full px-4 py-2 text-sm font-black">
          进入
        </Link>
      </div>
    </article>
  );
}

function SystemStateView(props: { currentPath: string; text: string; title?: string }) {
  const { currentPath, text, title = "系统管理" } = props;
  return (
    <SystemWorkspace currentPath={currentPath} title={title} description={text}>
      <div className="dream-panel px-6 py-8 text-sm font-bold text-[var(--foreground)]/70">{text}</div>
    </SystemWorkspace>
  );
}
