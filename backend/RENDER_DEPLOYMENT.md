# Render 部署指南

本指南将帮助您将 Prepaidly 后端部署到 Render 平台。

## 前置要求

1. Render 账户（免费注册：https://render.com）
2. GitHub 仓库（代码已推送到 GitHub）
3. PostgreSQL 数据库（可以使用 Render 的 PostgreSQL 服务）

## 部署步骤

### 步骤 1: 准备数据库

1. 登录 Render Dashboard：https://dashboard.render.com
2. 点击 "New +" → 选择 "PostgreSQL"
3. 配置数据库：
   - **Name**: `prepaidly-db`（或您喜欢的名称）
   - **Database**: `prepaidly`
   - **User**: `prepaidly_user`（自动生成）
   - **Region**: 选择离您最近的区域
   - **Plan**: Free（或根据需要选择）
4. 点击 "Create Database"
5. 等待数据库创建完成（约 1-2 分钟）
6. 记录以下信息（稍后会用到）：
   - **Internal Database URL**（内部连接用）
   - **External Database URL**（外部连接用，如果需要）

### 步骤 2: 创建 Web Service

1. 在 Render Dashboard 中，点击 "New +" → 选择 "Web Service"
2. 连接您的 GitHub 仓库：
   - 如果首次连接，点击 "Connect GitHub" 授权
   - 选择 `prepaidly` 仓库
   - 选择 `main`（或您的主分支）
3. 配置服务：
   - **Name**: `prepaidly-backend`
   - **Region**: 选择与数据库相同的区域
   - **Branch**: `main`（或您的主分支）
   - **Root Directory**: `backend`（重要！）
   - **Environment**: `Java`
   - **Build Command**: `./gradlew clean build -x test`
   - **Start Command**: `java -jar build/libs/prepaidly-0.1.0.jar`
   - **Plan**: Free（或根据需要选择）

### 步骤 3: 配置环境变量

在 Web Service 的 "Environment" 标签页中，添加以下环境变量：

#### 必需的环境变量：

1. **DATABASE_URL**
   - 从 PostgreSQL 服务的 "Connections" 标签页复制 **Internal Database URL**
   - 格式类似：`postgresql://user:password@host:5432/database`
   - 注意：Render 会自动提供内部连接 URL，使用这个可以避免网络延迟

2. **DB_USERNAME**
   - 从 DATABASE_URL 中提取用户名，或使用 PostgreSQL 服务中显示的用户名

3. **DB_PASSWORD**
   - 从 DATABASE_URL 中提取密码，或使用 PostgreSQL 服务中显示的密码

4. **XERO_CLIENT_ID**
   - 从 Xero Developer Portal 获取：https://developer.xero.com/myapps
   - 创建应用后获取 Client ID

5. **XERO_CLIENT_SECRET**
   - 从 Xero Developer Portal 获取
   - 创建应用后获取 Client Secret

6. **XERO_REDIRECT_URI**
   - 格式：`https://your-service-name.onrender.com/api/auth/xero/callback`
   - 替换 `your-service-name` 为您的实际服务名称
   - 重要：需要在 Xero Developer Portal 中添加此回调 URL

7. **JWT_SECRET**
   - 生成一个安全的随机字符串
   - 可以使用：`openssl rand -base64 32`（在本地终端运行）
   - 或使用在线工具生成

8. **JASYPT_PASSWORD**
   - 生成一个安全的随机字符串（用于加密存储的令牌）
   - 可以使用：`openssl rand -base64 32`
   - 重要：请妥善保管此密码，丢失后无法解密已存储的数据

#### 可选的环境变量：

9. **SENTRY_DSN**（可选）
   - 如果使用 Sentry 进行错误追踪，添加您的 Sentry DSN

10. **SENTRY_ENV**
    - 设置为 `production`

11. **SPRING_PROFILES_ACTIVE**
    - 设置为 `production`

12. **JAVA_VERSION**
    - 设置为 `21`（Render 应该会自动检测，但明确指定更安全）

### 步骤 4: 更新 Xero 应用配置

1. 登录 Xero Developer Portal：https://developer.xero.com/myapps
2. 编辑您的应用
3. 在 "Redirect URIs" 中添加：
   - `https://your-service-name.onrender.com/api/auth/xero/callback`
   - 替换 `your-service-name` 为您的实际服务名称

### 步骤 5: 初始化数据库

部署完成后，需要初始化数据库表结构：

1. 在 Render Dashboard 中，进入您的 PostgreSQL 服务
2. 点击 "Connect" → 选择 "psql" 或使用外部数据库客户端
3. 连接到数据库后，运行 `database/schema.sql` 中的 SQL 语句创建表结构
   - 或者，如果您的应用配置了 `spring.jpa.hibernate.ddl-auto=update`，表会自动创建

### 步骤 6: 部署和测试

1. 在 Web Service 页面，点击 "Manual Deploy" → "Deploy latest commit"
2. 等待构建和部署完成（首次部署可能需要 5-10 分钟）
3. 查看日志确保应用启动成功
4. 测试健康检查端点：
   ```
   https://your-service-name.onrender.com/api/health
   ```

## 常见问题

### 问题 1: 构建失败

**解决方案**：
- 检查 Root Directory 是否设置为 `backend`
- 确保 build.gradle 文件存在
- 查看构建日志中的具体错误信息

### 问题 2: 应用启动失败

**解决方案**：
- 检查所有必需的环境变量是否已设置
- 检查 DATABASE_URL 是否正确
- 查看应用日志中的错误信息
- 确保数据库已创建并可访问

### 问题 3: 数据库连接问题

**解决方案**：
- 确保使用 **Internal Database URL**（不是 External）
- 检查数据库服务是否正在运行
- 验证 DB_USERNAME 和 DB_PASSWORD 是否正确

### 问题 4: Xero OAuth 回调失败

**解决方案**：
- 确保 XERO_REDIRECT_URI 与 Xero Developer Portal 中配置的完全一致
- 检查 URL 是否使用 HTTPS（Render 自动提供 HTTPS）
- 确保服务已完全部署并运行

### 问题 5: 端口配置

Render 会自动设置 `PORT` 环境变量，但 Spring Boot 默认使用 8080。如果遇到端口问题：
- 在 `application.properties` 中添加：`server.port=${PORT:8080}`
- 或者确保应用读取 PORT 环境变量

## 自动部署

配置完成后，每次推送到 GitHub 主分支，Render 会自动：
1. 检测代码更改
2. 运行构建命令
3. 部署新版本

## 监控和维护

1. **查看日志**：在 Render Dashboard 中点击 "Logs" 标签页
2. **监控指标**：查看 "Metrics" 标签页了解资源使用情况
3. **环境变量管理**：在 "Environment" 标签页管理所有环境变量

## 成本说明

- **Free Plan**：
  - Web Service：免费（但会在 15 分钟无活动后休眠）
  - PostgreSQL：免费（但有连接限制）
- **Starter Plan**（$7/月）：
  - Web Service：始终运行，不会休眠
  - 适合生产环境使用

## 下一步

部署成功后，您可以：
1. 配置自定义域名（在 Render Dashboard 中）
2. 设置健康检查监控
3. 配置自动备份（对于数据库）
4. 集成 CI/CD 流程

## 参考资源

- Render 文档：https://render.com/docs
- Spring Boot 部署指南：https://spring.io/guides/gs/spring-boot-for-azure/
- Xero API 文档：https://developer.xero.com/documentation
