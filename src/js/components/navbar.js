// ==============================================================================
// 组件: 顶部导航条 (Navbar Component)
// ==============================================================================

import { store } from '../store.js';
import { APP_CONFIG } from '../config.js';
import { modal } from './modal.js';
import { toast } from './toast.js';

export function renderNavbar(currentRoute) {
    const user = store.currentUser;
    const mode = store.mode;
    const isAdmin = user && user.role === 'admin' && user.status === 'approved';
    const isApproved = user && user.status === 'approved';

    let navLinksHtml = '';
    if (user && isApproved) {
        navLinksHtml = `
            <a class="nav-link ${currentRoute === 'overview' ? 'active' : ''}" href="#overview">📊 概览</a>
            <a class="nav-link ${currentRoute === 'materials3d' ? 'active' : ''}" href="#materials3d">🧵 3D耗材</a>
            <a class="nav-link ${currentRoute === 'consumables' ? 'active' : ''}" href="#consumables">📦 通用耗材</a>
            <a class="nav-link ${currentRoute === 'tools' ? 'active' : ''}" href="#tools">🔧 工具借还</a>
            <a class="nav-link ${currentRoute === 'stockOps' ? 'active' : ''}" href="#stockOps">⚡ 出入库</a>
            <a class="nav-link ${currentRoute === 'logs' ? 'active' : ''}" href="#logs">📜 审计流水</a>
            ${isAdmin ? `<a class="nav-link ${currentRoute === 'adminUsers' ? 'active' : ''}" href="#adminUsers">🛡️ 审核与人员</a>` : ''}
        `;
    }

    let userSectionHtml = '';
    if (user) {
        let statusBadge = '';
        if (user.status === 'pending') {
            statusBadge = '<span class="role-pill role-pending">待审核</span>';
        } else if (user.role === 'admin') {
            statusBadge = '<span class="role-pill role-admin">管理员</span>';
        } else {
            statusBadge = '<span class="role-pill role-member">普通成员</span>';
        }

        userSectionHtml = `
            <div class="user-badge">
                <span>👤 ${user.fullName}</span>
                ${statusBadge}
            </div>
            ${mode === 'sandbox' ? `
            <button class="btn btn-secondary btn-sm" id="btn-quick-switch-user" title="切换模拟身份">
                🔄 切换测试角色
            </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" id="btn-logout" title="退出登录">退出</button>
        `;
    } else {
        userSectionHtml = `
            <a href="#login" class="btn btn-secondary btn-sm">登录</a>
            <a href="#register" class="btn btn-primary btn-sm">注册申请</a>
        `;
    }

    const html = `
        <div class="nav-container">
            <a href="${isApproved ? '#overview' : '#login'}" class="brand">
                <span class="brand-badge">义牙实验室</span>
                <span style="font-size: 1rem; color: var(--neutral-800);">物资管理</span>
            </a>

            <button class="menu-toggle" id="btn-menu-toggle" aria-label="Toggle menu">☰</button>

            <nav class="nav-links" id="nav-links-menu">
                ${navLinksHtml}
            </nav>

            <div class="nav-user">
                <!-- 运行模式指示器 -->
                <div class="mode-switch-pill" id="btn-mode-config" title="点击配置运行环境与 Supabase 连接">
                    <span class="mode-dot ${mode === 'supabase' ? 'online' : 'sandbox'}"></span>
                    <span>${mode === 'supabase' ? 'Supabase 云端' : '本地沙箱演示'}</span>
                </div>
                ${userSectionHtml}
            </div>
        </div>
    `;

    const navEl = document.getElementById('navbar-root');
    if (navEl) {
        navEl.innerHTML = html;
        attachNavbarEvents();
    }
}

function attachNavbarEvents() {
    // 移动端菜单展开折叠
    const toggleBtn = document.getElementById('btn-menu-toggle');
    const menuEl = document.getElementById('nav-links-menu');
    if (toggleBtn && menuEl) {
        toggleBtn.onclick = () => {
            menuEl.classList.toggle('show');
        };
    }

    // 退出登录
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            store.logout();
            window.location.hash = '#login';
            toast.info('已安全退出登录');
        };
    }

    // 快速切换沙箱用户（极速验证管理员、成员、待审核用户的不同视角）
    const switchUserBtn = document.getElementById('btn-quick-switch-user');
    if (switchUserBtn) {
        switchUserBtn.onclick = () => {
            const data = store.getSandboxData();
            let optionsHtml = data.users.map(u => `
                <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid var(--neutral-200); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${u.fullName} <span style="font-size: 0.75rem; color: var(--neutral-500);">${u.email}</span></div>
                        <div style="font-size: 0.8rem; margin-top: 2px;">
                            角色: <b>${u.role}</b> | 状态: <b style="color: ${u.status === 'approved' ? 'var(--success)' : 'var(--warning)'};">${u.status}</b>
                        </div>
                    </div>
                    <button class="btn ${store.currentUser?.id === u.id ? 'btn-secondary' : 'btn-primary'} btn-sm select-user-btn" data-uid="${u.id}">
                        ${store.currentUser?.id === u.id ? '当前角色' : '切换为此人'}
                    </button>
                </div>
            `).join('');

            modal.open({
                title: '沙箱角色快速模拟切换',
                content: `
                    <p style="font-size: 0.85rem; color: var(--neutral-600); margin-bottom: 1rem;">
                        本功能用于在本地或演示环境中，秒级切换不同身份以检验 RBAC 权限控制策略：
                    </p>
                    ${optionsHtml}
                `,
                footerButtons: [
                    {
                        text: '重置为初始种子数据',
                        className: 'btn-danger btn-sm',
                        onClick: (e, m) => {
                            if (confirm('确认将沙箱中的物资和操作记录恢复到初始状态吗？')) {
                                store.resetSandboxData();
                                toast.success('已恢复为初始种子演示数据');
                                m.close();
                            }
                        }
                    },
                    {
                        text: '关闭',
                        className: 'btn-secondary btn-sm',
                        onClick: (e, m) => m.close()
                    }
                ]
            });

            // 监听选中切换
            document.querySelectorAll('.select-user-btn').forEach(b => {
                b.onclick = (e) => {
                    const uid = e.target.getAttribute('data-uid');
                    store.switchUser(uid);
                    modal.close();
                    toast.success(`已切换身份为: ${store.currentUser.fullName}`);
                    // 根据新状态跳转
                    if (store.currentUser.status === 'pending') {
                        window.location.hash = '#pending';
                    } else {
                        window.location.hash = '#overview';
                    }
                };
            });
        };
    }

    // 运行模式配置弹窗
    const modeBtn = document.getElementById('btn-mode-config');
    if (modeBtn) {
        modeBtn.onclick = () => {
            const currentMode = store.mode;
            const sbConfig = APP_CONFIG.getSupabaseConfig();

            modal.open({
                title: '系统运行模式与 Supabase 设置',
                content: `
                    <div class="form-group">
                        <label class="form-label">运行模式选择</label>
                        <select class="form-select" id="cfg-mode">
                            <option value="sandbox" ${currentMode === 'sandbox' ? 'selected' : ''}>本地免配沙箱模式 (内置示例数据，即刻体验)</option>
                            <option value="supabase" ${currentMode === 'supabase' ? 'selected' : ''}>Supabase 云端数据库模式 (生产联调)</option>
                        </select>
                        <div class="form-help">本地沙箱可在无网络或演示时使用完整的出入库、借还与审核逻辑。</div>
                    </div>
                    <div id="cfg-supabase-fields" style="${currentMode === 'supabase' ? 'display: block;' : 'display: none;'}">
                        <div class="form-group">
                            <label class="form-label">Supabase Project URL</label>
                            <input class="form-input" id="cfg-url" placeholder="https://xyzcompany.supabase.co" value="${sbConfig.url}" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Supabase Anon Public Key</label>
                            <input class="form-input" id="cfg-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${sbConfig.anonKey}" />
                            <div class="form-help">请使用 Project Settings -> API 中的 anon public 密钥，严禁填入 service_role 密钥。</div>
                        </div>
                    </div>
                `,
                footerButtons: [
                    {
                        text: '取消',
                        className: 'btn-secondary',
                        onClick: (e, m) => m.close()
                    },
                    {
                        text: '保存并生效',
                        className: 'btn-primary',
                        onClick: (e, m) => {
                            const newMode = document.getElementById('cfg-mode').value;
                            const newUrl = document.getElementById('cfg-url').value;
                            const newKey = document.getElementById('cfg-key').value;

                            APP_CONFIG.setMode(newMode);
                            APP_CONFIG.setSupabaseConfig(newUrl, newKey);
                            store.mode = newMode;
                            store.init();
                            toast.success(`运行模式已切换为：${newMode === 'supabase' ? 'Supabase 云端' : '本地沙箱'}`);
                            m.close();
                            window.location.reload();
                        }
                    }
                ]
            });

            const modeSelect = document.getElementById('cfg-mode');
            const sbFields = document.getElementById('cfg-supabase-fields');
            modeSelect.onchange = () => {
                sbFields.style.display = modeSelect.value === 'supabase' ? 'block' : 'none';
            };
        };
    }
}
