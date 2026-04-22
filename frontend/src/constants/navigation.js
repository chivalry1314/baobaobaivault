export const navItems = [
  { key: "overview", to: "/app/overview", label: "控制台总览", iconName: "LayoutDashboard" },
  {
    key: "group-iam",
    label: "身份与访问控制",
    iconName: "ShieldCheck",
    children: [
      { key: "iam-users", to: "/app/iam-users", label: "用户管理", iconName: "Users" },
      { key: "iam-roles", to: "/app/iam-roles", label: "角色权限", iconName: "Key" },
      { key: "iam-namespaces", to: "/app/iam-namespaces", label: "命名空间", iconName: "Layers" },
    ],
  },
  {
    key: "group-storage",
    label: "数据存储引擎",
    iconName: "Database",
    children: [
      { key: "storage-config", to: "/app/storage-config", label: "存储适配器", iconName: "HardDrive" },
      { key: "storage-objects", to: "/app/storage-objects", label: "对象浏览器", iconName: "FileSearch" },
    ],
  },
  {
    key: "group-operations",
    label: "运维与审计",
    iconName: "Activity",
    children: [
      { key: "audit", to: "/app/audit", label: "操作审计", iconName: "History" },
      { key: "tenant", to: "/app/tenant", label: "租户配置", iconName: "Building2" },
    ],
  },
  {
    key: "group-account",
    label: "个人账户",
    iconName: "UserCircle",
    children: [
      { key: "profile", to: "/app/profile", label: "基本资料", iconName: "User" },
      { key: "account", to: "/app/account", label: "账号安全", iconName: "Lock" },
    ],
  },
  { key: "settings", to: "/app/settings", label: "系统设置", iconName: "Settings" },
];

const leafItems = navItems.flatMap((item) => (Array.isArray(item.children) ? item.children : [item]));

export const validAppPages = [...leafItems.map((item) => item.key), "not-found"];
