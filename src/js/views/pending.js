// ==============================================================================
// 视图: 待审核状态提示页 (Pending Status View)
// ==============================================================================

import { store } from '../store.js';
import { toast } from '../components/toast.js';

export function renderPendingView(container) {
    const user = store.currentUser;
    const isSandbox = store.mode === 'sandbox';

    container.innerHTML = `
        <div style="max-width: 520px; margin: 3rem auto; padding: 2.2rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); border: 1px solid var(--neutral-200); text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">⏳</div>
            <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--neutral-900);">账号待审核中</h2>
            <p style="font-size: 0.9rem; color: var(--neutral-600); margin-top: 0.5rem; line-height: 1.6;">
                尊敬的 <b>${user ? user.fullName : '申请人'}</b>：<br>
                您的义牙实验室系统账号注册申请已成功录入，当前正在等待实验室管理员（指导教师或主管助理）进行身份核验。
            </p>

            <div style="margin: 1.5rem 0; padding: 1rem; background-color: var(--neutral-50); border-radius: var(--radius-sm); border: 1px solid var(--neutral-200); text-align: left; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                    <span style="color: var(--neutral-500);">申请账号：</span>
                    <span style="font-weight: 600;">${user ? user.email : '-'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                    <span style="color: var(--neutral-500);">学号/工号：</span>
                    <span>${user ? (user.studentOrStaffId || '未填写') : '-'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--neutral-500);">当前状态：</span>
                    <span class="badge badge-warning">Pending (待审核隔离保护)</span>
                </div>
            </div>

            <p style="font-size: 0.8rem; color: var(--neutral-500); margin-bottom: 1.5rem;">
                根据实验室数据安全规则，待审核用户无法检索或操作受保护的 3D 线材、通用消耗品和工具库存数据。
            </p>

            ${isSandbox ? `
            <div style="margin-bottom: 1.5rem; padding: 0.75rem; background: #f0fdf4; border: 1px dashed var(--success); border-radius: var(--radius-sm); font-size: 0.8rem; color: #166534;">
                <div style="font-weight: 600; margin-bottom: 0.35rem;">🛠️ 沙箱模式快捷体验：</div>
                您可以点击下方按钮模拟管理员一键审核通过，快速体验完整功能：
                <div style="margin-top: 0.5rem;">
                    <button class="btn btn-success btn-sm" id="btn-quick-approve-me">
                        ✅ 立即模拟通过审核
                    </button>
                </div>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: center; gap: 0.75rem;">
                <button class="btn btn-secondary" id="btn-refresh-status">刷新状态</button>
                <button class="btn btn-secondary" id="btn-pending-logout">退出登录</button>
            </div>
        </div>
    `;

    document.getElementById('btn-pending-logout').onclick = () => {
        store.logout();
        window.location.hash = '#login';
    };

    document.getElementById('btn-refresh-status').onclick = () => {
        store.init();
        if (store.currentUser?.status === 'approved') {
            toast.success('审核已通过！正在进入控制台...');
            window.location.hash = '#overview';
        } else {
            toast.info('当前状态仍为待审核，请稍后刷新或联系管理员');
        }
    };

    const approveBtn = document.getElementById('btn-quick-approve-me');
    if (approveBtn) {
        approveBtn.onclick = () => {
            const data = store.getSandboxData();
            const u = data.users.find(x => x.id === user.id);
            if (u) {
                u.status = 'approved';
                store.saveSandboxData(data);
                store.currentUser.status = 'approved';
                localStorage.setItem('yiya_current_user', JSON.stringify(store.currentUser));
                toast.success('模拟审核通过！已获得实验室成员权限！');
                window.location.hash = '#overview';
            }
        };
    }
}
