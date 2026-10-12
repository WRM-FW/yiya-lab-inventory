-- ==============================================================================
-- 迁移文件 04: 注册自动建档 + RPC 操作人身份加固（绑定 auth.uid()）
-- 项目：义牙实验室物资与耗材管理系统
-- 依赖：必须在 20261012000001 / 02 / 03 之后执行；本文件自身可重复执行（幂等）
-- ==============================================================================
-- 解决的两个问题：
--   【问题一】前端注册只调用 GoTrue 的 /auth/v1/signup，而 03 迁移没给
--             public.users_profile 开 INSERT 策略（这是有意为之，避免匿名伪造档案）。
--             后果是新注册者在 users_profile 里根本没有行，管理员审核页查不到人，
--             云端模式下永远无法完成审核。此处改由数据库端触发器自动建 pending 档案，
--             客户端依旧无权自行插入或提权。
--   【问题二】02 迁移里的写操作 RPC 是 SECURITY DEFINER，函数体绕过 RLS，而“操作人”
--             身份完全来自前端传入的 p_operator_id / p_operator_name / p_admin_id。
--             任何拿到 anon key 的人都可以冒名操作库存与审核用户。此处把身份来源改为
--             auth.uid()（来自 JWT，客户端不可伪造），并校验档案状态必须为 approved。
-- 兼容性：所有函数的参数签名保持不变，前端 store.js 现有调用无需修改；
--         客户端继续传 p_operator_id / p_operator_name 也只会被忽略，不再作为身份依据。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. auth.users 注册成功后自动创建 pending 成员档案
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_new_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_email     TEXT;
    v_full_name TEXT;
