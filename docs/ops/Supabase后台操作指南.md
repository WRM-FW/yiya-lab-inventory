# Supabase 后台操作指南

登录入口：https://supabase.com/dashboard → 选择组织 `Yiya-lab-inventory` → 项目 `yiya-lab-inventory`。

本文的菜单名称是 2026-10-12 在你的项目里实际看到的。Supabase 界面改版频繁，**找不到某项时用顶部「Search...（Ctrl K）」输入关键词**，比翻菜单快。凡是我不确定的地方都单独标注了「需你在界面确认」。

---

## 1. 左侧主菜单总览

| 菜单 | 作用 | 你多久用一次 | 会不会改坏东西 |
| :--- | :--- | :--- | :--- |
| **Project Overview** | 项目首页：状态、连接信息、快捷入口 | 每次进来路过 | 否（只读展示） |
| **Table Editor** | 像 Excel 一样看和改表数据 | 常用 | **是**，改数据立即生效且无撤销 |
| **SQL Editor** | 写查询语句 | 常用 | 取决于你运行什么语句 |
| **Database** | 表结构、函数、策略、触发器、扩展等 | 偶尔 | **是**，属于高危区 |
| **Authentication** | 账号、密码、登录、邮件、会话 | 常用 | 部分操作不可逆（删用户） |
| **Storage** | 文件存储 | 本项目**没用到** | 别动 |
| **Edge Functions** | 云端小函数 | 本项目**没用到** | 别动 |
| **Compute** | 实例规格（NEW 标记） | 几乎不用 | **是**，改规格可能产生费用 |
| **Realtime** | 数据变化实时推送 | 本项目**没用到** | 别动 |
| **Advisors** | 官方自动体检：索引、RLS、安全建议 | 每月看一次 | 否（只给建议） |
| **Observability** | 性能与健康指标图表 | 出问题看 | 否 |
| **Logs** | 各类日志查询 | 排障时用 | 否 |
| **Integrations** | 第三方集成 | 不用 | 别动 |
| **Project Settings** | 项目级配置 | 少用 | **是**，多处会影响线上可用性 |

本项目实际用到的只有：Table Editor、SQL Editor、Database（看策略）、Authentication、Logs、Project Settings（看额度与钥匙）。其余菜单不认识也没关系。

---

## 2. Authentication（认证中心）

子菜单实际清单：**Users / OAuth Apps / Emails / Policies / Sign In / Providers / Passkeys / OAuth Server / Sessions / Rate Limits / Multi-Factor / URL Configuration / Attack Protection / Auth Hooks / Audit Logs / Performance**。

### 2.1 Users —— 你最常用

- 列表每行是一个真实登录账号。列头有搜索框（**Search by email**）、**All columns**（选择显示哪些列）、**Sorted by user ID**（排序）、**Refresh**、**Add user**。
- 行尾 **⋯** 菜单里通常有：查看详情、编辑用户、发送确认邮件、发送重置密码邮件、封禁/解封、删除用户。**具体项名以你界面为准**（这块改版频繁）。
- **这里没有「审核状态」**。成员的 `pending / approved / rejected / disabled` 存在业务表 `users_profile` 里，去 Table Editor 看。这是最容易搞混的地方。
- `Add user` 会直接创建一个已确认账号（绕过邮箱验证），适合给实验室成员开初始账号，但绕过了「注册即待审核」的流程，建完记得在业务表里给他补一行档案并批准。

### 2.2 Sign In / Providers

管登录方式。本项目只用 **Email** 一种，其他（Google、GitHub、手机验证码等）都是关闭状态，不要开。这里能改 **最小密码长度**（当前 6，建议提到 8）和 **Confirm email** 开关（当前等效关闭：`mailer_autoconfirm = true`）。

### 2.3 Emails

发信设置。当前 **未配置自定义 SMTP**（`smtp_host` 为空），走 Supabase 内置发信，限速 **每小时 2 封**，且国内邮箱常判为垃圾邮件。要正经用「忘记密码」就得在这里填自己的邮箱服务（需要发信服务器地址、端口、账号、授权码——问学校信息化办公室要一个 SMTP 账号即可）。

### 2.4 URL Configuration

**当前有一处需要改**：`Site URL` 还是默认值 `http://localhost:3000`。邮件里所有跳转链接都基于它，所以重置密码邮件点开会跳到打不开的地址。改成：

```
https://wrm-fw.github.io/yiya-lab-inventory/
```

同一页还有 Redirect / Allowed URLs 列表，用于限制登录后能跳转到哪些地址，本项目目前留空即可。**改完保存后自己注册一个测试邮箱验证一次能否收到邮件**（注意每小时 2 封的限速）。

### 2.5 Sessions / Rate Limits / Audit Logs

