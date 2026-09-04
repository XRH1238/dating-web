# Supabase 登录鉴权部署手册

本文件是待执行的部署说明，不代表线上已经配置完成。涉及账号、密钥、部署或权限变更时，先获得站点所有者同意。已有网站请直接阅读账号、网关和安全部署章节，不要重新建库或迁移数据。

## 架构与边界

- 主项目 `ueqlgutndwkfuffzkcxo`：唯一的 Auth、Database 和 Edge Function。五张业务表 `love_plans`、`love_records`、`love_todos`、`love_photos`、`love_capsules` 全部留在这里。
- 第二项目 `msrbqgorhjbzxomexzap`：仅使用 Storage 的 `love-photos`，不复制账号或业务表。这是两个 Supabase 项目，不是两个业务数据库；以后增加项目也只为扩充存储，当前网关仅启用 `secondary`，没有自动轮换。
- 网站公开可读，只有主项目登录用户可以写入。所有手动添加的账号权限相同，可修改共享内容；没有按账号隔离数据。
- Bucket 保持 Public：知道公开 URL 的人仍能 GET 媒体。本次限制写入、删除及列表访问，不提供媒体隐私保护。旧 URL 不变，已有文件不迁移、不删除。
- 网页只保存 publishable key 和用户会话。服务端 Storage secret 只放在主项目 Edge Function 的 Secrets 中。

## 新项目初始化（已有网站跳过）

以下历史基础表定义仅供空的主项目初始化。它不授予匿名写权限。不要在第二项目执行，也不要为这次鉴权改造修改现有业务 schema。

```sql
create table if not exists public.love_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  origin text,
  destination text,
  transport text,
  transfers text,
  segments jsonb,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.love_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.love_todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.love_photos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.love_plans enable row level security;
alter table public.love_records enable row level security;
alter table public.love_todos enable row level security;
alter table public.love_photos enable row level security;

alter table public.love_plans add column if not exists origin text;
alter table public.love_plans add column if not exists destination text;
alter table public.love_plans add column if not exists transport text;
alter table public.love_plans add column if not exists transfers text;
alter table public.love_plans add column if not exists segments jsonb;

```

空项目如需故事字段和时间胶囊，另行批准后在主项目执行 [story-timeline-capsule.sql](supabase/story-timeline-capsule.sql)。该旧迁移含公开写策略，必须在同一次维护中紧接着执行下方主项目鉴权策略；鉴权上线后不要重跑旧迁移，否则会重新开放时间胶囊写入。已有字段和表无需重跑。

## 账号与密码恢复

所有操作都在主项目 Dashboard：

1. 在 Authentication 的登录设置中保留 Email 邮箱密码登录，关闭 **Allow new users to sign up**，也不启用匿名登录。只隐藏网站注册按钮不等于关闭注册；应验证直接注册 API 也被拒绝。已存在的账号不会因此被删除，先核对 Users 中是否都是获准编辑的人。
2. 打开 **Authentication → Users → Add user → Create user**（部分界面标为 Create new user），输入用户邮箱和独立强密码。可重复操作添加多个账号，不必创建新的 Supabase 项目。不要将密码发到聊天或提交到 Git。
3. 邮箱须属于预期用户。若勾选 Auto Confirm User，表示管理员已确认身份；否则先完成邮箱确认，未确认账号可能无法登录。不要为了一个账号关闭所有邮箱确认保护。密码必须满足主项目配置的长度和复杂度策略；首次交付临时密码后，用户可通过“忘记密码”自行设新密码。本版本没有网站内账号管理或邀请回跳界面。
4. 在 Authentication → URL Configuration 设置 **Site URL** 为 `https://xrh1238.github.io/dating-web/`。**Redirect URLs** 加入同一个生产地址；本地测试按实际端口加入 `http://127.0.0.1:4173/` 或 `http://localhost:4173/`。二者不是同一 origin，端口变化也需单独加入；不要把生产 allowlist 配成任意来源通配符。
5. 从上述规范首页打开“忘记密码”。页面将当前 URL（去掉 fragment）作为恢复回跳地址，因此本地 `index.html` 或带查询参数的地址也必须匹配 allowlist，建议使用无查询参数的首页。默认恢复邮件中的 ConfirmationURL 应保持 Supabase 验证链接流程，不要改成网站不支持的自定义 code/PKCE 回调。点击最新邮件后，网站接收 `type=recovery` 的会话 fragment，立即清除地址栏令牌并显示设置新密码弹窗；完成后用新密码验证登录。恢复链接与签名上传链接都视为临时凭据，不要截图或分享。

