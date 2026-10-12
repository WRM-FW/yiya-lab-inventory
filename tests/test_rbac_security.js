// ==============================================================================
// 模块: RBAC 角色权限与审核流转安全性测试套件
// ==============================================================================

export class MockRBACSystem {
    constructor() {
        this.users = new Map();
    }

    registerUser(email, fullName, requestedRole = 'member') {
        const id = 'user_' + (this.users.size + 1);
        const user = {
            id,
            email,
            fullName,
            role: 'member', // 强行重置，忽略请求参数
            status: 'pending' // 必须待审核
        };
        this.users.set(id, user);
        return user;
    }

    canAccessInventory(userId) {
        const user = this.users.get(userId);
        if (!user) return false;
        return user.status === 'approved';
    }

    updateUserProfile(actorId, targetUserId, payload) {
        const actor = this.users.get(actorId);
        if (!actor) throw new Error('ERR_UNAUTHORIZED: 未登录');

        const target = this.users.get(targetUserId);
        if (!target) throw new Error('ERR_NOT_FOUND: 目标用户不存在');

        if (actor.role !== 'admin' || actor.status !== 'approved') {
            if (payload.role !== undefined && payload.role !== target.role) {
                throw new Error('ERR_FORBIDDEN: 普通成员严禁自行修改或提升系统角色');
            }
            if (payload.status !== undefined && payload.status !== target.status) {
                throw new Error('ERR_FORBIDDEN: 普通成员严禁自行修改账号审核状态');
            }
        }

        if (payload.role) target.role = payload.role;
        if (payload.status) target.status = payload.status;
        if (payload.fullName) target.fullName = payload.fullName;

        return target;
    }
}

export function runRBACSecurityTests() {
    console.log('--- [测试套件 4: RBAC 角色权限、注册审核与防越权测试] ---');
    let passed = 0;
    let failed = 0;

    const rbac = new MockRBACSystem();

    const admin = {
        id: 'admin_root',
        email: 'admin@yiya-lab.edu.cn',
        fullName: '系统管理员',
        role: 'admin',
        status: 'approved'
    };
    rbac.users.set(admin.id, admin);

    // 2. 新用户注册强制锁定为 pending
    const newStudent = rbac.registerUser('student@yiya-lab.edu.cn', '陈同学', 'admin');
    if (newStudent.role === 'member' && newStudent.status === 'pending') {
        console.log('  ✓ [通过] 注册安全防御生效: 恶意声明 admin 被强制纠正为 member & pending');
        passed++;
    } else {
        console.error('  ✗ [失败] 注册角色未受控');
        failed++;
    }

    // 3. 待审核用户无权访问物资数据
    if (!rbac.canAccessInventory(newStudent.id)) {
        console.log('  ✓ [通过] 待审核状态隔离: pending 用户被严格阻断于物资数据之外');
        passed++;
    } else {
        console.error('  ✗ [失败] 待审核用户非法穿透数据');
        failed++;
    }

    // 4. 普通用户尝试自我提权拦截
    try {
        rbac.updateUserProfile(newStudent.id, newStudent.id, { role: 'admin', status: 'approved' });
        console.error('  ✗ [失败] 未拦截自我提权攻击');
        failed++;
    } catch (e) {
        console.log(`  ✓ [通过] 自我提权防护生效: ${e.message}`);
        passed++;
    }

    // 5. 管理员合法审核通过
    rbac.updateUserProfile(admin.id, newStudent.id, { status: 'approved' });
    if (newStudent.status === 'approved' && rbac.canAccessInventory(newStudent.id)) {
        console.log('  ✓ [通过] 管理员审核成功: 用户转为 approved 并获得物资访问权');
        passed++;
    } else {
        console.error('  ✗ [失败] 管理员审核流转失败');
        failed++;
    }

    // 6. 管理员禁用账号即刻吊销权限
    rbac.updateUserProfile(admin.id, newStudent.id, { status: 'disabled' });
    if (!rbac.canAccessInventory(newStudent.id)) {
        console.log('  ✓ [通过] 账号禁用防御: disabled 成员即刻丧失数据访问权');
        passed++;
    } else {
        console.error('  ✗ [失败] 禁用未生效');
        failed++;
    }

    console.log(`套件 4 统计: 通过 ${passed}, 失败 ${failed}\n`);
    if (failed > 0) throw new Error('RBAC security tests failed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runRBACSecurityTests();
}
