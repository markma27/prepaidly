# Xero OAuth 故障排除指南

## 错误：`unauthorized_client` - "Unknown client or client not enabled"

这个错误表示 Xero 无法识别你的应用。请按照以下步骤检查和修复：

### 步骤 1: 验证 Xero 应用配置

1. **登录 Xero 开发者门户**
   - 访问：https://developer.xero.com/myapps
   - 确保你已登录

2. **检查应用是否存在**
   - 确认你的应用在应用列表中
   - 如果不存在，需要创建新应用（见下方）

3. **验证应用状态**
   - 应用必须是 **"Active"** 状态
   - 如果应用被禁用，点击 "Enable" 启用它

### 步骤 2: 验证 Client ID 和 Client Secret

1. **检查 application-local.properties**
   ```properties
   xero.client.id=你的客户端ID
   xero.client.secret=你的客户端密钥
   ```

2. **在 Xero 开发者门户中验证**
   - 打开你的应用
   - 复制 **Client ID**，确保与配置文件中的完全一致（区分大小写）
   - 复制 **Client Secret**，确保与配置文件中的完全一致

3. **重要提示**
   - Client ID 通常是 32 个字符的十六进制字符串（如：`B7C20E0A50FB4B9F85095E851EAC06A9`）
   - 如果 Client ID 长度不对，可能是复制错误

### 步骤 3: 验证重定向 URI（最重要！）

**重定向 URI 必须完全匹配，包括：**
- 协议（http/https）
- 域名（localhost）
- 端口（8080）
- 路径（/api/auth/xero/callback）

1. **在 Xero 开发者门户中检查**
   - 打开你的应用
   - 查看 "Redirect URI" 字段
   - 必须是：`http://localhost:8080/api/auth/xero/callback`

2. **常见错误**
   - ❌ `https://localhost:8080/api/auth/xero/callback` （使用了 https）
   - ❌ `http://localhost:8080/api/auth/xero/callback/` （末尾多了斜杠）
   - ❌ `http://127.0.0.1:8080/api/auth/xero/callback` （使用了 IP 地址）
   - ✅ `http://localhost:8080/api/auth/xero/callback` （正确）

3. **如果重定向 URI 不匹配**
   - 在 Xero 开发者门户中编辑应用
   - 更新 Redirect URI 为：`http://localhost:8080/api/auth/xero/callback`
   - 保存更改

### 步骤 4: 创建新应用（如果需要）

如果应用不存在或无法修复，创建新应用：

1. **访问** https://developer.xero.com/myapps
2. **点击** "New app" 或 "Create an app"
3. **填写应用信息**
   - **App name**: Prepaidly（或你喜欢的名称）
   - **Integration type**: 选择 **"Partner App"**（用于 OAuth 2.0）
   - **Redirect URI**: `http://localhost:8080/api/auth/xero/callback`
   - **Scopes**: 选择以下权限：
     - `offline_access`（必需，用于刷新令牌）
     - `accounting.settings.read`
     - `accounting.contacts.read`
     - `accounting.transactions`（用于创建日记账）
     - `accounting.journals.read`（用于验证发布）

4. **点击** "Create"
5. **复制凭据**
   - 复制 **Client ID**
   - 复制 **Client Secret**（只显示一次，请保存好）

6. **更新配置文件**
   - 编辑 `backend/src/main/resources/application-local.properties`
   - 更新 `xero.client.id` 和 `xero.client.secret`

### 步骤 5: 重启后端服务

修改配置后，必须重启后端：

1. **停止当前后端服务**（Ctrl+C）
2. **重新启动**
   ```powershell
   cd backend
   .\start-backend.ps1
   ```

### 步骤 6: 检查后端日志

重启后，查看后端日志中的配置信息：

1. **查看日志输出**
   - 应该看到类似这样的日志：
     ```
     Xero Config - Client ID: B7C20E0A..., Redirect URI: http://localhost:8080/api/auth/xero/callback
     Generated Xero authorization URL for user 1: https://login.xero.com/identity/connect/authorize?...
     ```

2. **验证配置**
   - 访问：http://localhost:8080/api/auth/xero/config-check
   - 检查返回的配置信息是否正确

### 步骤 7: 测试连接

1. **访问连接端点**
   - 浏览器访问：http://localhost:8080/api/auth/xero/connect
   - 或在前端点击 "Connect to Xero" 按钮

2. **预期行为**
   - 应该跳转到 Xero 登录页面
   - 登录后应该看到组织选择页面
   - 选择 "Demo Company"
   - 点击 "Allow access"

3. **如果仍然出现错误**
   - 检查后端日志中的完整授权 URL
   - 复制 URL 并在浏览器中打开
   - 查看 Xero 返回的具体错误信息

## 其他常见问题

### 问题：应用创建后立即被禁用

**解决方案：**
- 某些 Xero 账户可能需要验证
- 检查你的 Xero 开发者账户状态
- 联系 Xero 支持（如果需要）

### 问题：重定向 URI 已存在

**解决方案：**
- 每个应用可以有多个重定向 URI
- 确保至少有一个是：`http://localhost:8080/api/auth/xero/callback`
- 可以添加多个 URI（例如，生产环境的 URI）

### 问题：配置更新后仍然失败

**解决方案：**
1. 确认 `application-local.properties` 文件已保存
2. 确认后端使用 `local` profile 启动：
   ```powershell
   .\gradlew.bat bootRun --args='--spring.profiles.active=local'
   ```
3. 检查是否有环境变量覆盖了配置文件设置
4. 清除浏览器缓存和 cookies

## 验证清单

在联系支持之前，请确认：

- [ ] Xero 应用存在于 https://developer.xero.com/myapps
- [ ] 应用状态为 "Active"
- [ ] Client ID 与 `application-local.properties` 中的完全一致
- [ ] Client Secret 与 `application-local.properties` 中的完全一致
- [ ] 重定向 URI 在 Xero 中设置为：`http://localhost:8080/api/auth/xero/callback`
- [ ] 重定向 URI 在配置文件中设置为：`http://localhost:8080/api/auth/xero/callback`
- [ ] 后端已重启并加载了新配置
- [ ] 后端日志显示正确的 Client ID 和 Redirect URI

## 获取帮助

如果以上步骤都无法解决问题：

1. **检查后端日志** - 查看完整的错误堆栈跟踪
2. **检查 Xero 状态页面** - https://status.xero.com
3. **查看 Xero API 文档** - https://developer.xero.com/documentation
4. **联系 Xero 支持** - 如果是 Xero 平台问题
