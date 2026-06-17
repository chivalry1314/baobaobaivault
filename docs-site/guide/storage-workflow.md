# 存储到媒体上传操作手册

这份手册专门说明 `sharefrontend` 里对象存储相关功能的完整使用链路：

1. 创建存储配置
2. 创建命名空间
3. 配置媒体存储开关
4. 验证卡片上传、预览和下载

适用场景：

- 阿里云 OSS
- Amazon S3
- MinIO
- 腾讯云 COS

下面默认以阿里云 OSS 为例说明。

## 1. 总体关系

这套系统里，几块功能的关系是：

- `存储配置`
  - 定义如何连接对象存储
  - 包括 Provider、Endpoint、Region、Bucket、AK/SK
- `命名空间`
  - 定义对象逻辑隔离、路径前缀、容量配额
  - 每个命名空间可以绑定一个存储配置
- `媒体存储`
  - 决定分享卡片的新上传封面和附件写到哪里
  - 可以切本地，也可以切对象存储
- `卡片上传`
  - 真正验证媒体链路是否生效

一句话理解：

- 存储配置解决“连到哪”
- 命名空间解决“怎么分区”
- 媒体存储解决“新文件写哪边”

## 2. 第一步：创建存储配置

进入：

- `系统管理 -> 存储配置`

点击：

- `新增配置`

阿里云 OSS 常见填写方式：

- `配置名称`
  - 例如：`阿里云 OSS 主存储`
- `Provider`
  - 选择 `阿里云 OSS`
  - 实际值是 `oss`
- `Endpoint`
  - 例如：`oss-cn-hangzhou.aliyuncs.com`
- `Region`
  - 例如：`cn-hangzhou`
- `Bucket`
  - 例如：`my-share-assets`
- `Access Key`
  - 填 `AccessKey ID`
- `Secret Key`
  - 填 `AccessKey Secret`
- `Path Style`
  - 阿里 OSS 一般保持关闭
- `设为默认配置`
  - 如果这是主存储，可以开启

注意：

- `Access Key` 对应阿里云 `AccessKey ID`
- `Secret Key` 对应阿里云 `AccessKey Secret`
- 建议使用 RAM 子账号，不要直接用主账号 AK/SK

## 3. 第二步：创建命名空间

进入：

- `系统管理 -> 命名空间`

点击：

- `新增命名空间`

推荐至少建两个命名空间：

1. 封面命名空间
2. 附件命名空间

推荐示例：

### 封面命名空间

- `命名空间名称`
  - `share-card-covers`
- `描述`
  - `卡片封面图片`
- `绑定存储配置`
  - 选择刚才创建的阿里云 OSS 配置
- `路径前缀`
  - `share/covers`
- `最大存储字节数`
  - 可留空
- `最大文件数`
  - 可留空
- `单文件最大字节数`
  - 可按你的封面图限制设置

### 附件命名空间

- `命名空间名称`
  - `share-card-assets`
- `描述`
  - `卡片附件文件`
- `绑定存储配置`
  - 选择同一个 OSS 配置
- `路径前缀`
  - `share/assets`
- `最大存储字节数`
  - 可留空
- `最大文件数`
  - 可留空
- `单文件最大字节数`
  - 可按附件大小限制设置

说明：

- `路径前缀` 是对象 Key 的业务前缀，不是 Bucket
- `绑定存储配置` 决定命名空间实际落到哪个对象存储

## 4. 第三步：配置媒体存储

进入：

- `系统管理 -> 媒体存储`

你会看到几项：

- `存储模式`
- `本地回退`
- `封面命名空间`
- `附件命名空间`

推荐切换方式：

### 切换前

- `存储模式`：`local`
- `本地回退`：开启

### 切换到 OSS

- `存储模式`：切到 `object_storage`
- `本地回退`：保持开启
- `封面命名空间`：选择 `share-card-covers`
- `附件命名空间`：选择 `share-card-assets`

然后点击：

- `保存媒体存储设置`

### 4.1 浏览器直传 OSS 的前置检查

> 仅当“存储模式”为 `object_storage` 时需要关注。

当前 `object_storage` 模式采用浏览器直传 OSS：后端返回 presign URL，浏览器直接把文件 PUT 到 OSS，上传完成后再调用 complete 接口落库。因此除了系统管理里的配置，还要确认对象存储侧：