邮件是否可发送还取决于项目邮件服务、收件人限制、限流和 SMTP 配置；正式使用前测试真实收件箱及垃圾邮件，不要把“请求已发送”当作已送达。参考 [Auth 配置](https://supabase.com/docs/guides/auth/general-configuration)、[用户管理](https://supabase.com/docs/guides/auth/users) 和 [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。

## 网关配置

在第二项目 API Keys 中创建专用的服务端 `sb_secret_...` key。当前 [index.ts](supabase/functions/storage-gateway/index.ts) 明确校验此格式：不要用 publishable/anon key，也不接受旧式 JWT `service_role` key。虽然这些服务端密钥都具有高权限，但本适配器不是任意密钥兼容层；浏览器绝不能持有它们。

在主项目 Dashboard 的 Edge Functions → Secrets 新增 `STORAGE_BACKENDS_JSON`，值为以下 JSON 的实际替换版。仅在 Dashboard 安全输入第二项目的 secret，不要把实际值写入前端、Git、聊天、截图、本机文件或终端历史。下面只是占位符，不能原样用于部署：

```json
{
  "secondary": {
    "url": "https://msrbqgorhjbzxomexzap.supabase.co",
    "secretKey": "<SECONDARY_SB_SECRET_KEY>",
    "bucket": "love-photos"
  }
}
```

网关运行于主项目，平台提供 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`；可选 `SUPABASE_PUBLISHABLE_KEY` 优先用于主项目身份验证。不要把这些主项目变量改成第二项目。函数从 allowlist 选 `secondary`，只允许固定 Bucket 和安全相对路径，不允许客户端传入任意后端密钥或地址。

[supabase/config.toml](supabase/config.toml) 的 `verify_jwt = false` 关闭平台前置 JWT 检查，使请求可进入函数处理 CORS；这不等于公开授权。每个业务请求仍须携带主项目用户 JWT，并由函数的 `getUser(token)` 向主 Auth 服务验证。不要删除此校验，也不要把 publishable key 当作用户 Bearer。文件签名后由浏览器直传第二 Storage，不通过函数转发大文件；签名禁止覆盖已有对象。参考 [函数部署](https://supabase.com/docs/guides/functions/deploy) 和 [函数授权头](https://supabase.com/docs/guides/functions/auth-headers)。

## 安全部署顺序

先记录现有部署版本与两边 policy 清单，安排短维护窗口。以下命令均需在含 `supabase/config.toml` 的仓库根目录、已安装并登录 Supabase CLI 后执行；显式指定主项目，避免部署到第二项目。每一步验证失败就停止，不继续收紧权限。

1. **账号与 Auth URL**：完成前述主项目配置和至少一个获准账号，确认业务五表及第二项目 Public Bucket 已存在；不迁移现有文件。
2. **配置并部署网关**：先在主 Dashboard 保存 secret，再执行：

   ```bash
   supabase functions deploy storage-gateway --project-ref ueqlgutndwkfuffzkcxo
   ```

   部署入口为 `supabase/functions/storage-gateway/index.ts`，配置随仓库读取；确认云端 `verify_jwt` 设置与仓库一致。不要为了部署把 secret 放进命令参数。
3. **验证网关**：在本地登录版本使用专门测试文件和新路径，确认无用户 JWT 的 `sign-upload` / `delete` 返回 401；登录主账号后签发上传、直传、公开 GET 及删除刚上传测试对象成功。请求只用 `backend: secondary`、`bucket: love-photos`；绝不拿已有照片路径做删除测试。此时不要撤销旧策略。
4. **部署前端**：发布整套登录版本（含 `auth-client.js`、`cloud-data-client.js`），检查登录/退出/恢复密码、匿名浏览、登录后写入、网关请求路由均正常。不要只发布隐藏按钮而遗漏服务端配置。在完成接下来的策略收紧前，旧匿名 API 权限仍存在，这一过渡期不算完成鉴权。
5. **主数据库策略**：仅在主项目执行下节指定 SQL。立即验证匿名 SELECT 可用、匿名 INSERT / UPDATE / DELETE 被拒绝，而登录账号五类写操作成功。
6. **第二 Storage 策略**：仅在第二项目执行下节指定 SQL，最后撤销浏览器角色的旧列表/写入/删除权限。再次验证匿名直传、列表和删除被拒绝，登录后的网关签名上传和删除仍正常，已知公开 URL GET 不受影响。
7. **最终验收**：按下方覆盖所有媒体入口和离线重试。保留验证记录后才标记上线成功。

## SQL 执行位置

| Dashboard 的 SQL Editor 所属项目 | 执行文件 | 效果 |
| --- | --- | --- |
| 主项目 `ueqlgutndwkfuffzkcxo` | [authenticated-write-policies.sql](supabase/authenticated-write-policies.sql) | 五张业务表公开 SELECT，仅 authenticated 可 INSERT / UPDATE / DELETE |
| 第二项目 `msrbqgorhjbzxomexzap` | [secondary-storage-gateway-policies.sql](supabase/secondary-storage-gateway-policies.sql) | 删除四个已知旧 Storage 策略，不新增浏览器角色权限，不改 Public 标记 |

不要把主数据库策略跑到第二项目，也不要把第二 Storage 策略跑到主项目。两份脚本只修改 RLS policy，不修改业务 schema 或数据。执行前后分别在正确项目只读检查：

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in
  ('love_plans', 'love_records', 'love_todos', 'love_photos', 'love_capsules'))
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

脚本只移除仓库已知名称；若 Dashboard 有其他 permissive policy，尤其 TO public/anon 或 FOR ALL，它们可能继续授权。先审查其影响范围并另行批准精确撤销，不要删除其他 Bucket 所需策略。主项目旧 Storage 权限不由这两份脚本处理：原来若匿名可写删，旧文件仍有该风险，需要另行检查和收紧；不能声称两个项目的所有旧文件均已受保护。

## 验证与故障排查

在仓库根目录使用支持本仓库 TypeScript 测试加载的 Node.js 运行（建议 Node.js 24）：

```bash
node --test tests/auth-setup-docs.test.js
node --test tests/*.test.js
node --check auth-client.js
node --check cloud-data-client.js
node --check script.js
git diff --check
```

预期测试 `0 failed`、`0 cancelled`，静态检查退出码为 0。测试数量随代码变化，不把固定数量写成部署保证。自动化使用测试依赖，不证明线上 Auth、邮件、SQL 或 secret 已配置；仍需经授权执行真实验收。

- 分别检查 Gallery、Record、Capsule 的照片和视频，以及 Live Photo 静态图片 + MOV；网络请求应先到主网关，再直传第二 Storage，业务 REST 仍到主数据库。检查旧媒体 URL 仍显示。
- 检查 pending record：上传完成但保存失败时保留已上传 URL，重新登录并恢复网络后只上传尚未上传资源；匿名访问不触发同步。使用可识别测试记录，不删除真实记录。
- **401**：检查是否登录主项目、JWT 是否过期、请求的 Bearer 是否用户 token，而非 publishable key；检查函数内 `getUser` 及主项目环境变量。不要通过关闭校验“修复”。
- **CORS / 403**：先区分浏览器预检与数据库 RLS。网关允许 `https://xrh1238.github.io` 和 localhost/127.0.0.1 的 HTTP(S) origin，不是包含 `/dating-web/` 的完整 URL。新增域名需单独审查 allowlist。数据库 403 或写入返回零行时，检查主 JWT、实际 policy 和表权限；匿名被拒是预期结果。
- **502 / storage_error**：检查第二项目 secret、Bucket、函数配置以及服务端日志（不输出 secret 或完整令牌）。浏览器签名上传 403 时确认签名未过期且没有被修改，重新登录重试获取新签名，不开放匿名策略绕过。
- **重置链接**：检查 Site URL、精确 Redirect URLs、端口、邮件模板和最新邮件；过期/已使用链接需重新申请。页面打不开先检查前端发布与本地服务。保留 recovery fragment 交给页面处理，不把邮件链接或地址栏 token 发送给他人。

## 回滚与失败处理

本手册所列部署、创建账号、secret 配置和 SQL 均未在线上执行；只有实际执行并验证后才能记录完成。

优先修复或回滚前端/函数到已验证的鉴权版本，保留数据库 RLS 与 Storage 收紧状态；如尚未有可用的旧鉴权版本，则暂时保持只读而不是自动恢复匿名写入。不要停用 RLS、删除用户或更改数据来排障。旧的无鉴权前端与新策略不兼容，单独回滚旧网页不能恢复写入。

若确需临时恢复某个已记录的旧匿名 policy，必须由所有者再次明确批准并限定项目、Bucket、时间窗口，说明任何人可能上传或删除的风险；恢复后应立即复测并安排重新收紧。本文件不提供一键开放匿名权限脚本。回滚不删除业务记录或已有文件、不迁移文件、不改旧 URL，仅可在授权测试中清理本次新建的测试对象。

照片已经上传、数据库保存失败时，pending 记录会保留上传 URL，正常重试不需要重新选择或重复上传这些照片。不要清空浏览器站点数据或手动删除 pending 记录，否则本地兜底可能丢失。跨数据库与 Storage 不存在事务：网络中断、浏览器关闭或清理失败仍可能产生残留，网关删除不能保证零残留。
