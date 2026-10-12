-- ==============================================================================
-- 迁移文件 03: 行级安全策略 (Row Level Security - RLS)
-- 项目：义牙实验室物资与耗材管理系统
-- ==============================================================================

-- 1. 开启所有业务表的 RLS
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reusable_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_loans ENABLE ROW LEVEL SECURITY;

-- 2. 安全辅助函数 (避免递归查询与提升执行效率)
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users_profile
        WHERE id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fn_is_approved_member()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users_profile
        WHERE id = auth.uid()
          AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. 表 `users_profile` 权限策略
-- (a) 任何人均可读取本人的档案（便于判断自身是否处于 pending/approved 状态）
DROP POLICY IF EXISTS "policy_users_read_self" ON public.users_profile;
CREATE POLICY "policy_users_read_self" ON public.users_profile
FOR SELECT USING (auth.uid() = id);

-- (b) 审核通过的成员可查看所有已激活成员的展示姓名与邮箱（便于展示领用人与操作人）
DROP POLICY IF EXISTS "policy_approved_read_members" ON public.users_profile;
CREATE POLICY "policy_approved_read_members" ON public.users_profile
FOR SELECT USING (public.fn_is_approved_member());

-- (c) 管理员可查看全部用户（包括待审核、拒绝、禁用的用户）
DROP POLICY IF EXISTS "policy_admin_read_all_users" ON public.users_profile;
CREATE POLICY "policy_admin_read_all_users" ON public.users_profile
FOR SELECT USING (public.fn_is_admin());

-- (d) 用户本人仅可更新自己的基本信息（如姓名、学号），但不可篡改 role 与 status（由触发器+策略双重防护）
DROP POLICY IF EXISTS "policy_users_update_self_info" ON public.users_profile;
CREATE POLICY "policy_users_update_self_info" ON public.users_profile
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = 'member');

-- (e) 仅管理员可直接更新用户的角色与审核状态
DROP POLICY IF EXISTS "policy_admin_update_users" ON public.users_profile;
CREATE POLICY "policy_admin_update_users" ON public.users_profile
FOR UPDATE USING (public.fn_is_admin());


-- 4. 字典表 `storage_locations` 与 `categories`
-- 审核通过的成员可读
DROP POLICY IF EXISTS "policy_locations_read" ON public.storage_locations;
CREATE POLICY "policy_locations_read" ON public.storage_locations
FOR SELECT USING (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_categories_read" ON public.categories;
CREATE POLICY "policy_categories_read" ON public.categories
FOR SELECT USING (public.fn_is_approved_member());

-- 仅管理员可新增或修改字典
DROP POLICY IF EXISTS "policy_locations_admin_write" ON public.storage_locations;
CREATE POLICY "policy_locations_admin_write" ON public.storage_locations
FOR ALL USING (public.fn_is_admin());

DROP POLICY IF EXISTS "policy_categories_admin_write" ON public.categories;
CREATE POLICY "policy_categories_admin_write" ON public.categories
FOR ALL USING (public.fn_is_admin());


-- 5. 核心物资表 `materials_3d`, `general_consumables`, `reusable_tools`
-- 只有审核通过的成员才能查询物资清单
DROP POLICY IF EXISTS "policy_materials_3d_select" ON public.materials_3d;
CREATE POLICY "policy_materials_3d_select" ON public.materials_3d
FOR SELECT USING (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_consumables_select" ON public.general_consumables;
CREATE POLICY "policy_consumables_select" ON public.general_consumables
FOR SELECT USING (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_tools_select" ON public.reusable_tools;
CREATE POLICY "policy_tools_select" ON public.reusable_tools
FOR SELECT USING (public.fn_is_approved_member());

-- 审核通过的成员可录入新物资基础资料
DROP POLICY IF EXISTS "policy_materials_3d_insert" ON public.materials_3d;
CREATE POLICY "policy_materials_3d_insert" ON public.materials_3d
FOR INSERT WITH CHECK (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_consumables_insert" ON public.general_consumables;
CREATE POLICY "policy_consumables_insert" ON public.general_consumables
FOR INSERT WITH CHECK (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_tools_insert" ON public.reusable_tools;
CREATE POLICY "policy_tools_insert" ON public.reusable_tools
FOR INSERT WITH CHECK (public.fn_is_approved_member());

-- 审核通过成员可维护常规信息（如颜色、备注），但物理删除严格禁止，仅限管理员软停用
DROP POLICY IF EXISTS "policy_materials_3d_update" ON public.materials_3d;
CREATE POLICY "policy_materials_3d_update" ON public.materials_3d
FOR UPDATE USING (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_consumables_update" ON public.general_consumables;
CREATE POLICY "policy_consumables_update" ON public.general_consumables
FOR UPDATE USING (public.fn_is_approved_member());

DROP POLICY IF EXISTS "policy_tools_update" ON public.reusable_tools;
CREATE POLICY "policy_tools_update" ON public.reusable_tools
FOR UPDATE USING (public.fn_is_approved_member());

-- 物理删除全面禁止（保留历史可追溯性），仅超级管理员在特定清理时可用
DROP POLICY IF EXISTS "policy_materials_3d_delete" ON public.materials_3d;
CREATE POLICY "policy_materials_3d_delete" ON public.materials_3d
FOR DELETE USING (public.fn_is_admin());

DROP POLICY IF EXISTS "policy_consumables_delete" ON public.general_consumables;
CREATE POLICY "policy_consumables_delete" ON public.general_consumables
FOR DELETE USING (public.fn_is_admin());

DROP POLICY IF EXISTS "policy_tools_delete" ON public.reusable_tools;
CREATE POLICY "policy_tools_delete" ON public.reusable_tools
FOR DELETE USING (public.fn_is_admin());


-- 6. 审计流水表 `inventory_logs` (只读不可逆性设计)
-- 审核通过成员可只读查看流水
DROP POLICY IF EXISTS "policy_logs_select" ON public.inventory_logs;
CREATE POLICY "policy_logs_select" ON public.inventory_logs
FOR SELECT USING (public.fn_is_approved_member());

-- 禁止直接通过客户端 API 执行 INSERT / UPDATE / DELETE 流水表，所有写入全部委托给 SECURITY DEFINER RPC 存储过程
-- （PostgreSQL 中启用 RLS 且无开放 INSERT 策略时，外部客户端直接调用 REST INSERT 会被 100% 拒绝，保障流水可信性）


-- 7. 工具借还单据表 `tool_loans`
-- 审核通过成员可查看借还记录
DROP POLICY IF EXISTS "policy_loans_select" ON public.tool_loans;
CREATE POLICY "policy_loans_select" ON public.tool_loans
FOR SELECT USING (public.fn_is_approved_member());

-- 借还单据的新增与状态更新由 RPC 函数处理，普通成员严禁直接物理删除借还历史
DROP POLICY IF EXISTS "policy_loans_delete" ON public.tool_loans;
CREATE POLICY "policy_loans_delete" ON public.tool_loans
FOR DELETE USING (public.fn_is_admin());
