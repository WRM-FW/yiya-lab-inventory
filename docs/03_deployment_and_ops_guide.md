# 义牙实验室物资与耗材管理系统 - 部署与运维指南

## 1. 当前线上状态（已部署并验证）

| 项目 | 值 |
| :--- | :--- |
| 代码仓库 | `https://github.com/WRM-FW/yiya-lab-inventory`（Public） |
| 线上访问 | `https://wrm-fw.github.io/yiya-lab-inventory/` |
| Pages 配置 | Deploy from a branch → `main` → `/ (root)`，无构建步骤 |
| Supabase 项目 | `yiya-lab-inventory`，ref `qbeqynsibnsvvgwyhfyy` |
| 区域 / 引擎 | `ap-southeast-1`（新加坡）/ PostgreSQL 17.11 / Free 套餐 |
| 数据库 Project URL | `https://qbeqynsibnsvvgwyhfyy.supabase.co` |
| 迁移执行状态 | 01 / 02 / 03 / 04 / seed 全部执行成功，端到端 28 项验收通过 |

前端默认连接配置已随仓库提交在 `src/js/config.defaults.js`，成员打开线上地址即为云端模式，无需逐台设备填写。

---

## 2. 架构与成本约束

纯静态前端 + 云端 BaaS，不使用任何按月计费的云服务器：

- **前端托管**：GitHub Pages（免费 CDN 与 HTTPS）。前端零构建，仓库文件原样即站点。
- **后端与数据库**：Supabase Free Tier（PostgreSQL、GoTrue 认证、PostgREST 数据 API）。
- **安全边界**：数据库端 RLS 行级安全 + `SECURITY DEFINER` 原子存储过程。客户端只持有可公开的 anon / publishable key。

---

## 3. GitHub Pages 部署与更新

首次部署已完成。日常更新只需推送：

```bash
git add -A && git commit -m "..." && git push origin main
```

推送后 1 分钟内自动重新发布，无需任何构建配置。仓库不使用 GitHub Actions，因此不需要 `workflow` scope 的令牌。

若需在新环境重做一次首次部署：

```bash
git init -b main && git add . && git commit -m "feat: initial release"
gh repo create yiya-lab-inventory --public --source . --remote origin --push
gh api -X POST repos/<owner>/yiya-lab-inventory/pages -f "source[branch]=main" -f "source[path]=/"
```

验证方式：`curl -o /dev/null -w "%{http_code}" https://wrm-fw.github.io/yiya-lab-inventory/` 返回 200，且 `/src/js/app.js` 等子资源同为 200（`index.html` 内全部使用 `./src/...` 相对路径，挂在项目子路径下不会失效）。

---

## 4. Supabase 项目创建参数（重建项目时照此选择）

新建 Free 项目时的三个安全开关：

- **启用数据 API**：必须勾选。前端直接请求 `/rest/v1/` 与 `/auth/v1/`，关掉就没有 PostgREST。
- **自动暴露新表**：勾与不勾都不影响本项目结果。迁移 04 第 10 节已对 8 张业务表做显式授权（`authenticated` 授予增删改查、`anon` 全部收回），不再依赖该开关。
- **启用自动 RLS**：建议勾选。03 迁移已对现有表显式 `ENABLE ROW LEVEL SECURITY`，该开关只让以后新建的表默认锁死。

区域创建后不可更改，换区域只能重建项目并重跑迁移。数据库密码请存入密码本：备份 `pg_dump` 与项目暂停后恢复会用到，前端与运维脚本都不需要它。

---

## 5. 数据库迁移

### 5.1 执行顺序

