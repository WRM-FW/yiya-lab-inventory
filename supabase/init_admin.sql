-- ==============================================================================
-- 首个管理员初始化脚本 (Bootstrap Initial Administrator)
-- 项目：义牙实验室物资与耗材管理系统
-- ==============================================================================
-- 【使用说明】
-- 1. 新项目初始化时，请先让负责实验室的老师或管理学生通过前端注册页面注册一个普通账号
--    （例如邮箱：admin@yiya-lab.edu.cn 或 admin@lab.local）。
-- 2. 注册完成后，该账号在数据库中默认处于 pending 待审核状态，无任何数据权限。
-- 3. 项目负责人在 Supabase 控制台的 SQL Editor 中执行本脚本，将目标邮箱绑定为主管理员。
-- 4. 执行后，该账号立即激活 (approved) 且赋予系统最高权限 (admin)。
-- 5. 本方式彻底杜绝了前端公开 API 接口被恶意提权的隐患。
-- ==============================================================================

DO $$
DECLARE
    -- 请在此处配置首个管理员的注册邮箱
    target_admin_email TEXT := 'admin@yiya-lab.edu.cn';
    target_user_id UUID;
BEGIN
    -- 1. 在 auth.users 中寻找注册记录
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_admin_email;

    IF target_user_id IS NULL THEN
        RAISE NOTICE '【提示】未在 auth.users 中找到邮箱为 % 的注册用户。请先在前端完成注册后再执行本脚本，或直接执行下方离线测试虚拟账号插入。', target_admin_email;
    ELSE
        -- 2. 更新或补全 public.users_profile 档案
        INSERT INTO public.users_profile (
            id, email, full_name, student_or_staff_id, role, status, reviewed_at
        ) VALUES (
            target_user_id,
            target_admin_email,
            '实验室主管理员',
            'LAB-ADMIN-001',
            'admin',
            'approved',
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            status = 'approved',
            reviewed_at = now(),
            updated_at = now();

        RAISE NOTICE '【成功】已成功将用户 % (ID: %) 提升并激活为系统主管理员！', target_admin_email, target_user_id;
    END IF;
END $$;
