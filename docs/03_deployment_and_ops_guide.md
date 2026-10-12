# 义牙实验室物资与耗材管理系统 - 部署与运维指南

## 1. 架构与成本约束总览
系统采用完全基于免费套餐的纯静态前端 + 云端 BaaS 架构，杜绝任何未经确认的付费云服务器、按月收费数据库或第三方增值服务：
- **前端托管**：GitHub Pages（免费托管静态 Web 应用，自动配备全球 CDN 与 HTTPS 证书）。
- **后端与数据库**：Supabase Free Tier（免费提供 PostgreSQL 数据库、GoTrue 用户身份认证与 PostgREST API 服务）。
- **零构建开箱即用**：前端采用原生现代 ES 模块化设计，无需 Webpack/Vite 编译打包，直接将仓库静态推送到 GitHub 即可完成上线。

---

## 2. GitHub Pages 前端部署流程

### 2.1 仓库推送
1. 在 GitHub 上新建公开（Public）或私有（Private）代码仓库，例如 `yiya-lab-inventory`。
2. 将本项目所有源代码推送到主分支（`main`）：
   ```bash
   git init
   git add .
   git commit -m "feat: 发布义牙实验室物资与耗材管理系统 v1.0.0"
   git branch -M main
   git remote add origin https://github.com/<your-org>/yiya-lab-inventory.git
   git push -u origin main
   ```

### 2.2 开启 GitHub Pages
1. 进入 GitHub 仓库页面，点击 **Settings** -> 左侧菜单 **Pages**。
2. 在 **Build and deployment** 下的 **Source** 中选择 **Deploy from a branch**。
3. 分支选择 `main`，目录选择 `/ (root)`，点击 **Save**。
4. 等待 1~2 分钟，GitHub 将生成线上访问地址：
   `https://<username>.github.io/yiya-lab-inventory/`
5. 访问该链接，即可看到完整的物资管理系统界面。

---

## 3. Supabase 云端数据库初始化与配置

### 3.1 创建 Supabase 免费项目
1. 访问 [https://supabase.com](https://supabase.com) 并登录账号。
2. 点击 **New Project**，创建新项目：
   - **Name**：`yiya-lab-inventory`
   - **Database Password**：设置强密码并妥善保管在本地安全密码本中。
   - **Region**：选择离高校地理位置较近的区域（例如 `Tokyo (ap-northeast-1)` 或 `Singapore (ap-southeast-1)`）。
   - **Pricing Plan**：选择 **Free ($0/month)**。

### 3.2 执行数据库版本化迁移脚本
进入 Supabase 控制台的 **SQL Editor**，按顺序依次执行 `supabase/migrations/` 下的文件内容：

1. **执行 01 基础表结构迁移**：
   打开 `supabase/migrations/20261012000001_init_schema.sql`，复制全部内容并点击 **Run**。
   *验证*：在 **Table Editor** 中检查是否已生成 `users_profile`, `materials_3d`, `general_consumables`, `reusable_tools`, `inventory_logs`, `tool_loans` 等表。

2. **执行 02 原子存储过程迁移**：
   打开 `supabase/migrations/20261012000002_inventory_rpc_functions.sql`，复制并点击 **Run**。
   *验证*：在 **Database** -> **Functions** 中检查 `fn_adjust_material_3d_weight`, `fn_borrow_tool`, `fn_return_tool` 等函数是否正常加载。

3. **执行 03 行级安全 RLS 策略迁移**：
   打开 `supabase/migrations/20261012000003_rls_policies.sql`，复制并点击 **Run**。
   *验证*：在 **Authentication** -> **Policies** 中确认所有业务表已启用 RLS 并挂载策略。

4. **导入初始基础字典与示范物资**：
   打开 `supabase/seed.sql`，复制并点击 **Run**。系统将自动写入实验室常用存放位置、分类及示范耗材。

### 3.3 首个管理员创建与提权 (`init_admin.sql`)
1. 访问已部署的 Web 应用前端页面，点击“注册申请”，使用管理员邮箱注册（例如：`admin@yiya-lab.edu.cn`）。
2. 打开 `supabase/init_admin.sql`，将脚本中的 `target_admin_email` 修改为您刚刚注册的管理员邮箱。
3. 在 Supabase 的 **SQL Editor** 中执行该脚本。
4. 控制台将提示：`【成功】已成功将用户 ... 提升并激活为系统主管理员！`。
5. 此时管理员重新登录 Web 页面，即可进入全功能管理中心并审核其他新成员。

### 3.4 前端与 Supabase 连接配置
1. 在 Supabase 控制台进入 **Project Settings** -> **API**。
2. 复制 **Project URL**（格式如 `https://xxxx.supabase.co`）与 **Project API keys** 中的 **anon public** 密钥。
   *(注意：绝对不要使用 `service_role` 密钥！`anon` 密钥受 RLS 全面保护，可安全放于客户端。)*
3. 打开 Web 应用界面右上角的“运行环境指示器”，将运行模式切换为“Supabase 云端模式”，填入 URL 与 Anon Key 并保存即可。

---

## 4. 免费套餐资源额度与防坑运维说明

### 4.1 免费套餐关键限制一览
| 资源项 | Supabase Free 限制 | 义牙实验室估算使用量 | 风险评估与应对方案 |
| :--- | :--- | :--- | :--- |
| **数据库存储** | 500 MB | 约 5~15 MB（支撑数万条流水） | 极低。纯文本台账与操作日志每万条约占用 3MB，足够使用多年。 |
| **每月出站流量** | 2 GB / 月 | 约 100~300 MB / 月 | 极低。API 仅传输轻量 JSON 数据。 |
| **项目休眠机制** | 连续 7 天无 API 请求自动暂停 | 寒暑假可能触发休眠 | **重点关注**：若假期连续一周无人使用，Supabase 控制台会提示 Paused。只需管理员登录 Supabase 控制台点击 **Restore** 即可在 1 分钟内无损恢复。 |
| **项目数量上限** | 单个免费账号最多 2 个活跃项目 | 本项目占用 1 个 | 充裕。 |

### 4.2 敏感密钥安全红线
- ⚠️ 前端公开代码仓库中**严禁硬编码包含 `service_role` 高权限密钥**或数据库直连密码。
- 客户端仅能持有 `anon public key`，所有增删改查动作必须完全受制于数据库端的 RLS 行级安全策略。

---

## 5. 数据导出、备份与灾难恢复流程

### 5.1 手动与定期备份导出
1. **全量 SQL 备份 (pg_dump)**：
   在任何具备网络与 PostgreSQL 客户端的环境中执行：
   ```bash
   # 获取直连连接串 (Supabase -> Settings -> Database -> Connection string)
   pg_dump -h db.<project-ref>.supabase.co -U postgres -d postgres -F p -f yiya_lab_backup_$(date +%Y%m%d).sql
   ```
2. **轻量流水 CSV 报表导出**：
   无需安装任何工具，实验室主管或成员随时可进入 Web 系统界面中的 **【📜 审计流水】** 页面，点击右上角的 **“📥 导出 Excel / CSV 流水台账”** 按钮，即可将全量物资操作日志一键下载到本地保存。

### 5.2 灾难恢复
若需要将数据迁移到新的 Supabase 项目或本地 PostgreSQL 实例：
```bash
psql -h <new-host> -U postgres -d postgres -f yiya_lab_backup_20261012.sql
```
系统依赖的标准 PostgreSQL 特性具有 100% 厂商可移植性，随时可平滑迁移至校内私有云服务器。