| 顺序 | 文件 | 内容 |
| :--- | :--- | :--- |
| 01 | `supabase/migrations/20261012000001_init_schema.sql` | 8 张表、外键、CHECK 约束、索引、注册防越权 BEFORE INSERT 触发器 |
| 02 | `supabase/migrations/20261012000002_inventory_rpc_functions.sql` | 5 个原子 RPC 存储过程 |
| 03 | `supabase/migrations/20261012000003_rls_policies.sql` | 全部业务表启用 RLS 并挂载 24 条策略 |
| 04 | `supabase/migrations/20261012000004_auth_profile_sync_and_rpc_hardening.sql` | 注册自动建档触发器、RPC 身份绑定 `auth.uid()`、表级与函数级权限收紧 |
| 05 | `supabase/seed.sql` | 存放位置、分类字典与示范物资 |

五个脚本均可重复执行（`IF NOT EXISTS` / `DROP ... IF EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`），中途失败修正后直接重跑即可。

### 5.2 通道 A：Supabase 控制台 SQL Editor

打开 SQL Editor，按上表顺序逐个粘贴文件内容并 Run。每个文件请**整体一次执行**，不要拆散语句。

### 5.3 通道 B：Management API 脚本（本次实际采用）

本机没有 `psql`，走 Supabase Management API 提交 SQL，不需要开启数据库 IPv4 直连：

```powershell
$env:YIYA_SUPABASE_ACCESS_TOKEN = 'sbp_...'      # Dashboard 头像 -> Account Settings -> Tokens
$env:YIYA_SUPABASE_PROJECT_REF  = 'qbeqynsibnsvvgwyhfyy'
node run_supabase_migrations.mjs                  # 依次执行并输出 8 项验收
```

脚本位于仓库之外的 `yiya_deploy_tools/`，凭据只从环境变量读取，不写入任何文件。用完请到 Tokens 页面撤销该访问令牌。

### 5.4 与 supabase CLI 的兼容说明

本次通过 Management API 直连执行，未写入 CLI 的迁移账本 `supabase_migrations.schema_migrations`（当前该表不存在）。因此**不要**直接对新项目跑 `supabase db push`，它会认为所有迁移都未应用而重放一遍。重放本身安全（脚本幂等），但会打乱 CLI 的版本记录。若日后要改用 CLI 管理，先执行 `supabase link` 建立账本再迁移。

---

## 6. 迁移后验收清单

`run_supabase_migrations.mjs` 末尾的自动验收，以及本次实测结果：

| 检查项 | 期望 | 实测 |
| :--- | :--- | :--- |
| 8 张业务表 `relrowsecurity` | 全为 true | 全为 true |
| `fn_*` 函数 `prosecdef` | 全为 true | 9 个函数全为 true |
| RLS 策略数 | users_profile 5、三张物资表各 4、字典各 2、logs 1、loans 2 | 与期望一致 |
| `auth.users` 无档案的账号数 | 0 | 0 |
| `auth.users` 上的建档触发器 | `trg_after_insert_auth_users` | 存在 |
| `anon` 对业务表 / 写 RPC 的权限 | 全部 false | `anon_select=false`、`anon_borrow=false` |
| `authenticated` 对业务表 / 写 RPC 的权限 | 全部 true | `auth_select=true`、`auth_borrow=true` |
| 示范数据 | 5 线材 / 5 消耗品 / 5 工具 / 4 位置 / 5 分类 | 一致 |

此外做过一轮真实 HTTP 端到端验收（注册 → 自动建档 → 未审核拦截 → 提权 → 放行 → 出入库与借还 → 清理），28 项全部通过，要点：

- 注册后 `users_profile` 立即出现 `pending` 行，姓名与学号取自 GoTrue metadata。
- 未审核账号读物资表返回 0 行；调用写 RPC 报 `ERR_NOT_APPROVED`。
- 仅有 anon key 无 JWT：读表 401，调用 RPC `permission denied for function`。
- 前端把 `p_operator_id` 伪造成全零 UUID、`p_operator_name` 写成「冒名者」，落库的流水仍是登录者真实 id 与姓名。
- 借出后 `total = available + borrowed` 守恒；重复归还报 `ERR_ALREADY_RETURNED`；同一幂等键重复提交不二次扣减。
- 唯一在任管理员把自己降级为 member 时报 `ERR_LAST_ADMIN`。
- 已审核成员直接 `PATCH users_profile` 提权返回 403，库中角色不变。