BEGIN
    v_email := coalesce(NEW.email, NEW.id::text || '@no-email.yiya-lab.local');

    v_full_name := coalesce(
        nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(NEW.raw_user_meta_data ->> 'name'), ''),
        split_part(v_email, '@', 1)
    );

    INSERT INTO public.users_profile (
        id, email, full_name, student_or_staff_id, role, status
    ) VALUES (
        NEW.id,
        v_email,
        v_full_name,
        nullif(trim(NEW.raw_user_meta_data ->> 'student_id'), ''),
        'member',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 触发器挂 AFTER INSERT：即使建档失败也不会阻断 GoTrue 注册事务本身
DROP TRIGGER IF EXISTS trg_after_insert_auth_users ON auth.users;
CREATE TRIGGER trg_after_insert_auth_users
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_new_auth_user_to_profile();


-- ------------------------------------------------------------------------------
-- 2. 存量补档：把本迁移执行前已注册、但 users_profile 无行的用户补齐为 pending
--    （已被 init_admin.sql 提权的账号有档案行，NOT EXISTS 会自动跳过，不会被降级）
-- ------------------------------------------------------------------------------
INSERT INTO public.users_profile (
    id, email, full_name, student_or_staff_id, role, status
)
SELECT
    u.id,
    coalesce(u.email, u.id::text || '@no-email.yiya-lab.local'),
    coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(u.email, ''), '@', 1),
        '未命名成员'
    ),
    nullif(trim(u.raw_user_meta_data ->> 'student_id'), ''),
    'member',
    'pending'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.users_profile p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 3. RPC 身份校验辅助函数：返回登录者档案，未登录 / 无档案 / 未审核一律拒绝
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_require_approved_actor(p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_rec RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED: 当前请求未携带有效登录凭证，禁止 %', p_action;
    END IF;

    SELECT id, full_name, role, status
    INTO v_rec
    FROM public.users_profile
    WHERE id = v_uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NO_PROFILE: 登录账号缺少成员档案记录，禁止 %', p_action;
    END IF;

    IF v_rec.status <> 'approved' THEN
        RAISE EXCEPTION 'ERR_NOT_APPROVED: 账号当前状态为 %，需管理员审核通过后才能 %', v_rec.status, p_action;
    END IF;

    RETURN jsonb_build_object(
        'id', v_rec.id,
        'name', v_rec.full_name,
        'role', v_rec.role
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. 3D 打印耗材重量原子操作（身份改取 auth.uid()，其余业务规则与 02 完全一致）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_adjust_material_3d_weight(
    p_material_id UUID,
    p_operation_type TEXT,
    p_change_amount_g NUMERIC,
    p_operator_id UUID DEFAULT NULL,      -- 已废弃：仅作旧客户端兼容占位，函数体内不使用
    p_operator_name TEXT DEFAULT '',      -- 已废弃：仅作旧客户端兼容占位，函数体内不使用
    p_notes TEXT DEFAULT '',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_actor JSONB;
    v_rec RECORD;
    v_prev_weight NUMERIC(10,2);
    v_new_weight NUMERIC(10,2);
    v_log_id UUID;
    v_existing_log RECORD;
BEGIN
    v_actor := public.fn_require_approved_actor('物资库存变更');

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id, new_balance INTO v_existing_log
        FROM public.inventory_logs
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_idempotent_duplicate', true,
                'log_id', v_existing_log.id,
                'new_balance', v_existing_log.new_balance,
                'message', '该操作已成功执行（幂等重复拦截）'
            );
        END IF;
    END IF;

    SELECT * INTO v_rec
    FROM public.materials_3d
    WHERE id = p_material_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到指定的3D打印耗材记录 (ID: %)', p_material_id;
    END IF;

    IF NOT v_rec.is_active THEN
        RAISE EXCEPTION 'ERR_ITEM_INACTIVE: 该耗材已被停用，禁止进行库存变更';
    END IF;

    v_prev_weight := v_rec.remaining_weight_g;

    IF p_operation_type = 'inbound' THEN
        IF p_change_amount_g <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 入库重量必须大于 0 克';
        END IF;
        v_new_weight := v_prev_weight + p_change_amount_g;

    ELSIF p_operation_type = 'consume' THEN
        IF p_change_amount_g <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 消耗重量必须大于 0 克';
        END IF;
        IF v_prev_weight < p_change_amount_g THEN
            RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: 当前剩余重量不足 (现有: % g, 请求扣减: % g)', v_prev_weight, p_change_amount_g;
        END IF;
        v_new_weight := v_prev_weight - p_change_amount_g;

    ELSIF p_operation_type = 'scrap' THEN
        IF p_change_amount_g <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 报损重量必须大于 0 克';
        END IF;
        IF v_prev_weight < p_change_amount_g THEN
            RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: 报损重量超过当前在库量 (现有: % g, 请求报损: % g)', v_prev_weight, p_change_amount_g;
        END IF;
        v_new_weight := v_prev_weight - p_change_amount_g;

    ELSIF p_operation_type IN ('stocktake', 'adjust') THEN
        IF p_change_amount_g < 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 盘点后剩余重量不能为负数';
        END IF;
        v_new_weight := p_change_amount_g;
    ELSE
        RAISE EXCEPTION 'ERR_INVALID_OP: 未知的操作类型: %', p_operation_type;
    END IF;

    UPDATE public.materials_3d
    SET remaining_weight_g = v_new_weight,
        updated_at = now()
    WHERE id = p_material_id;

    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes, idempotency_key
    ) VALUES (
        'material_3d', p_material_id, v_rec.name,
        p_operation_type, (v_new_weight - v_prev_weight), 'g',
        v_prev_weight, v_new_weight,
        (v_actor ->> 'id')::UUID, v_actor ->> 'name', p_notes, p_idempotency_key
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'material_id', p_material_id,
        'material_name', v_rec.name,
        'previous_weight_g', v_prev_weight,
        'new_weight_g', v_new_weight,
        'log_id', v_log_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 5. 通用消耗品库存原子操作（身份改取 auth.uid()）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_adjust_consumable_stock(
    p_consumable_id UUID,
    p_operation_type TEXT,
    p_change_amount NUMERIC,
    p_operator_id UUID DEFAULT NULL,      -- 已废弃：仅作旧客户端兼容占位
    p_operator_name TEXT DEFAULT '',      -- 已废弃：仅作旧客户端兼容占位
    p_notes TEXT DEFAULT '',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_actor JSONB;
    v_rec RECORD;
    v_prev_stock NUMERIC(10,2);
    v_new_stock NUMERIC(10,2);
    v_log_id UUID;
    v_existing_log RECORD;
BEGIN
    v_actor := public.fn_require_approved_actor('物资库存变更');

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id, new_balance INTO v_existing_log
        FROM public.inventory_logs
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_idempotent_duplicate', true,
                'log_id', v_existing_log.id,
                'new_balance', v_existing_log.new_balance,
                'message', '该操作已成功执行（幂等重复拦截）'
            );
        END IF;
    END IF;

    SELECT * INTO v_rec
    FROM public.general_consumables
    WHERE id = p_consumable_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到指定的消耗品记录 (ID: %)', p_consumable_id;
    END IF;

    IF NOT v_rec.is_active THEN
        RAISE EXCEPTION 'ERR_ITEM_INACTIVE: 该耗材已被停用，禁止进行库存变更';
    END IF;

    v_prev_stock := v_rec.current_stock;

    IF p_operation_type = 'inbound' THEN
        IF p_change_amount <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 入库数量必须大于 0';
        END IF;
        v_new_stock := v_prev_stock + p_change_amount;

    ELSIF p_operation_type = 'consume' THEN
        IF p_change_amount <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 领用数量必须大于 0';
        END IF;
        IF v_prev_stock < p_change_amount THEN
            RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: 当前在库数量不足 (现有: % %, 请求领用: % %)', v_prev_stock, v_rec.unit, p_change_amount, v_rec.unit;
        END IF;
        v_new_stock := v_prev_stock - p_change_amount;

    ELSIF p_operation_type = 'scrap' THEN
        IF p_change_amount <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 报损数量必须大于 0';
        END IF;
        IF v_prev_stock < p_change_amount THEN
            RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: 报损数量超出当前库存量 (现有: % %, 请求报损: % %)', v_prev_stock, v_rec.unit, p_change_amount, v_rec.unit;
        END IF;
        v_new_stock := v_prev_stock - p_change_amount;

    ELSIF p_operation_type IN ('stocktake', 'adjust') THEN
        IF p_change_amount < 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 盘点后库存不能为负数';
        END IF;
        v_new_stock := p_change_amount;
    ELSE
        RAISE EXCEPTION 'ERR_INVALID_OP: 未知的操作类型: %', p_operation_type;
    END IF;

    UPDATE public.general_consumables
    SET current_stock = v_new_stock,
        updated_at = now()
    WHERE id = p_consumable_id;

    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes, idempotency_key
    ) VALUES (
        'consumable', p_consumable_id, v_rec.name,
        p_operation_type, (v_new_stock - v_prev_stock), v_rec.unit,
        v_prev_stock, v_new_stock,
        (v_actor ->> 'id')::UUID, v_actor ->> 'name', p_notes, p_idempotency_key
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'consumable_id', p_consumable_id,
        'consumable_name', v_rec.name,
        'unit', v_rec.unit,
        'previous_stock', v_prev_stock,
        'new_stock', v_new_stock,
        'log_id', v_log_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 6. 工具借出原子登记
--    借用人身份恒为登录者本人；p_borrower_name 仅作为“实际使用人”备注文字保留。
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_borrow_tool(
    p_tool_id UUID,
    p_borrow_quantity INTEGER,
    p_borrower_id UUID DEFAULT NULL,       -- 已废弃：仅作旧客户端兼容占位
    p_borrower_name TEXT DEFAULT '',
    p_contact_info TEXT,
    p_expected_return_at TIMESTAMPTZ,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_actor JSONB;
    v_actor_id UUID;
    v_loan_name TEXT;
    v_tool RECORD;
    v_loan_id UUID;
    v_log_id UUID;
BEGIN
    v_actor := public.fn_require_approved_actor('工具借出登记');
    v_actor_id := (v_actor ->> 'id')::UUID;

    v_loan_name := coalesce(nullif(trim(p_borrower_name), ''), v_actor ->> 'name');

    IF p_borrow_quantity <= 0 THEN
        RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 借出数量必须大于 0';
    END IF;

    SELECT * INTO v_tool
    FROM public.reusable_tools
    WHERE id = p_tool_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到指定的工具记录 (ID: %)', p_tool_id;
    END IF;

    IF NOT v_tool.is_active THEN
        RAISE EXCEPTION 'ERR_ITEM_INACTIVE: 该工具已停用，不可借出';
    END IF;

    IF v_tool.available_quantity < p_borrow_quantity THEN
        RAISE EXCEPTION 'ERR_TOOL_NOT_AVAILABLE: 工具可用库存不足 (可用: % 件, 申请借出: % 件)', v_tool.available_quantity, p_borrow_quantity;
    END IF;

    UPDATE public.reusable_tools
    SET available_quantity = available_quantity - p_borrow_quantity,
        borrowed_quantity = borrowed_quantity + p_borrow_quantity,
        updated_at = now()
    WHERE id = p_tool_id;

    INSERT INTO public.tool_loans (
        tool_id, tool_name, borrow_quantity,
        borrower_id, borrower_name, contact_info,
        borrowed_at, expected_return_at, status, notes
    ) VALUES (
        p_tool_id, v_tool.name, p_borrow_quantity,
        v_actor_id, v_loan_name, p_contact_info,
        now(), p_expected_return_at, 'borrowed', p_notes
    ) RETURNING id INTO v_loan_id;

    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes
    ) VALUES (
        'tool', p_tool_id, v_tool.name,
        'adjust', -p_borrow_quantity, '件',
        v_tool.available_quantity, (v_tool.available_quantity - p_borrow_quantity),
        v_actor_id, v_actor ->> 'name',
        format('工具借出登记（单号: %s, 登记使用人: %s）', v_loan_id, v_loan_name)
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', v_loan_id,
        'tool_id', p_tool_id,
        'tool_name', v_tool.name,
        'borrow_quantity', p_borrow_quantity,
        'available_remaining', (v_tool.available_quantity - p_borrow_quantity)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 7. 工具归还核销（归还操作人改取 auth.uid()）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_return_tool(
    p_loan_id UUID,
    p_return_operator_id UUID DEFAULT NULL,   -- 已废弃：仅作旧客户端兼容占位
    p_return_operator_name TEXT DEFAULT '',   -- 已废弃：仅作旧客户端兼容占位
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_actor JSONB;
    v_actor_id UUID;
    v_loan RECORD;
    v_tool RECORD;
    v_log_id UUID;
BEGIN
    v_actor := public.fn_require_approved_actor('工具归还核销');
    v_actor_id := (v_actor ->> 'id')::UUID;

    SELECT * INTO v_loan
    FROM public.tool_loans
    WHERE id = p_loan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到指定的借还记录 (ID: %)', p_loan_id;
    END IF;

    IF v_loan.status = 'returned' THEN
        RAISE EXCEPTION 'ERR_ALREADY_RETURNED: 该借出单据此前已完成归还';
    END IF;

    SELECT * INTO v_tool
    FROM public.reusable_tools
    WHERE id = v_loan.tool_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 借还单关联的工具原记录不存在 (Tool ID: %)', v_loan.tool_id;
    END IF;

    UPDATE public.reusable_tools
    SET available_quantity = available_quantity + v_loan.borrow_quantity,
        borrowed_quantity = borrowed_quantity - v_loan.borrow_quantity,
        updated_at = now()
    WHERE id = v_loan.tool_id;

    UPDATE public.tool_loans
    SET status = 'returned',
        returned_at = now(),
        return_operator_id = v_actor_id,
        notes = CASE
            WHEN p_notes <> '' THEN coalesce(notes, '') || ' | 归还说明: ' || p_notes
            ELSE notes
        END
    WHERE id = p_loan_id;

    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes
    ) VALUES (
        'tool', v_tool.id, v_tool.name,
        'adjust', v_loan.borrow_quantity, '件',
        v_tool.available_quantity, (v_tool.available_quantity + v_loan.borrow_quantity),
        v_actor_id, v_actor ->> 'name',
        format('工具归还核销（单号: %s, 借用人: %s）', p_loan_id, v_loan.borrower_name)
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_id,
        'tool_id', v_tool.id,
        'tool_name', v_tool.name,
        'returned_quantity', v_loan.borrow_quantity,
        'available_now', (v_tool.available_quantity + v_loan.borrow_quantity)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 8. 管理员审核用户注册与状态流转
--    调用者身份改取 auth.uid()；新增“最后一个管理员不可自我降级”防锁死保护。
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_user_registration(
    p_target_user_id UUID,
    p_status TEXT,      -- 'approved', 'rejected', 'disabled', 'pending'
    p_role TEXT,        -- 'admin', 'member'
    p_admin_id UUID DEFAULT NULL   -- 已废弃：仅作旧客户端兼容占位
) RETURNS JSONB AS $$
DECLARE
    v_actor JSONB;
    v_actor_id UUID;
    v_target_rec RECORD;
    v_active_admin_count INTEGER;
BEGIN
    v_actor := public.fn_require_approved_actor('用户审核');
    v_actor_id := (v_actor ->> 'id')::UUID;

    IF v_actor ->> 'role' <> 'admin' THEN
        RAISE EXCEPTION 'ERR_FORBIDDEN: 只有已激活的系统管理员有权执行用户审核或角色调整';
    END IF;

    IF p_status NOT IN ('approved', 'rejected', 'disabled', 'pending') THEN
        RAISE EXCEPTION 'ERR_INVALID_STATUS: 非法的用户状态: %', p_status;
    END IF;

    IF p_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION 'ERR_INVALID_ROLE: 非法的用户角色: %', p_role;
    END IF;

    SELECT * INTO v_target_rec
    FROM public.users_profile
    WHERE id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到目标用户 (ID: %)', p_target_user_id;
    END IF;

    -- 防锁死：不可把最后一个在任管理员降级或停用
    IF p_target_user_id = v_actor_id
       AND (p_status <> 'approved' OR p_role <> 'admin') THEN
        SELECT count(*) INTO v_active_admin_count
        FROM public.users_profile
        WHERE role = 'admin' AND status = 'approved';

        IF v_active_admin_count <= 1 THEN
            RAISE EXCEPTION 'ERR_LAST_ADMIN: 系统中仅剩这一名在任管理员，禁止自我降级或停用';
        END IF;
    END IF;

    UPDATE public.users_profile
    SET status = p_status,
        role = p_role,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'new_status', p_status,
        'new_role', p_role,
        'reviewed_by', v_actor_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 9. 函数执行权限收紧：业务 RPC 只开放给已登录成员，匿名角色一律拒绝
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_sync_new_auth_user_to_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_require_approved_actor(TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_adjust_material_3d_weight(UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_adjust_consumable_stock(UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_borrow_tool(UUID, INTEGER, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_return_tool(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_audit_user_registration(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_adjust_material_3d_weight(UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_adjust_consumable_stock(UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_borrow_tool(UUID, INTEGER, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_return_tool(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_audit_user_registration(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 策略辅助函数需要被 RLS 表达式在各角色下求值，保持开放
GRANT EXECUTE ON FUNCTION public.fn_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_approved_member() TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 10. 表级授权显式化：使部署结果与建项目时“自动暴露新表”开关的取值无关
--     建项目时若关闭该开关，public 模式下新建的表不会自动获得 Data API 权限，
--     前端 REST 查询会直接 permission denied；若开启，anon 角色也会被默认授予权限。
--     这里统一改为手动精确授权：anon 一律收回（未登录者对业务表零访问），
--     authenticated 拿到表级增删改查，但每一行仍受 03 迁移的 RLS 策略约束，
--     未审核 (pending) 账号在任何表上都查不到、改不了数据。
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON TABLE public.users_profile         FROM anon;
REVOKE ALL ON TABLE public.storage_locations     FROM anon;
REVOKE ALL ON TABLE public.categories            FROM anon;
REVOKE ALL ON TABLE public.materials_3d          FROM anon;
REVOKE ALL ON TABLE public.general_consumables   FROM anon;
REVOKE ALL ON TABLE public.reusable_tools        FROM anon;
REVOKE ALL ON TABLE public.inventory_logs        FROM anon;
REVOKE ALL ON TABLE public.tool_loans            FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_profile       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_locations   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials_3d        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_consumables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reusable_tools      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_logs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_loans          TO authenticated;


-- ------------------------------------------------------------------------------
-- 11. 执行后自检（可选，逐条单独运行查看结果）
--   SELECT count(*) FROM auth.users u
--     LEFT JOIN public.users_profile p ON p.id = u.id WHERE p.id IS NULL;
--   -- 期望 0：所有注册用户都已有档案行
--   SELECT proname, prosecdef FROM pg_proc
--     WHERE pronamespace = 'public' AND proname LIKE 'fn_%';
--   -- 期望 5 个业务 RPC + 2 个策略辅助 + 2 个新增辅助均为 t (SECURITY DEFINER)
--   SELECT has_table_privilege('anon', 'public.materials_3d', 'SELECT') AS anon_leaked;
--   -- 期望 false
-- ------------------------------------------------------------------------------
