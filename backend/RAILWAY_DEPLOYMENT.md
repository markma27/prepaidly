# Railway 部署指南

本指南将帮助您将 Prepaidly 后端部署到 Railway 平台。

## 前置要求

1. Railway 账户（免费注册：https://railway.app）
2. GitHub 仓库（代码已推送到 GitHub）
3. Supabase 数据库（已在本地配置）

## Railway 的优势

- ✅ **直接支持 Java**：自动检测 Java/Gradle 项目，无需 Docker
- ✅ **配置简单**：比 Render 更简单
- ✅ **免费额度**：每月 $5 免费额度
- ✅ **不会休眠**：免费计划也不会自动休眠

## 部署步骤

### 步骤 1: 创建 Railway 项目

1. 登录 Railway Dashboard：https://railway.app
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权 GitHub 访问（如果首次使用）
5. 选择 `prepaidly` 仓库

### 步骤 2: 配置服务

Railway 会自动检测到你的 Java/Gradle 项目。如果需要手动配置：

1. 在项目页面，Railway 会自动创建一个服务
2. 点击服务进入设置
3. 在 "Settings" 标签页中：
   - **Root Directory**: 设置为 `backend`（如果 Railway 没有自动检测）
   - Railway 会自动检测到 `build.gradle` 并使用 Java 构建器

### 步骤 3: 配置环境变量

在服务的 "Variables" 标签页中，添加以下环境变量：

#### 必需的环境变量：

1. **RAILPACK_JDK_VERSION**
   - 设置为 `21`（确保使用 Java 21）

2. **SPRING_PROFILES_ACTIVE**
   - 设置为 `production`

3. **DATABASE_URL**
   - 使用 Supabase 的连接字符串
   - 格式：`jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require`
   - 注意：使用 Supabase 的 Shared Pooler（端口 6543）

4. **DB_USERNAME**
   - 你的 Supabase 用户名：`postgres.dowbcpwuybwolpszvpeq`

5. **DB_PASSWORD**
   - 你的 Supabase 密码：`100%Prepaidly`

6. **XERO_CLIENT_ID**
   - 从 Xero Developer Portal 获取：https://developer.xero.com/myapps
   - 当前值：`3C7D6D083E6645EF8EA7305916E21957`

7. **XERO_CLIENT_SECRET**
   - 从 Xero Developer Portal 获取
   - 当前值：`H7P3qOHBmmvVHQNwhePLH_lg6dlW2I6Yaw81VOuA_XeHitAG`

8. **XERO_REDIRECT_URI**
   - 格式：`https://your-service-name.up.railway.app/api/auth/xero/callback`
   - 替换 `your-service-name` 为 Railway 自动生成的服务名称
   - 重要：部署后获取实际 URL，然后在 Xero Developer Portal 中添加此回调 URL

9. **JWT_SECRET**
   - 生成一个安全的随机字符串
   - 可以使用：`openssl rand -base64 32`（在本地终端运行）
   - 或使用在线工具生成

10. **JASYPT_PASSWORD**
    - 用于加密存储的令牌
    - 当前值：`vhw5VHkZ9lD6iyXwLlY0bvwzcQSAUWoiri6GdKoWyzM=`
    - 重要：请妥善保管此密码，丢失后无法解密已存储的数据

#### 可选的环境变量：

11. **SENTRY_DSN**（可选）
    - 如果使用 Sentry 进行错误追踪，添加您的 Sentry DSN

12. **SENTRY_ENV**
    - 设置为 `production`

13. **PORT**
    - Railway 会自动设置，但 Spring Boot 配置已支持：`server.port=${PORT:8080}`

### 步骤 4: 更新 Xero 应用配置

1. 登录 Xero Developer Portal：https://developer.xero.com/myapps
2. 编辑您的应用
3. 在 "Redirect URIs" 中添加：
   - `https://your-service-name.up.railway.app/api/auth/xero/callback`
   - 替换为 Railway 提供的实际 URL

### 步骤 5: 部署和测试

1. Railway 会自动检测代码更改并开始部署
2. 等待构建和部署完成（首次部署可能需要 5-10 分钟）
3. 查看 "Deployments" 标签页的日志确保应用启动成功
4. 测试健康检查端点：
   ```
   https://your-service-name.up.railway.app/api/health
   ```
5. 应该返回：`{"status":"UP"}`

## 自动部署

配置完成后，每次推送到 GitHub 主分支，Railway 会自动：
1. 检测代码更改
2. 运行构建命令（根据 `railway.json` 或自动检测）
3. 部署新版本

## 常见问题

### 问题 1: 构建失败 - Java 版本问题

**解决方案**：
- 确保设置了 `RAILPACK_JDK_VERSION=21` 环境变量
- 检查 `build.gradle` 中的 Java 版本配置

### 问题 2: 应用启动失败

**解决方案**：
- 检查所有必需的环境变量是否已设置
- 检查 DATABASE_URL 是否正确（Supabase 需要 SSL）
- 查看部署日志中的错误信息
- 确保数据库已创建并可访问

### 问题 3: 数据库连接问题

**解决方案**：
- 确保使用 Supabase 的 Shared Pooler URL（端口 6543）
- 确保 URL 包含 `?sslmode=require`
- 验证 DB_USERNAME 和 DB_PASSWORD 是否正确
- 检查 Supabase 项目的连接设置

### 问题 4: Xero OAuth 回调失败

**解决方案**：
- 确保 XERO_REDIRECT_URI 与 Xero Developer Portal 中配置的完全一致
- 检查 URL 是否使用 HTTPS（Railway 自动提供 HTTPS）
- 确保服务已完全部署并运行
- Railway 的 URL 格式：`https://your-service-name.up.railway.app`

### 问题 5: 端口配置

Railway 会自动设置 `PORT` 环境变量，Spring Boot 配置已支持：
- `server.port=${PORT:8080}` 在 `application.properties` 中已配置

## 监控和维护

1. **查看日志**：在 Railway Dashboard 中点击服务的 "Deployments" 标签页
2. **监控指标**：查看 "Metrics" 标签页了解资源使用情况
3. **环境变量管理**：在 "Variables" 标签页管理所有环境变量
4. **自定义域名**：可以在 "Settings" 中配置自定义域名

## 成本说明

- **Free Plan**：
  - 每月 $5 免费额度
  - 超出后按使用量付费
  - 不会自动休眠
- **Pro Plan**（$20/月）：
  - 更多资源配额
  - 优先支持

## 配置文件说明

项目根目录的 `railway.json` 文件包含部署配置：
- **buildCommand**: Gradle 构建命令
- **startCommand**: Java 启动命令
- **healthcheckPath**: 健康检查路径

Railway 也可以自动检测这些配置，但明确配置更可靠。

## 下一步

部署成功后，您可以：
1. 配置自定义域名（在 Railway Dashboard 中）
2. 设置健康检查监控
3. 集成 CI/CD 流程
4. 配置数据库备份（Supabase 自动备份）

## 参考资源

- Railway 文档：https://docs.railway.app
- Railway Spring Boot 指南：https://docs.railway.com/guides/spring-boot
- Xero API 文档：https://developer.xero.com/documentation