- **Bucket CORS**
  - 生产来源：`https://你的域名`
  - 本地测试来源：`http://localhost:3002`
  - Allowed Methods：`GET`、`PUT`、`POST`、`HEAD`
  - Allowed Headers：`Content-Type`、`*`
  - Exposed Headers：`ETag`
  - 缓存时间：`300`
- **RAM 权限**
  - 后端 RAM 子账号至少拥有 `oss:PutObject`、`oss:GetObject`、`oss:DeleteObject`、`oss:ListObjects`
- **IP 白名单**
  - 如果使用 `acs:SourceIp` 限制访问来源，本地测试阶段需要把后端服务器 IP 和本地开发机 IP 都加入白名单，否则浏览器直传会报 `403 AccessDenied`

详细示例参见 [Share 媒体文件切换到 OSS 指南](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)。

## 5. 第四步：验证对象链路

建议按下面顺序验证。

### 5.1 验证对象上传能力

进入：

- `系统管理 -> 对象管理`
- 再点击 `上传对象`

测试：

1. 选择一个命名空间
2. 直接上传一个小文件
3. 返回对象列表
4. 确认能看到对象
5. 点击下载
6. 点击版本
7. 点击预签名下载

如果这一步就失败，问题通常在：

- AK/SK 不对
- Endpoint 不对
- Bucket 不对
- OSS 权限不够

### 5.2 验证卡片封面上传

进入创作者后台，创建新卡片并上传封面。

确认：

- 卡片列表能看到封面
- 卡片详情页封面能正常预览

### 5.3 验证卡片附件上传

上传一个或多个卡片附件。

确认：

- 附件上传成功
- 附件下载正常
- 详情页相关资源可访问

## 6. 推荐的上线顺序

如果你是第一次切 OSS，推荐按这个顺序来：

1. 先创建并验证存储配置
2. 再创建命名空间
3. 先在对象管理里手工上传测试文件
4. 再切媒体存储到 `object_storage`
5. 再上传新卡片测试
6. 观察一段时间后，再考虑历史文件迁移

## 7. 常见问题排查

### 7.1 存储配置能保存，但对象上传失败

优先检查：

- Endpoint 是否写错
- Bucket 是否写错
- AK/SK 是否写错
- OSS RAM 权限是否足够

### 7.2 对象管理能上传，但卡片封面还是走本地

优先检查：

- `系统管理 -> 媒体存储` 是否真的保存成 `object_storage`
- 封面命名空间是否已选择
- 附件命名空间是否已选择

### 7.3 切到 OSS 后老卡片还能不能访问

可以，只要：

- 本地文件还在
- `本地回退` 还是开启

### 7.4 修改 OSS 配置会不会把旧密钥清掉

现在不会。

在 `系统管理 -> 存储配置 -> 修改` 页面：

- `Access Key` 留空 = 保持原值
- `Secret Key` 留空 = 保持原值

### 7.5 删除存储配置时报“已被命名空间使用”

这是正常保护机制。

你需要先：

1. 去命名空间页面解绑或改绑其他存储配置
2. 再删除该存储配置

### 7.6 切到 OSS 后浏览器直传报 403 AccessDenied

常见原因：

- RAM Policy 里 `acs:SourceIp` 只放行后端服务器 IP，没放行本地开发机 IP
- Bucket CORS 来源写错，例如本地测试时没写 `http://localhost:3002`
- RAM 子账号缺少 `oss:PutObject` 权限

### 7.7 切到 OSS 后对象能上传但卡片预览 404

在浏览器直传流程里，如果后端没有成功调用 complete，对象的元数据就不会写入 `objects` / `object_versions` 表，预览时就会 404。请确认：

- 前端上传成功后确实调用了 complete 接口
- complete 接口没有报错
- 后端版本已包含对象元数据 finalize 逻辑

## 8. 阿里云 OSS 推荐做法

推荐：

- 使用 RAM 子账号
- 只授权目标 Bucket
- 不要直接用主账号 AK/SK
- 初期保留本地回退
- 封面和附件分两个命名空间

## 9. 最后建议

如果你准备正式上线，推荐同时搭配这几份文档一起看：

- [最小生产配置清单](./DEPLOY_CHECKLIST.zh-CN.md)
- [中文部署文档](./README.zh-CN.md)
- [Share 媒体文件切换到 OSS 指南](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY_ZH.md)
- [邮箱验证中文说明](./backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH.md)
