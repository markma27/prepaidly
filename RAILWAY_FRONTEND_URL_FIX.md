# 修复 localhost:3000 重定向问题

## 问题

连接 Xero 后，后端仍然重定向到 `localhost:3000` 而不是 Vercel 的生产 URL。

## 原因

Railway 后端没有设置 `FRONTEND_URL` 环境变量，所以使用了默认值 `http://localhost:3000`。

## 解决方案

### 步骤 1: 在 Railway 中设置 FRONTEND_URL

1. **登录 Railway**
   - 访问 [https://railway.app](https://railway.app)
   - 登录你的账户

2. **进入后端服务**
   - 选择你的后端服务（prepaidly-backend）
   - 点击 **Variables** 标签

3. **添加环境变量**
   - 点击 **New Variable** 或 **+ New**
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://prepaidly.vercel.app`
   - 点击 **Add** 或 **Save**

4. **等待重新部署**
   - Railway 会自动检测环境变量变化并重新部署
   - 等待部署完成（通常 1-2 分钟）
   - 可以在 **Deployments** 标签查看部署状态

### 步骤 2: 验证修复

1. **检查环境变量**
   - 在 Railway Variables 页面确认 `FRONTEND_URL` 已设置
   - 值应该是：`https://prepaidly.vercel.app`

2. **测试 OAuth 连接**
   - 访问 `https://prepaidly.vercel.app/app`
   - 点击 "Connect to Xero"
   - 完成 OAuth 授权后
   - 应该重定向到 `https://prepaidly.vercel.app/app/connected`（而不是 localhost:3000）

3. **检查后端日志**
   - 在 Railway 的 **Logs** 标签中
   - 查找日志：`Redirecting to frontend: https://prepaidly.vercel.app/app/connected?...`
   - 确认 URL 是正确的 Vercel 地址

## 环境变量总结

### Railway（后端）需要的环境变量：

- `FRONTEND_URL` = `https://prepaidly.vercel.app` ⚠️ **需要添加**
- `XERO_CLIENT_ID` = （已设置）
- `XERO_CLIENT_SECRET` = （已设置）
- `XERO_REDIRECT_URI` = `https://prepaidly-production.up.railway.app/api/auth/xero/callback`（已设置）
- `DATABASE_URL` = （已设置）
- `DB_USERNAME` = （已设置）
- `DB_PASSWORD` = （已设置）
- `JASYPT_PASSWORD` = （已设置）

### Vercel（前端）需要的环境变量：

- `NEXT_PUBLIC_API_URL` = `https://prepaidly-production.up.railway.app`（已设置）

## 常见问题

### Q: 设置后仍然重定向到 localhost

**A:** 检查以下几点：
1. 确认环境变量名称是 `FRONTEND_URL`（注意大小写）
2. 确认值是正确的 Vercel URL（没有多余的空格或斜杠）
3. 确认 Railway 已重新部署（环境变量更改后需要重新部署）
4. 检查后端日志确认使用了正确的 URL

### Q: 如何确认环境变量已生效？

**A:** 
1. 在 Railway 的 **Logs** 标签中查找启动日志
2. 或者在代码中添加日志输出（已添加：`log.info("Redirecting to frontend: {}", redirectUrl);`）
3. 完成 OAuth 连接后，检查日志中的重定向 URL
