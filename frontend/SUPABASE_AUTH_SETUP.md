# Supabase Auth 配置指南

## 问题解决

如果你遇到密码重置链接过期的问题（`error=access_denied&error_code=otp_expired`），请按照以下步骤配置：

## 1. 配置环境变量

在 `frontend` 目录下创建 `.env.local` 文件（如果还没有的话），并添加以下环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

你可以在 Supabase Dashboard → Settings → API 中找到这些值。

## 2. 配置 Supabase Auth 重定向 URL

在 Supabase Dashboard 中配置重定向 URL：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **Authentication** → **URL Configuration**
4. 在 **Redirect URLs** 中添加以下 URL：
   - `http://localhost:3000/auth/callback` (开发环境)
   - `https://your-domain.com/auth/callback` (生产环境)

## 3. 配置 Site URL

在 Supabase Dashboard → Authentication → URL Configuration 中：

- **Site URL**: 设置为 `http://localhost:3000` (开发环境) 或你的生产环境 URL

## 4. 密码重置邮件模板（可选）

如果需要自定义密码重置邮件：

1. 进入 **Authentication** → **Email Templates**
2. 选择 **Reset Password** 模板
3. 确保重定向 URL 包含 `?type=recovery` 参数：
   ```
   {{ .SiteURL }}/auth/callback?type=recovery&token={{ .TokenHash }}&type=recovery
   ```

## 5. 测试

1. 访问 `http://localhost:3000/auth/forgot-password`
2. 输入你的邮箱地址
3. 检查邮箱中的重置链接
4. 点击链接应该会重定向到 `/auth/reset-password` 页面

## 常见问题

### 链接过期错误

如果仍然看到 `otp_expired` 错误：

1. **检查重定向 URL 配置**：确保 Supabase Dashboard 中的重定向 URL 与代码中的完全匹配
2. **检查邮件中的链接**：确保链接指向正确的回调 URL
3. **及时点击链接**：密码重置链接通常有 1 小时的有效期

### 回调页面不工作

如果 `/auth/callback` 页面不工作：

1. 检查环境变量是否正确设置
2. 检查 Supabase 项目 URL 和 Anon Key 是否正确
3. 查看浏览器控制台和服务器日志中的错误信息

## 文件结构

已创建的文件：

- `frontend/lib/supabase.ts` - Supabase 客户端配置
- `frontend/app/auth/callback/route.ts` - 认证回调处理（处理密码重置等）
- `frontend/app/auth/forgot-password/page.tsx` - 忘记密码页面
- `frontend/app/auth/reset-password/page.tsx` - 重置密码页面
- `frontend/app/auth/accept-invite/page.tsx` - 接受用户邀请页面（新用户设置密码）
- `frontend/app/auth/login/page.tsx` - 更新了登录页面，添加了"忘记密码"链接
- `frontend/app/page.tsx` - 更新了根页面，自动检测邀请 token 并重定向

## 6. 用户邀请配置

### 配置邀请重定向 URL

Supabase 邀请链接会重定向到你的 Site URL（在 Supabase Dashboard → Authentication → URL Configuration 中配置）。

确保 Site URL 设置为：
- 开发环境：`http://localhost:3000`
- 生产环境：你的生产环境 URL

### 邀请流程

1. 在 Supabase Dashboard → Authentication → Users 中邀请新用户
2. 用户会收到邀请邮件
3. 点击邮件中的链接会重定向到 `http://localhost:3000`（或你的 Site URL）
4. 根页面会自动检测邀请 token 并重定向到 `/auth/accept-invite`
5. 用户在 `/auth/accept-invite` 页面设置密码
6. 设置完成后自动重定向到 `/app`

### 自定义邀请邮件模板（可选）

如果需要自定义邀请邮件：

1. 进入 **Authentication** → **Email Templates**
2. 选择 **Invite User** 模板
3. 确保重定向 URL 指向你的 Site URL（Supabase 会自动添加 hash fragment）

## 下一步

如果你想要完全使用 Supabase Auth 进行登录（而不是当前的后端 API），需要：

1. 更新 `frontend/app/auth/login/page.tsx` 使用 `supabase.auth.signInWithPassword()`
2. 更新 `frontend/app/app/page.tsx` 使用 Supabase session 检查而不是 sessionStorage
3. 更新后端 API 以验证 Supabase JWT token

