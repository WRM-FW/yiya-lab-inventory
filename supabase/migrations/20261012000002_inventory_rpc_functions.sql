-- ==============================================================================
-- 迁移文件 02: 原子操作与并发安全存储过程 (RPC Functions)
-- 项目：义牙实验室物资与耗材管理系统
-- ==============================================================================

-- 1. 3D 打印耗材重量原子操作 (入库、消耗、报损、盘点、调整)
CREATE OR REPLACE FUNCTION public.fn_adjust_material_3d_weight(
    p_material_id UUID,
    p_operation_type TEXT,
    p_change_amount_g NUMERIC,
    p_operator_id UUID,
    p_operator_name TEXT,
    p_notes TEXT DEFAULT '',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_prev_weight NUMERIC(10,2);
    v_new_weight NUMERIC(10,2);
    v_log_id UUID;
    v_existing_log RECORD;
BEGIN
    -- 幂等性检查：若携带唯一键且已存在，直接返回先前日志结果
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

    -- 锁定目标记录，防止并发竞态
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

    -- 核心逻辑分流
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
        -- 盘点重置为目标绝对重量
        IF p_change_amount_g < 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 盘点后剩余重量不能为负数';
        END IF;
        v_new_weight := p_change_amount_g;
    ELSE
        RAISE EXCEPTION 'ERR_INVALID_OP: 未知的操作类型: %', p_operation_type;
    END IF;

    -- 更新主表
    UPDATE public.materials_3d
    SET remaining_weight_g = v_new_weight,
        updated_at = now()
    WHERE id = p_material_id;

    -- 写入审计流水
    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes, idempotency_key
    ) VALUES (
        'material_3d', p_material_id, v_rec.name,
        p_operation_type, (v_new_weight - v_prev_weight), 'g',
        v_prev_weight, v_new_weight,
        p_operator_id, p_operator_name, p_notes, p_idempotency_key
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


-- 2. 通用消耗品库存原子操作 (入库、领用、报损、盘点、调整)
CREATE OR REPLACE FUNCTION public.fn_adjust_consumable_stock(
    p_consumable_id UUID,
    p_operation_type TEXT,
    p_change_amount NUMERIC,
    p_operator_id UUID,
    p_operator_name TEXT,
    p_notes TEXT DEFAULT '',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_prev_stock NUMERIC(10,2);
    v_new_stock NUMERIC(10,2);
    v_log_id UUID;
    v_existing_log RECORD;
BEGIN
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
        p_operator_id, p_operator_name, p_notes, p_idempotency_key
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


-- 3. 可重复使用工具借出原子登记
CREATE OR REPLACE FUNCTION public.fn_borrow_tool(
    p_tool_id UUID,
    p_borrow_quantity INTEGER,
    p_borrower_id UUID,
    p_borrower_name TEXT,
    p_contact_info TEXT,
    p_expected_return_at TIMESTAMPTZ,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_tool RECORD;
    v_loan_id UUID;
    v_log_id UUID;
BEGIN
    IF p_borrow_quantity <= 0 THEN
        RAISE EXCEPTION 'ERR_INVALID_AMOUNT: 借出数量必须大于 0';
    END IF;

    -- 锁定工具行
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

    -- 更新工具数量
    UPDATE public.reusable_tools
    SET available_quantity = available_quantity - p_borrow_quantity,
        borrowed_quantity = borrowed_quantity + p_borrow_quantity,
        updated_at = now()
    WHERE id = p_tool_id;

    -- 插入借还记录
    INSERT INTO public.tool_loans (
        tool_id, tool_name, borrow_quantity,
        borrower_id, borrower_name, contact_info,
        borrowed_at, expected_return_at, status, notes
    ) VALUES (
        p_tool_id, v_tool.name, p_borrow_quantity,
        p_borrower_id, p_borrower_name, p_contact_info,
        now(), p_expected_return_at, 'borrowed', p_notes
    ) RETURNING id INTO v_loan_id;

    -- 插入审计流水
    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes
    ) VALUES (
        'tool', p_tool_id, v_tool.name,
        'adjust', -p_borrow_quantity, '件',
        v_tool.available_quantity, (v_tool.available_quantity - p_borrow_quantity),
        p_borrower_id, p_borrower_name, format('工具借出登记（单号: %s, 借用人: %s）', v_loan_id, p_borrower_name)
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


-- 4. 可重复使用工具归还核销
CREATE OR REPLACE FUNCTION public.fn_return_tool(
    p_loan_id UUID,
    p_return_operator_id UUID,
    p_return_operator_name TEXT,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_loan RECORD;
    v_tool RECORD;
    v_log_id UUID;
BEGIN
    -- 锁定借还记录
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

    -- 锁定工具主记录
    SELECT * INTO v_tool
    FROM public.reusable_tools
    WHERE id = v_loan.tool_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 借还单关联的工具原记录不存在 (Tool ID: %)', v_loan.tool_id;
    END IF;

    -- 更新工具库存
    UPDATE public.reusable_tools
    SET available_quantity = available_quantity + v_loan.borrow_quantity,
        borrowed_quantity = borrowed_quantity - v_loan.borrow_quantity,
        updated_at = now()
    WHERE id = v_loan.tool_id;

    -- 更新借还单据
    UPDATE public.tool_loans
    SET status = 'returned',
        returned_at = now(),
        return_operator_id = p_return_operator_id,
        notes = CASE 
            WHEN p_notes <> '' THEN coalesce(notes, '') || ' | 归还说明: ' || p_notes 
            ELSE notes 
        END
    WHERE id = p_loan_id;

    -- 记录操作流水
    INSERT INTO public.inventory_logs (
        target_type, target_id, target_name,
        operation_type, change_amount, unit,
        previous_balance, new_balance,
        operator_id, operator_name, notes
    ) VALUES (
        'tool', v_tool.id, v_tool.name,
        'adjust', v_loan.borrow_quantity, '件',
        v_tool.available_quantity, (v_tool.available_quantity + v_loan.borrow_quantity),
        p_return_operator_id, p_return_operator_name, format('工具归还核销（单号: %s, 借用人: %s）', p_loan_id, v_loan.borrower_name)
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


-- 5. 管理员审核用户注册与状态流转
CREATE OR REPLACE FUNCTION public.fn_audit_user_registration(
    p_target_user_id UUID,
    p_status TEXT, -- 'approved', 'rejected', 'disabled'
    p_role TEXT,   -- 'admin', 'member'
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_admin_rec RECORD;
    v_target_rec RECORD;
BEGIN
    -- 严格权限校验：执行人必须具备 admin 角色且已处于 approved 状态
    SELECT role, status INTO v_admin_rec
    FROM public.users_profile
    WHERE id = p_admin_id;

    IF NOT FOUND OR v_admin_rec.role <> 'admin' OR v_admin_rec.status <> 'approved' THEN
        RAISE EXCEPTION 'ERR_FORBIDDEN: 只有已激活的系统管理员有权执行用户审核或角色调整';
    END IF;

    IF p_status NOT IN ('approved', 'rejected', 'disabled', 'pending') THEN
        RAISE EXCEPTION 'ERR_INVALID_STATUS: 非法的用户状态: %', p_status;
    END IF;

    IF p_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION 'ERR_INVALID_ROLE: 非法的用户角色: %', p_role;
    END IF;

    -- 锁定并更新目标用户
    SELECT * INTO v_target_rec
    FROM public.users_profile
    WHERE id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_NOT_FOUND: 未找到目标用户 (ID: %)', p_target_user_id;
    END IF;

    UPDATE public.users_profile
    SET status = p_status,
        role = p_role,
        reviewed_by = p_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'new_status', p_status,
        'new_role', p_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
