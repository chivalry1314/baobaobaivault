# Share 邮箱验证码注册部署说明

本文档用于说明如何为 `sharefrontend` / `backend` 部署真实邮箱验证码注册能力。

## 目标

开启后：

- 新用户必须先完成邮箱验证码校验，才能真正创建账号
- `/api/share/auth/continue` 不再自动创建账号
- 未完成邮箱验证的用户不能建立有效的 share 会话

关闭后：

- 保持当前简化模式，注册后直接创建并登录

## 相关配置文件

- 本地模板：`backend/config/config.example.yaml`
- 公网部署模板：`deploy/backend/config.public.example.yaml`

现在不再提供单独的阿里云专用配置模板。
无论你使用哪家 SMTP 服务，都统一基于上面两份模板填写 `email.*` 字段。

## 必要配置

核心开关：

- `share_auth.email_verification_enabled`

SMTP 配置：

- `email.enabled`
- `email.from_name`
- `email.from_address`
- `email.smtp_host`
- `email.smtp_port`
- `email.smtp_username`
- `email.smtp_password`

Share 认证调优项：

- `share_auth.verification_code_ttl_seconds`
- `share_auth.resend_interval_seconds`
- `share_auth.max_verify_attempts`

## 推荐生产配置示例

```yaml
server:
  mode: release
  admin_email: "admin@your-domain.com"

email:
  enabled: true
  from_name: "CardShare"
  from_address: "noreply@your-domain.com"
  smtp_host: "smtp.exmail.qq.com"
  smtp_port: 587
  smtp_username: "noreply@your-domain.com"
  smtp_password: "your-smtp-app-password"

share_auth:
  email_verification_enabled: true
  verification_code_ttl_seconds: 600
  resend_interval_seconds: 60
  max_verify_attempts: 5
```

## SMTP 说明

- `587` 一般表示 `STARTTLS`
- `465` 一般表示隐式 `SSL`
- 很多邮件服务商要求使用“应用专用密码”或 “SMTP 授权码”，而不是邮箱登录密码
- `email.from_address` 通常应与服务商后台已验证的发件地址保持一致
- `email.smtp_username` 通常就是完整邮箱地址

## 阿里云邮件推送 SMTP 示例

如果你的用户主要在中国大陆，阿里云邮件推送通常是当前项目里成本较低、接入最顺手的方案，因为后端已经走标准 SMTP 流程，不需要为服务商单独改代码。

阿里云常用 SMTP 信息：

- 中国站 SMTP 主机：`smtpdm.aliyun.com`
- 常见端口：`25`、`80`、`465`
- `465` 对应 SSL
- `80` 可用于非隐式 SSL，阿里云文档也说明可在 `25` 或 `80` 上使用 `STARTTLS`

推荐在本项目中优先这样配置：

```yaml
server:
  admin_email: "admin@your-domain.com"

email:
  enabled: true
  from_name: "CardShare"
  from_address: "noreply@your-domain.com"
  smtp_host: "smtpdm.aliyun.com"
  smtp_port: 465
  smtp_username: "noreply@your-domain.com"
  smtp_password: "your-aliyun-smtp-password"

share_auth:
  email_verification_enabled: true
```

阿里云接入步骤建议：

1. 在阿里云开通邮件推送。
2. 添加并验证发信域名。
3. 创建发信地址，例如 `noreply@your-domain.com`。
4. 在控制台为该地址设置 SMTP 密码。
5. 按阿里云要求补齐 DNS 记录，通常至少包括 SPF 和 DKIM。
6. 把配置填入后端后，先发一封 SMTP 测试邮件，再开启邮箱验证码注册。

阿里云注意点：

- `smtp_username` 要填写完整发信地址
- `smtp_password` 填的是阿里云里的 SMTP 密码，不是阿里云账号登录密码
- 如果当前环境对 `465` 有限制，可以尝试 `80`
- 最终以你在阿里云控制台实际启用的区域和文档为准

## 推荐启用顺序

1. 准备专用发件邮箱，例如 `noreply@your-domain.com`。
2. 在邮件服务商后台完成发件人验证或域名验证。
3. 如果服务商要求，确认 SPF / DKIM / DMARC 已配置。
4. 先填好 SMTP 配置，但暂时保持 `share_auth.email_verification_enabled=false`。
5. 先部署后端，并确保 `email.enabled=true`。
6. 在创作者中心的“系统设置”里发送 SMTP 测试邮件。前端可直接填写测试收件地址；如果留空，后端会回退到 `server.admin_email`。
7. 用真实邮箱手动测试 `/login` 页的注册流程。
8. 确认重发冷却、验证码过期、验证码错误等行为正常。
9. 确认邮件不会稳定进入垃圾箱。
10. 最后再把 `share_auth.email_verification_enabled=true`。

## 开启后需要验证的内容

- `POST /api/share/auth/register`
  - 应返回 `verificationRequired=true`
- `POST /api/share/auth/register/verify`
  - 只有输入正确验证码后才真正创建账号
- `POST /api/share/auth/register/resend`
  - 应遵守重发冷却时间
- `POST /api/share/auth/continue`
  - 开启邮箱验证后不应再自动创建账号
- `GET /api/share/auth/config`
  - 应显示 `emailVerificationEnabled=true`
- `GET /api/share/auth/email-health`
  - 应返回当前 SMTP 摘要信息

## 已增加的管理能力

公开只读接口：

- `GET /api/share/auth/config`
- `GET /api/share/auth/email-health`

仅 `manager` 可调用的接口：

- `POST /api/share/auth/email-health/test`
  - 支持前端传入测试收件邮箱
  - 若前端留空，则回退到 `server.admin_email`
  - 同一后台用户有 60 秒冷却限制

## 系统内置的保护能力

- 验证邮件同时支持 HTML 和纯文本
- 重发验证码受 `share_auth.resend_interval_seconds` 控制
- SMTP 测试发信有每个管理员独立的频率限制
- 过期验证码会在运行过程中自动清理
- 已消费且陈旧的验证码记录会在运行时和启动迁移时清理
- 历史 share 用户会在迁移时自动补成已验证，避免开启后老用户被锁在门外

## 常见故障

`invalid email`

- 检查前端填写的 SMTP 测试收件邮箱格式是否正确
- 如果你准备留空测试收件人，请确认 `server.admin_email` 已正确配置

`email service is disabled`

- 设置 `email.enabled=true`

`share_auth.email_verification_enabled requires email.enabled = true`

- 先启用 SMTP，再开启邮箱验证码注册

`email verification requires email.smtp_host, email.smtp_port, and email.from_address`

- 先填完整必要 SMTP 字段，再打开邮箱验证

`smtp server does not support AUTH`

- 检查 SMTP 主机和端口组合是否正确
- 确认服务商要求的是 `465` 还是 `587`

收不到邮件：

- 先检查垃圾箱
- 查看服务商投递日志
- 检查发信地址和域名验证是否完成
- 检查是否使用了正确的 SMTP 授权码

`smtp test requested too frequently`

- 等待当前 60 秒冷却结束后再试

## 部署检查清单

- 后端配置已更新
- `server.admin_email` 已配置
- SMTP 测试邮件发送成功
- 真实注册验证码邮件发送成功
- 注册 / 验证 / 重发流程已确认
- 历史账号登录未受影响
- 前端系统设置页显示的邮箱验证状态符合预期