- **Sessions**：查看当前有效登录会话。成员设备丢失时，可以在 Users 里对他执行登出全部会话（若界面提供该按钮）。
- **Rate Limits**：限流参数。`rate_limit_email_sent = 2`（每小时 2 封邮件）就在这里，这是你排查「成员说没收到重置邮件」时的第一个解释。
- **Audit Logs**：账号层面的操作记录（谁注册、谁改密码、谁被删）。排障时有用。
- **Policies（Authentication 下）**：只管「谁能改用户元数据」这类认证侧策略，**不是**业务数据的 RLS。业务 RLS 在 **Database → Policies**。名字撞车，注意区分。

---

## 3. Table Editor（看数据）

1. 左侧 **Table Editor** → 中间列表选表。本项目 8 张表：
   - `users_profile` 成员档案（含审核状态）
   - `storage_locations` 存放位置字典
   - `categories` 分类字典
   - `materials_3d` 3D 打印耗材（核心）
   - `general_consumables` 通用消耗品
   - `reusable_tools` 可重复使用工具
   - `inventory_logs` 库存审计流水
   - `tool_loans` 工具借还单
2. 点表名看数据；列头 **Filter** 加条件；点行尾图标编辑单元格，**改完要点保存/插入那一行的确认**。
3. **⚠️ 高风险习惯**：Table Editor 的编辑等同于直接改生产数据，没有撤销、没有确认弹窗保护你改库存数字。**库存数字请让成员在网站里操作**（会写审计流水），只在网站功能出问题时才在这里手工修正，且改前先备份。
4. 表之间的关联：`materials_3d.location_id` → `storage_locations.id`；`*_logs.operator_id` → `users_profile.id`；`tool_loans.tool_id` → `reusable_tools.id`。在 Table Editor 里点外键列的值可以直接跳到关联行。

---

## 4. SQL Editor（什么时候用）

进入：左侧 **SQL Editor**（顶栏也有同名快捷按钮）→ **New query** → 粘贴 → **Run**。

**适合用**：
- 查东西：所有 `SELECT`（只读，安全）。
- 改单个成员状态：`UPDATE users_profile SET ...`（先跑同条件 `SELECT` 确认命中行数）。
- 恢复误改的某一行数值。

**不适合用**：
- 改库存数字（绕过审计流水，事后无法解释）。
- 任何 `DROP` / `TRUNCATE` / 不带 `WHERE` 的 `UPDATE` 或 `DELETE`。
- 复制粘贴网上来路不明的 SQL。

**三条日常最有用**：

