# 调试 Frontend URL 重定向问题

## 问题

即使 Railway 中 `FRONTEND_URL` 环境变量已正确设置，OAuth 回调仍然重定向到 `localhost:3000`。

## 可能的原因

1. **Railway 还没有重新部署** - 环境变量更改后需要重新部署才能生效
2. **代码还没有推送到 Git** - Railway 可能还在使用旧代码
3. **Spring Boot 应用没有重启** - 环境变量在应用启动时读取

## 调试步骤

### 步骤 1: 检查配置端点

访问配置检查端点，查看实际读取到的值：

```
https://prepaidly-production.up.railway.app/api/auth/xero/config-check
```

检查响应中的：
- `frontendUrl` - 代码中实际使用的值
- `frontendUrlFromEnv` - 从环境变量直接读取的值

**预期结果：**
```json
{
  "frontendUrl": "https://prepaidly.vercel.app",
  "frontendUrlFromEnv": "https://prepaidly.vercel.app"
}
```

**如果显示 localhost:3000：**
- 说明环境变量没有生效，需要重新部署

### 步骤 2: 检查 Railway 部署状态

1. 在 Railway Dashboard 中，进入你的服务
2. 检查 **Deployments** 标签
3. 确认最新的部署是在设置 `FRONTEND_URL` **之后**
4. 如果最新部署是在设置环境变量之前，需要触发重新部署

### 步骤 3: 触发重新部署

**方法 1: 通过 Git 推送（推荐）**
```bash
# 提交代码更改
git add .
git commit -m "Add frontend URL configuration"
git push
```

Railway 会自动检测到代码更改并重新部署。

**方法 2: 手动触发重新部署**
1. 在 Railway Dashboard 中，进入你的服务
2. 点击 **Deployments** 标签
3. 找到最新的部署
4. 点击右侧的 **...** 菜单
5. 选择 **Redeploy**

**方法 3: 修改环境变量触发重新部署**
1. 在 Railway Variables 页面
2. 编辑 `FRONTEND_URL` 变量（可以添加或删除一个空格）
3. 保存
4. Railway 会自动重新部署

### 步骤 4: 检查后端日志

在 Railway 的 **Logs** 标签中，查找：

1. **应用启动日志**
   - 查找 Spring Boot 启动信息
   - 确认应用已重新启动

2. **OAuth 回调日志**
   - 完成 OAuth 连接后
   - 查找日志：`Redirecting to frontend: ...`
   - 确认 URL 是否正确

**示例日志：**
```
Redirecting to frontend: https://prepaidly.vercel.app/app/connected?success=true&tenantId=...
```

如果日志显示 `localhost:3000`，说明环境变量没有正确读取。

## 验证修复

完成重新部署后：

1. **等待部署完成**（通常 1-2 分钟）
2. **检查配置端点**：
   ```
   https://prepaidly-production.up.railway.app/api/auth/xero/config-check
   ```
   确认 `frontendUrl` 是正确的 Vercel URL

3. **测试 OAuth 连接**：
   - 访问 `https://prepaidly.vercel.app/app`
   - 点击 "Connect to Xero"
   - 完成授权后
   - 应该重定向到 `https://prepaidly.vercel.app/app/connected`（而不是 localhost:3000）

## 常见问题

### Q: 配置端点显示 localhost:3000

**A:** 环境变量没有生效，需要：
1. 确认 Railway 中 `FRONTEND_URL` 已设置
2. 触发重新部署（见步骤 3）
3. 等待部署完成后再测试

### Q: 重新部署后仍然显示 localhost:3000

**A:** 检查以下几点：
1. 确认环境变量名称是 `FRONTEND_URL`（注意大小写）
2. 确认值是正确的：`https://prepaidly.vercel.app`（没有多余的空格）
3. 检查 Railway 日志确认应用已重新启动
4. 清除浏览器缓存并重试

### Q: 如何确认环境变量已生效？

**A:** 
1. 访问配置检查端点（见步骤 1）
2. 检查 `frontendUrlFromEnv` 的值
3. 如果显示 `null`，说明环境变量没有设置或没有生效

## 快速修复命令

如果需要快速触发重新部署，可以在 Railway Dashboard 中：

1. **Variables** → 编辑 `FRONTEND_URL` → 保存（会触发重新部署）
2. 或者 **Deployments** → 最新部署 → **Redeploy**
