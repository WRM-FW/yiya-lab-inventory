# 义牙实验室物资与耗材管理系统 - 数据库架构与 RLS 权限设计

## 1. 架构总览
系统基于 **Supabase PostgreSQL** 构建，依赖 PostgreSQL 严格的行级安全（Row Level Security, RLS）、外键级联、检查约束（CHECK constraints）以及存储过程（RPC Functions）实现业务原子性。

数据设计核心理念：
1. **职责单一与正交化**：区分 3D 打印耗材（按克管理）、通用消耗品（按单位管理）与工具（按借还池管理）。
2. **流水与余额严格一致**：所有出入库、领用、报损与盘点操作，均在数据库事务中同时更新主表余额与持久化插入操作流水。
3. **安全防线后移至数据库**：普通成员无法通过前端篡改 SQL，必须通过严格受控的 RLS 策略与定义明确的 RPC 函数完成敏感操作。
4. **不可逆审计链条**：操作流水禁止任何直接 `UPDATE` 与 `DELETE`，即使管理员也仅能通过冲正调整记录纠错。

---

## 2. 实体关系图与表结构定义

### 2.1 用户与权限扩展表 (`users_profile`)
关联 Supabase 核心认证表 `auth.users(id)`。
- `id` (UUID, PK, References `auth.users(id)` ON DELETE CASCADE)
- `email` (TEXT, NOT NULL)
- `full_name` (TEXT, NOT NULL)
- `student_or_staff_id` (TEXT, 可选学号/工号)
- `role` (TEXT, NOT NULL, CHECK in ('admin', 'member'), 默认 'member')
- `status` (TEXT, NOT NULL, CHECK in ('pending', 'approved', 'rejected', 'disabled'), 默认 'pending')
- `reviewed_by` (UUID, References `users_profile(id)`)
- `reviewed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### 2.2 基础字典表
- **存放位置表 (`storage_locations`)**：
  - `id` (UUID, PK, DEFAULT gen_random_uuid())
  - `name` (TEXT, UNIQUE, NOT NULL，例如："A区3D打印耗材柜", "焊接台工具架", "元器件货架B-2")
  - `description` (TEXT)
  - `created_at` (TIMESTAMPTZ, DEFAULT now())
- **物资分类表 (`categories`)**：
  - `id` (UUID, PK, DEFAULT gen_random_uuid())
  - `name` (TEXT, UNIQUE, NOT NULL)
  - `type` (TEXT, NOT NULL, CHECK in ('filament_3d', 'general_consumable', 'tool'))
  - `description` (TEXT)
  - `created_at` (TIMESTAMPTZ, DEFAULT now())

### 2.3 3D 打印耗材表 (`materials_3d`)
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL，例如："拓竹 PLA Basic 哑光白 1.75mm")
- `material_type` (TEXT, NOT NULL，例如：PLA, PETG, ABS, TPU, PC, 树脂)
- `brand` (TEXT, NOT NULL，例如：Bambu Lab, eSUN, Polymaker)
- `color_name` (TEXT, NOT NULL，例如：哑光白, 纯黑, 亮红)
- `color_hex` (TEXT，例如：#FFFFFF, 用于在 UI 上渲染色块)
- `diameter_mm` (NUMERIC(4,2), NOT NULL, DEFAULT 1.75，线径)
- `package_spec` (TEXT，采购包装规格，例如："1 kg/卷")
- `remaining_weight_g` (NUMERIC(10,2), NOT NULL, CHECK (remaining_weight_g >= 0)，库存基准单位：**克**)
- `min_weight_threshold_g` (NUMERIC(10,2), NOT NULL, DEFAULT 500.00, CHECK (min_weight_threshold_g >= 0))
- `location_id` (UUID, References `storage_locations(id)`)
- `supplier` (TEXT)
- `is_active` (BOOLEAN, NOT NULL, DEFAULT true，软停用标记)
- `notes` (TEXT)
- `created_by` (UUID, References `users_profile(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### 2.4 通用消耗品表 (`general_consumables`)
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL，例如："含银无铅焊锡丝 0.8mm")
- `category_id` (UUID, References `categories(id)`)
- `model_spec` (TEXT，规格型号，例如："Sn99.3Cu0.7 / 500g卷")
- `unit` (TEXT, NOT NULL，计量单位，例如："卷", "盒", "瓶", "包", "件")
- `current_stock` (NUMERIC(10,2), NOT NULL, CHECK (current_stock >= 0))
- `min_stock_threshold` (NUMERIC(10,2), NOT NULL, DEFAULT 5.00, CHECK (min_stock_threshold >= 0))
- `location_id` (UUID, References `storage_locations(id)`)
- `supplier` (TEXT)
- `is_active` (BOOLEAN, NOT NULL, DEFAULT true)
- `notes` (TEXT)
- `created_by` (UUID, References `users_profile(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### 2.5 可重复使用工具表 (`reusable_tools`)
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `name` (TEXT, NOT NULL，例如："数显恒温电烙铁")
- `category_id` (UUID, References `categories(id)`)
- `model_spec` (TEXT，例如："936 / 60W")
- `total_quantity` (INTEGER, NOT NULL, CHECK (total_quantity >= 0))
- `available_quantity` (INTEGER, NOT NULL, CHECK (available_quantity >= 0))
- `borrowed_quantity` (INTEGER, NOT NULL, CHECK (borrowed_quantity >= 0))
- `location_id` (UUID, References `storage_locations(id)`)
- `is_active` (BOOLEAN, NOT NULL, DEFAULT true)
- `notes` (TEXT)
- `created_by` (UUID, References `users_profile(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())
- **核心数据一致性校验**：
  `CHECK (total_quantity = available_quantity + borrowed_quantity)`

### 2.6 库存操作审计流水表 (`inventory_logs`)
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `target_type` (TEXT, NOT NULL, CHECK in ('material_3d', 'consumable', 'tool'))
- `target_id` (UUID, NOT NULL)
- `target_name` (TEXT, NOT NULL)
- `operation_type` (TEXT, NOT NULL, CHECK in ('inbound', 'consume', 'scrap', 'stocktake', 'adjust'))
- `change_amount` (NUMERIC(10,2), NOT NULL)
- `unit` (TEXT, NOT NULL)
- `previous_balance` (NUMERIC(10,2), NOT NULL)
- `new_balance` (NUMERIC(10,2), NOT NULL)
- `operator_id` (UUID, References `users_profile(id)`)
- `operator_name` (TEXT, NOT NULL)
- `notes` (TEXT)
- `idempotency_key` (TEXT, UNIQUE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())

### 2.7 工具借还明细表 (`tool_loans`)
- `id` (UUID, PK, DEFAULT gen_random_uuid())
- `tool_id` (UUID, NOT NULL, References `reusable_tools(id)`)
- `tool_name` (TEXT, NOT NULL)
- `borrow_quantity` (INTEGER, NOT NULL, CHECK (borrow_quantity > 0))
- `borrower_id` (UUID, NOT NULL, References `users_profile(id)`)
- `borrower_name` (TEXT, NOT NULL)
- `contact_info` (TEXT)
- `borrowed_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())
- `expected_return_at` (TIMESTAMPTZ)
- `returned_at` (TIMESTAMPTZ)
- `status` (TEXT, NOT NULL, CHECK in ('borrowed', 'returned', 'overdue_unreturned', 'abnormal'), DEFAULT 'borrowed')
- `return_operator_id` (UUID, References `users_profile(id)`)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT now())

---

## 3. 并发安全与原子操作存储过程 (RPC)

为了彻底解决高并发场景下的“超借”、“负库存”与“网络抖动导致重复提交”问题，系统禁止前端直接 `UPDATE` 业务表的库存字段，所有涉及库存数量变化的操作统一调用数据库端存储过程：

### 3.1 3D 打印耗材原子重量变更 (`fn_adjust_material_3d_weight`)
```sql
CREATE OR REPLACE FUNCTION fn_adjust_material_3d_weight(
    p_material_id UUID,
    p_operation_type TEXT,
    p_change_amount_g NUMERIC,
    p_operator_id UUID,
    p_operator_name TEXT,
    p_notes TEXT DEFAULT '',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB;
```
**安全保障**：
1. 校验幂等键：若 `p_idempotency_key` 命中现有记录，直接返回历史流水，防止网络重发。
2. 悲观行级锁：执行 `SELECT ... FOR UPDATE` 锁住目标耗材行，避免并发领用脏读。
3. 余额核算与底线防护：若为消耗或报损，计算 `new_balance = remaining_weight_g - p_change_amount_g`；若 `new_balance < 0`，主动抛出异常中止事务。
4. 联动流水插入：原子写入 `inventory_logs`。

### 3.2 工具借出原子操作 (`fn_borrow_tool`)
```sql
CREATE OR REPLACE FUNCTION fn_borrow_tool(
    p_tool_id UUID,
    p_borrow_quantity INTEGER,
    p_borrower_id UUID,
    p_borrower_name TEXT,
    p_contact_info TEXT,
    p_expected_return_at TIMESTAMPTZ,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB;
```
**安全保障**：
1. 锁住目标工具：`SELECT ... FOR UPDATE`。
2. 校验 `available_quantity >= p_borrow_quantity`，否则抛出 `ERR_TOOL_NOT_AVAILABLE`。
3. 更新工具表：`available_quantity -= p_borrow_quantity`, `borrowed_quantity += p_borrow_quantity`。触发器与 CHECK 约束确保恒等式 `total = available + borrowed`。
4. 插入 `tool_loans`，记录详细借出档案。

### 3.3 工具归还原子操作 (`fn_return_tool`)
```sql
CREATE OR REPLACE FUNCTION fn_return_tool(
    p_loan_id UUID,
    p_return_operator_id UUID,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB;
```
**安全保障**：
1. 检查借用状态必须为 `borrowed`。
2. 锁住借还单与关联工具行。
3. 归还入库：`available_quantity += loan.borrow_quantity`, `borrowed_quantity -= loan.borrow_quantity`。
4. 更新借还单状态为 `returned` 并盖上 `returned_at` 时间戳。

---

## 4. 行级安全策略 (RLS) 访问控制矩阵

| 业务表 | 匿名访客 (Anon) | 待审核用户 (Pending) | 审核通过成员 (Approved Member) | 管理员 (Admin) |
| :--- | :---: | :---: | :---: | :---: |
| `users_profile` | 无权限 | 仅可读本人资料 | 可读所有已审核成员名字/邮箱；仅改本人基本信息 | 完全管理（审核、角色修改、启停用） |
| `materials_3d` | 无权限 | 无权限 | 允许 SELECT；允许 INSERT/UPDATE 基础属性；禁止 DELETE | 完全管理（包含软停用与强制清理） |
| `general_consumables` | 无权限 | 无权限 | 允许 SELECT；允许 INSERT/UPDATE 基础属性；禁止 DELETE | 完全管理 |
| `reusable_tools` | 无权限 | 无权限 | 允许 SELECT；允许 INSERT/UPDATE 基础属性；禁止 DELETE | 完全管理 |
| `inventory_logs` | 无权限 | 无权限 | 允许 SELECT；**禁止直接 INSERT/UPDATE/DELETE**（仅由 RPC SECURITY DEFINER 写入） | 允许 SELECT；**禁止 UPDATE/DELETE** |
| `tool_loans` | 无权限 | 无权限 | 允许 SELECT；仅限 RPC 更新借还状态；**禁止 DELETE** | 允许 SELECT；允许管理备注；禁止篡改核心历史 |
| `storage_locations` | 无权限 | 无权限 | 允许 SELECT；允许 INSERT | 完全管理 |
| `categories` | 无权限 | 无权限 | 允许 SELECT | 完全管理 |

---

## 5. 首个管理员安全初始化与权限提升防御

1. **公开注册防御**：
   数据库通过 `BEFORE INSERT` 触发器强制所有新创建的 `users_profile` 记录其 `role` 为 `'member'`，`status` 为 `'pending'`。前端即使向 API 发送 `{role: 'admin'}` 也会被触发器强行重置为默认值。
2. **首个管理员创建**：
   在系统部署初次初始化时，通过 Supabase 控制台 SQL 编辑器执行预设的专有脚本 `supabase/init_admin.sql`，绑定指定邮箱为系统超级管理员。
