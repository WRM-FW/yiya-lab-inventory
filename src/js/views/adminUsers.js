// ==============================================================================
// 视图: 管理员专区 - 注册审核与用户管理 (Admin & Users View)
// ==============================================================================

import { store } from '../store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderAdminUsersView(container) {
    const user = store.currentUser;
    if (!user || user.role !== 'admin' || user.status !== 'approved') {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
                <h3 style="color: var(--danger);">访问受限：需要管理员权限</h3>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.35rem;">
                    仅经授权的义牙实验室主管教师或系统管理员可访问用户审核与权限管理中心。
                </p>
                <div style="margin-top: 1rem;">
                    <a href="#overview" class="btn btn-secondary btn-sm">返回概览页</a>
                </div>
            </div>
        `;
        return;
    }

    const allUsers = await store.getUsers();
    const locations = await store.getLocations();
    const categories = await store.getCategories();

    const pendingUsers = allUsers.filter(u => u.status === 'pending');
    const managedUsers = allUsers.filter(u => u.status !== 'pending');

    container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">🛡️ 管理员工作台 · 用户审核与基础字典</h1>
            <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                严格控制实验室成员准入、权限指派，以及存放位置与分类字典维护
            </p>
        </div>

        <!-- 1. 待审核申请专区 -->
        <div class="card" style="margin-bottom: 1.5rem; border-top: 4px solid var(--warning);">
            <div class="card-header">
                <div class="card-title">
                    <span>⏳ 待审核新成员申请 (${pendingUsers.length})</span>
                </div>
                <span style="font-size: 0.78rem; color: var(--neutral-500);">新注册用户必须经管理员审核后方可访问库存数据</span>
            </div>

            ${pendingUsers.length === 0 ? `
                <div style="text-align: center; padding: 2rem 1rem; color: var(--neutral-400); font-size: 0.9rem;">
                    ✨ 当前暂无待审核的注册申请
                </div>
            ` : `
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>学号 / 工号</th>
                                <th>申请邮箱</th>
                                <th>当前状态</th>
                                <th style="text-align: right;">审核决策</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingUsers.map(u => `
                                <tr>
                                    <td style="font-weight: 600;">${u.fullName}</td>
                                    <td>${u.studentOrStaffId || '-'}</td>
                                    <td>${u.email}</td>
                                    <td><span class="badge badge-warning">Pending 待审核</span></td>
                                    <td style="text-align: right; white-space: nowrap;">
                                        <button class="btn btn-success btn-sm btn-audit" data-uid="${u.id}" data-action="approved" data-role="member">
                                            ✅ 准入为普通成员
                                        </button>
                                        <button class="btn btn-secondary btn-sm btn-audit" data-uid="${u.id}" data-action="approved" data-role="admin">
                                            🛡️ 设为管理员
                                        </button>
                                        <button class="btn btn-danger btn-sm btn-audit" data-uid="${u.id}" data-action="rejected" data-role="member">
                                            ❌ 驳回申请
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>

        <!-- 2. 实验室成员名录与权限管控 -->
        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="card-header">
                <div class="card-title">
                    <span>👥 实验室在籍成员与账号状态 (${managedUsers.length})</span>
                </div>
                <span style="font-size: 0.78rem; color: var(--neutral-500);">支持角色升降级与账号禁用/恢复</span>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>姓名</th>
                            <th>学号/工号</th>
                            <th>账号邮箱</th>
                            <th>系统角色</th>
                            <th>账号状态</th>
                            <th style="text-align: right;">操作管理</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${managedUsers.map(u => `
                            <tr style="${u.status === 'disabled' || u.status === 'rejected' ? 'opacity: 0.6; background: var(--neutral-100);' : ''}">
                                <td style="font-weight: 600;">${u.fullName}</td>
                                <td>${u.studentOrStaffId || '-'}</td>
                                <td>${u.email}</td>
                                <td>
                                    ${u.role === 'admin' ? '<span class="role-pill role-admin">管理员</span>' : '<span class="role-pill role-member">普通成员</span>'}
                                </td>
                                <td>
                                    ${u.status === 'approved' ? '<span class="badge badge-success">正常激活</span>' : (u.status === 'disabled' ? '<span class="badge badge-danger">已禁用</span>' : '<span class="badge badge-neutral">已驳回</span>')}
                                </td>
                                <td style="text-align: right; white-space: nowrap;">
                                    ${u.id !== user.id ? `
                                        <button class="btn btn-secondary btn-sm btn-toggle-role" data-uid="${u.id}" data-role="${u.role}">
                                            ${u.role === 'admin' ? '降为成员' : '设为管理员'}
                                        </button>
                                        <button class="btn ${u.status === 'approved' ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-user-status" data-uid="${u.id}" data-status="${u.status}">
                                            ${u.status === 'approved' ? '禁用账号' : '恢复激活'}
                                        </button>
                                    ` : '<span style="font-size: 0.78rem; color: var(--neutral-400);">当前登录主账号</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 3. 基础位置字典管理 -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <span>📍 实验室存放位置维护 (${locations.length})</span>
                </div>
                <button class="btn btn-primary btn-sm" id="btn-add-location">➕ 新增存放位置</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;">
                ${locations.map(loc => `
                    <div style="padding: 0.85rem; border: 1px solid var(--neutral-200); border-radius: var(--radius-sm); background: var(--neutral-50);">
                        <div style="font-weight: 600; color: var(--neutral-800);">${loc.name}</div>
                        <div style="font-size: 0.78rem; color: var(--neutral-500); margin-top: 3px;">${loc.description || '无附加说明'}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // 绑定审核操作
    container.querySelectorAll('.btn-audit').forEach(btn => {
        btn.onclick = async (e) => {
            const uid = e.currentTarget.getAttribute('data-uid');
            const targetAction = e.currentTarget.getAttribute('data-action');
            const targetRole = e.currentTarget.getAttribute('data-role');

            try {
                await store.auditUser(uid, targetAction, targetRole);
                toast.success('审核决策已提交并即刻生效！');
                renderAdminUsersView(container);
            } catch (err) {
                toast.error(err.message || '审核失败');
            }
        };
    });

    // 绑定角色切换
    container.querySelectorAll('.btn-toggle-role').forEach(btn => {
        btn.onclick = async (e) => {
            const uid = e.currentTarget.getAttribute('data-uid');
            const currentRole = e.currentTarget.getAttribute('data-role');
            const nextRole = currentRole === 'admin' ? 'member' : 'admin';
            if (confirm(`确认将该用户的系统角色调整为 [${nextRole === 'admin' ? '管理员' : '普通成员'}] 吗？`)) {
                try {
                    await store.auditUser(uid, 'approved', nextRole);
                    toast.success('角色已成功调整！');
                    renderAdminUsersView(container);
                } catch (err) {
                    toast.error(err.message || '调整失败');
                }
            }
        };
    });

    // 绑定启停用
    container.querySelectorAll('.btn-toggle-user-status').forEach(btn => {
        btn.onclick = async (e) => {
            const uid = e.currentTarget.getAttribute('data-uid');
            const currentStatus = e.currentTarget.getAttribute('data-status');
            const nextStatus = currentStatus === 'approved' ? 'disabled' : 'approved';
            const actionText = nextStatus === 'disabled' ? '禁用' : '激活';
            if (confirm(`确认要${actionText}该账号吗？被禁用的账号将无法查询或操作实验室物资。`)) {
                try {
                    const targetUser = allUsers.find(u => u.id === uid);
                    await store.auditUser(uid, nextStatus, targetUser?.role || 'member');
                    toast.success(`账号已成功${actionText}！`);
                    renderAdminUsersView(container);
                } catch (err) {
                    toast.error(err.message || '操作失败');
                }
            }
        };
    });

    // 新增存放位置
    document.getElementById('btn-add-location').onclick = () => {
        modal.open({
            title: '新增实验室存放位置',
            content: `
                <div class="form-group">
                    <label class="form-label">位置名称 <span style="color: var(--danger);">*</span></label>
                    <input class="form-input" id="new-loc-name" placeholder="例如：D区机甲加工台下方抽屉" required />
                </div>
                <div class="form-group">
                    <label class="form-label">位置详细说明</label>
                    <input class="form-input" id="new-loc-desc" placeholder="例如：存放比赛备用线束与标准件" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: '确认添加',
                    className: 'btn-primary',
                    onClick: async (e, m) => {
                        const name = document.getElementById('new-loc-name').value.trim();
                        const desc = document.getElementById('new-loc-desc').value.trim();
                        if (!name) {
                            toast.error('请填写位置名称！');
                            return;
                        }

                        if (store.mode === 'sandbox') {
                            const data = store.getSandboxData();
                            data.locations.push({
                                id: 'loc_' + Date.now(),
                                name,
                                description: desc
                            });
                            store.saveSandboxData(data);
                        } else {
                            // Supabase 模式调用 insert
                            await (await import('../supabaseClient.js')).supabase.from('storage_locations').insert([{
                                name, description: desc
                            }]);
                        }
                        toast.success('存放位置已添加！');
                        m.close();
                        renderAdminUsersView(container);
                    }
                }
            ]
        });
    };
}
