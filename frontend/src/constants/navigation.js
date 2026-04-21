export const navItems = [
  { key: "overview", to: "/app/overview", label: "总览", icon: "⬡" },
  { key: "profile", to: "/app/profile", label: "个人中心", icon: "◉" },
  { key: "account", to: "/app/account", label: "账号安全", icon: "⚿" },
  { key: "iam", to: "/app/iam", label: "身份权限", icon: "⊞" },
  { key: "storage", to: "/app/storage", label: "存储对象", icon: "▦" },
  { key: "audit", to: "/app/audit", label: "审计日志", icon: "≡" },
  { key: "tenant", to: "/app/tenant", label: "租户管理", icon: "⌂" },
  { key: "settings", to: "/app/settings", label: "系统设置", icon: "⚙" },
];

export const validAppPages = [...navItems.map((item) => item.key), "not-found"];
