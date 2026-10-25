# 信任浏览器与通行密钥

## 状态

客户端已实现并纳入本次发布。既有后端 RLS、成员权限和媒体签名配置未修改。
2026-10-25 经用户批准，在业务 Supabase 控制台启用了通行密钥；刷新后核对开关及域名已保存。没有创建或删除真实设备凭据。

## 登录保持

- 用户主动勾选“信任此浏览器”后，会话进入 localStorage；未勾选只进入当前标签的 sessionStorage，存储受限时仅内存保留。密码不进入这两类存储。
- 旧版自动持久化的会话迁移到本标签暂存；明确勾选后才重新持久化。
- 信任偏好不是认证凭据，不得用它判断成员权限或放行服务端访问。
- 网络故障、超时、429 和 5xx 不再删除可恢复会话，也不会返回过期访问令牌。400/401/403 或无效认证响应仍退出。
- 同账号的新会话可从共享存储复用；支持 Web Locks 的浏览器通过锁串行刷新。主动退出和其他标签退出会清除本地身份。
- 前台每 30 秒、恢复联网、恢复可见和重新聚焦时检查会话。启动期间保持原初始化顺序，避免重复同步待保存记录。
- 两种可复现缺陷已通过测试确认；不能据此宣称每一次历史失效都已确定原因。

## 通行密钥

客户端复用既有公开项目配置、Auth REST 和会话清洗逻辑，不额外引入服务端密钥。
挑战、签名和凭据验证由 Supabase Auth 执行。浏览器通过 WebAuthn 调用系统设备验证，兼容原生 JSON 转换及旧版 Safari 二进制转换回退。
创建、登录、列出、移除均由用户操作触发；取消、账号切换或过期操作不会写回登录状态。始终保留密码登录。
本地 origin 与正式 origin 的凭据分离，本地 UI 禁用真实凭据操作并显示说明。

## 已获批准并保存的后端配置

在原业务 Supabase 项目 Authentication → Passkeys 中：

- Enable Passkey authentication: true
- Relying Party Display Name: 恋爱旅行簿
- Relying Party ID: xrh1238.github.io
- Relying Party Origins: https://xrh1238.github.io

Origin 和 RP ID 不包含 `/dating-web/` 路径。不把生产 RP 改成 localhost。更换域名需要另外规划凭据迁移。
后台启用与本次前端发布均已获得用户明确授权。
随后须在正式 HTTPS 域名上由用户亲自注册通行密钥，分别在 iPhone/Safari 与 Mac/Safari 验证。Face ID/Touch ID/PIN 由设备与系统决定，网站不读取人脸或指纹，也不能承诺固定使用 Face ID。
未进行真实设备的生物验证，当前不能宣称已可用 Face ID 登录。

## 验证

- 自动测试覆盖断网保留会话、拒绝过期令牌、真实拒绝退出、跨标签刷新串行化、退出同步、不信任/信任存储、受限存储、WebAuthn 编解码、取消/陈旧挑战和管理认证。
- 浏览器实际检查：原标签可登录、未信任时新标签未登录；资料安全区可见；手机登录框默认未勾选信任，无横向溢出；本地通行密钥按钮禁用并解释原因。
- 没有使用用户密码、读取登录令牌或注册真实设备凭据。

## 主参考

- https://supabase.com/docs/guides/auth/passkeys
- https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts
- https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/webauthn.ts
- https://github.com/supabase/auth/blob/master/internal/api/settings.go
