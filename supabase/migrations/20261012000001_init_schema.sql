-- ==============================================================================
-- 迁移文件 01: 初始化表结构、枚举、外键与检查约束
-- 项目：义牙实验室物资与耗材管理系统 (Yiya Lab Material & Consumable System)
-- ==============================================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户与档案表 (绑定 auth.users)
CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    student_or_staff_id TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    reviewed_by UUID REFERENCES public.users_profile(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 存放位置字典表
CREATE TABLE IF NOT EXISTS public.storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 物资分类字典表
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('filament_3d', 'general_consumable', 'tool')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 3D 打印耗材表 (核心业务：以克为标准单位，区分材料/品牌/颜色/线径)
CREATE TABLE IF NOT EXISTS public.materials_3d (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    material_type TEXT NOT NULL, -- 如 PLA, PETG, ABS, TPU, PC, 树脂
    brand TEXT NOT NULL,         -- 品牌，如 Bambu Lab, eSUN, Polymaker
    color_name TEXT NOT NULL,    -- 颜色名称，如 哑光白, 纯黑, 亮红
    color_hex TEXT DEFAULT '#4A90E2', -- 颜色色值，方便 UI 快速识别
    diameter_mm NUMERIC(4,2) NOT NULL DEFAULT 1.75 CHECK (diameter_mm > 0),
    package_spec TEXT DEFAULT '1 kg/卷', -- 采购包装规格描述
    remaining_weight_g NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (remaining_weight_g >= 0), -- 剩余总重量（克）
    min_weight_threshold_g NUMERIC(10,2) NOT NULL DEFAULT 500.00 CHECK (min_weight_threshold_g >= 0), -- 最低预警（克）
    location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
    supplier TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true, -- 软停用
    notes TEXT,
    created_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 通用消耗品表 (焊锡、辅料、元器件，单位固定)
CREATE TABLE IF NOT EXISTS public.general_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    model_spec TEXT, -- 规格型号，如 Sn99.3Cu0.7 / 500g卷
    unit TEXT NOT NULL, -- 稳定计量单位，如 卷, 盒, 瓶, 包, 件, 支
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (current_stock >= 0),
    min_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 5.00 CHECK (min_stock_threshold >= 0),
    location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
    supplier TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 可重复使用工具表 (池化管理：总数 = 可用 + 借出)
CREATE TABLE IF NOT EXISTS public.reusable_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    model_spec TEXT,
    total_quantity INTEGER NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
    available_quantity INTEGER NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
    borrowed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (borrowed_quantity >= 0),
    location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tool_quantities CHECK (total_quantity = available_quantity + borrowed_quantity)
);

-- 7. 库存操作审计流水表 (只读追溯)
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('material_3d', 'consumable', 'tool')),
    target_id UUID NOT NULL,
    target_name TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('inbound', 'consume', 'scrap', 'stocktake', 'adjust')),
    change_amount NUMERIC(10,2) NOT NULL,
    unit TEXT NOT NULL,
    previous_balance NUMERIC(10,2) NOT NULL,
    new_balance NUMERIC(10,2) NOT NULL,
    operator_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    operator_name TEXT NOT NULL,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. 工具借还明细表
CREATE TABLE IF NOT EXISTS public.tool_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES public.reusable_tools(id) ON DELETE RESTRICT,
    tool_name TEXT NOT NULL,
    borrow_quantity INTEGER NOT NULL DEFAULT 1 CHECK (borrow_quantity > 0),
    borrower_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE RESTRICT,
    borrower_name TEXT NOT NULL,
    contact_info TEXT,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_return_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue_unreturned', 'abnormal')),
    return_operator_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. 索引构建以提升高频查询性能
CREATE INDEX IF NOT EXISTS idx_materials_3d_active ON public.materials_3d(is_active);
CREATE INDEX IF NOT EXISTS idx_materials_3d_type ON public.materials_3d(material_type);
CREATE INDEX IF NOT EXISTS idx_consumables_active ON public.general_consumables(is_active);
CREATE INDEX IF NOT EXISTS idx_tools_active ON public.reusable_tools(is_active);
CREATE INDEX IF NOT EXISTS idx_logs_target ON public.inventory_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_loans_borrower ON public.tool_loans(borrower_id, status);

-- 10. 用户注册安全防越权触发器：强制新注册账号为 member 且 pending
CREATE OR REPLACE FUNCTION public.trg_enforce_user_registration_defaults()
RETURNS TRIGGER AS $$
BEGIN
    NEW.role := 'member';
    NEW.status := 'pending';
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_before_insert_users_profile ON public.users_profile;
CREATE TRIGGER trg_before_insert_users_profile
BEFORE INSERT ON public.users_profile
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_user_registration_defaults();