---

## 7. 首个管理员初始化

1. 用管理员邮箱在线上页面完成「注册申请」，此时状态为 `pending`。
2. 打开 `supabase/init_admin.sql`，把 `target_admin_email` 改成该邮箱。
3. 在 SQL Editor（或通道 B 脚本）执行，控制台输出 `【成功】已成功将用户 ... 提升并激活为系统主管理员！`。
4. 该账号重新登录即可进入管理员专区审核其他成员。

之后新增管理员走界面内的审核功能（`fn_audit_user_registration`），不必再执行 SQL。

---

## 8. 前端连接配置与模式切换

配置优先级：网址 `?mode=` 参数 > 浏览器 localStorage 覆盖 > `config.defaults.js` 仓库默认值。

- 成员日常使用：直接打开线上地址，已是云端模式。
- 离线演示或培训：打开 `https://wrm-fw.github.io/yiya-lab-inventory/?mode=sandbox`，使用内置示例数据，不产生任何真实库存变动。
- 连接信息保存在浏览器本地，因此换设备无需重新配置（默认值随仓库下发）。若某台机器此前手工填过错误地址，点右上角运行环境指示器清空两栏即可回到仓库默认值。

---

## 9. 免费套餐额度与运维要点

| 资源项 | Supabase Free 限制 | 本实验室估算 | 说明 |
| :--- | :--- | :--- | :--- |
| 数据库存储 | 500 MB | 5~15 MB | 纯文本台账，每万条流水约 3 MB |
| 每月出站流量 | 2 GB | 100~300 MB | API 只传轻量 JSON |
| 项目休眠 | 连续 7 天无请求自动暂停 | 寒暑假可能触发 | 登录控制台点 Restore 即可无损恢复，需 1 分钟左右 |
| 活跃项目数 | 单账号最多 2 个 | 占用 1 个 | 充裕 |

### 9.1 账号删除受借还历史阻止（预期行为）

`tool_loans.borrower_id` 与 `return_operator_id` 的外键是 `ON DELETE RESTRICT`。成员只要发生过借还，从 `auth.users` 删除账号会被数据库拒绝，这是为了保住审计链。正确做法是在管理员专区把账号状态改为 `disabled`，即刻丧失访问权但历史保留。确需删除时，先归档并清理其借还单据。

### 9.2 注册邮箱确认

本项目实测：注册接口直接下发 `access_token`，注册后立刻用密码登录成功，无需点邮件链接。实验室的准入完全由系统自身的 `pending → approved` 审核流程控制。若日后在控制台改动了 Email Provider 的 Confirm email 开关，请重新验证一次注册即登录的链路。

### 9.3 密钥红线

- 严禁在任何前端文件、提交记录或本文档中出现 `service_role` 密钥与数据库直连密码。
- `config.defaults.js` 只允许存放 Project URL 与 anon / publishable key。
- 用于运维的 Personal Access Token 是账号级凭据，能操作该账号下所有项目，用完立即撤销。

---

## 10. 数据备份与灾难恢复

```bash
# 全量 SQL 备份（连接串见 Settings -> Database）
pg_dump -h db.qbeqynsibnsvvgwyhfyy.supabase.co -U postgres -d postgres -F p \
  -f yiya_lab_backup_$(date +%Y%m%d).sql
```

轻量流水台账：进入系统【审计流水】页面，点「导出 Excel / CSV 流水台账」，无需任何工具。

恢复到新库：

```bash
psql -h <new-host> -U postgres -d postgres -f yiya_lab_backup_YYYYMMDD.sql
```

系统只依赖标准 PostgreSQL 特性（RLS、plpgsql、触发器），可平滑迁移至校内私有云服务器。