```sql
-- 1. 看低库存告警（对应网站概览页的告警）
SELECT name, material_type, remaining_weight_g, min_weight_threshold_g
FROM public.materials_3d
WHERE is_active AND remaining_weight_g <= min_weight_threshold_g;

-- 2. 看谁借了什么没还
SELECT tool_name, borrower_name, contact_info, borrow_quantity,
       to_char(borrowed_at, 'YYYY-MM-DD') AS 借出日期,
       to_char(expected_return_at, 'YYYY-MM-DD') AS 约定归还
FROM public.tool_loans
WHERE status = 'borrowed'
ORDER BY expected_return_at NULLS LAST;

-- 3. 看最近 20 条操作流水（谁在什么时候动了什么）
SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI') AS 时间,
       operator_name, target_name, operation_type, change_amount, unit,
       previous_balance, new_balance
FROM public.inventory_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## 5. Database → Policies（看谁能看什么）

实测页面：左侧 **Database → Policies**，按表分组列出全部策略。当前 **24 条**，分布：`users_profile` 5 条，`materials_3d` / `general_consumables` / `reusable_tools` 各 4 条，`storage_locations` / `categories` / `tool_loans` 各 2 条，`inventory_logs` 1 条。

**日常只需要看不需要改。** 看的时候确认两件事：

1. 每张表都有策略挂在上面（说明 RLS 生效）。
2. **`inventory_logs` 只有 1 条 SELECT 策略**——这是设计要点：流水表**不允许任何人直接写入**，只能由数据库内部的存储过程写。这保证了「操作记录不可篡改」。如果哪天这里多出 INSERT/UPDATE/DELETE 策略，说明有人动了安全规则，要查。

同页顶部每张表还有 **RLS 是否启用** 的开关。**⚠️ 绝对不要关掉任何表的 RLS**，关掉等于把全部数据对任何拿到公开钥匙的人敞开。

Database 菜单下还有 **Functions**（9 个 `fn_*` 存储过程）、**Triggers**（2 个触发器：注册强制待审核 + 注册自动建档）、**Tables**、**Extensions** 等子页，只读浏览安全，编辑前务必备份。

---

## 6. Logs（排障）

左侧 **Logs**。进去后按类别分标签查询（API 网关日志、Auth 日志、数据库日志等）。**具体子标签名称与保留时长请以你看到的界面为准**——官方 Free 档日志保留 **1 天**，意味着昨天的错误今天查不到，所以**出问题当场截图**。

用法：在查询框里用 SQL 语法过滤（这个页面是 SQL 查询界面，不是翻列表）。排障时最省事的其实是：

1. 让报错的成员按 **F12** → **Console** 和 **Network** 标签页截图给你。Network 里红色的那条请求，看它的状态码：
   - `401` = 没登录或凭证过期（对应 R2）
   - `403` = 权限被 RLS 拒绝（对应状态没批准）
   - `404` = 表名或函数名不对（通常是代码问题）
   - `500` / `P0001` = 数据库函数主动抛出的业务错误，消息里会有中文原因（如「可用数量不足」）
2. 再决定要不要去 Logs。

---

## 7. Project Settings（哪些能看，哪些别碰）

子菜单实测清单：**General / Infrastructure / Integrations / API Keys / JWT Keys / Log Drains / Add-ons / Data API / Vault / Subscription / Usage**。

| 子页 | 你要知道什么 | 风险 |
| :--- | :--- | :--- |
| **General** | 项目名、参考 ID（`qbeqynsibnsvvgwyhfyy`，就是网址里那段） | 改项目名安全 |
| **Infrastructure** | 区域（`ap-southeast-1`，不可改）、项目暂停/恢复 | 只读 |
| **API Keys** | 见下一节 | 只读为主 |
| **JWT Keys** | 签发登录凭证的密钥。**轮换它会让所有在线登录瞬间失效**，所有人需重新登录 | 高危，别点 |
| **Data API** | 数据接口设置，含「是否自动暴露新表」等 | 本项目已在迁移里显式授权，改这里不影响安全，但别乱动 |
| **Log Drains** | 把日志转发到外部服务（付费功能为主） | 不用 |
| **Usage** | **每月看一次**：数据库体积、流量、活跃用户 | 只读 |
| **Subscription** | 套餐。**不要误升级成付费** | 只读 |
| **Vault** | 密钥保管（Beta） | 不用 |

数据库直连密码在 **Settings → Database** 区域（不同版本可能在 Infrastructure 或独立 Database 页，**需你在界面确认**）。忘记时可在这里重置，但重置后已配置的直连工具都要改。

---

## 8. API Keys：一把能公开，一把绝不能

实测页面 **Project Settings → API Keys** 上有两类新式钥匙，以及折叠的 **Legacy anon, service_role API keys**：

| 钥匙 | 界面名称 | 权限 | 能不能公开 | 本项目用在哪 |
| :--- | :--- | :--- | :--- | :--- |
| 发布钥匙 | **Publishable key**（`sb_publishable_...` 开头） | 受 RLS 完全约束 | **可以**，设计上就是给浏览器用的 | 已写进仓库 `src/js/config.defaults.js` |
| 机密钥匙 | **Secret key**（`sb_secret_...` 开头） | **绕过 RLS，能读写全部数据** | **绝对不行** | 本项目任何地方都不用 |
| 旧式 anon | Legacy `anon`（`eyJhbGci...` 长串） | 同 Publishable | 可以 | 项目里没用 |
| 旧式 service_role | Legacy `service_role` | 同 Secret | **绝对不行** | 项目里没用 |

**要点**：
1. 本项目**不需要任何 secret / service_role 钥匙**，网站全部功能靠 Publishable + 用户登录凭证完成。也就是说这把最危险的钥匙在你的运维里根本不该出现。
2. 检查有没有泄露：在仓库里搜（本地终端执行）
   ```powershell
   cd D:\Users\28322\Desktop\Qoder_Project\RestWeb_Develop\yiya_lab_inventory
   git grep -n -I -e "sb_secret_" -e "service_role" -e "eyJhbGciOiJIUzI1NiJ9"
   ```
   正常结果应该只有文档里提到 `service_role` 这个词的说明文字，**不该出现任何密钥字符串**。
3. 万一 secret key 泄露：在 API Keys 页 **轮换（rotate）** 它，然后通知成员重新登录。
4. 有人让你把密钥「发一下」——先问清用途。99% 的运维操作不需要 secret key。

---

## 9. Advisors（免费的自动体检）

左侧 **Advisors** 会列出「缺索引」「某些表没启用 RLS」「函数权限过宽」这类建议。**每学期看一次**，只看报告不改东西。注意：它可能提示 `inventory_logs` 缺少某些写入策略——那不是缺陷，是我们故意不给写入权限。

---

## 10. 项目暂停与恢复（寒暑假必读）

Free 档连续 **1 周无任何请求**会自动暂停。表现：网站能打开，但所有数据请求超时或报 5xx，成员集体反馈「打不开数据」。

恢复：Supabase 首页选中项目 → 页面上会有 **Restore / Unpause** 按钮 → 点它，等 1 分钟左右恢复。数据不会丢。

预防：假期里每两周自己打开网站看一眼，或在 SQL Editor 跑一条 `SELECT 1;`。**不要依赖「反正没人用」——暂停后再恢复虽然无损，但恢复期间成员是进不去的。**
