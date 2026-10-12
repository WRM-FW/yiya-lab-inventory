// ==============================================================================
// 视图: 登录页面 (Login View)
// ==============================================================================

import { store } from '../store.js';
import { toast } from '../components/toast.js';

export function renderLoginView(container) {
    container.innerHTML = `
        <div style="max-width: 440px; margin: 3rem auto; padding: 2rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); border: 1px solid var(--neutral-200);">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <span class="brand-badge" style="font-size: 0.85rem; padding: 6px 12px;">义牙实验室</span>
                <h2 style="font-size: 1.4rem; font-weight: 700; margin-top: 0.75rem; color: var(--neutral-900);">实验室物资与耗材管理系统</h2>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.25rem;">材料研究 · 3D 打印 · 焊接加工 · 工程竞赛</p>
            </div>

            <form id="form-login">
                <div class="form-group">
                    <label class="form-label" for="login-email">登录邮箱 / 校园邮箱</label>
                    <input type="email" id="login-email" class="form-input" placeholder="name@yiya-lab.edu.cn" required value="admin@yiya-lab.edu.cn" />
                </div>

                <div class="form-group">
                    <label class="form-label" for="login-password">密码</label>
                    <input type="password" id="login-password" class="form-input" placeholder="••••••••" required value="123456" />
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem; padding: 0.65rem;">
                    安全登录
                </button>
            </form>

            <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--neutral-200); text-align: center; font-size: 0.85rem; color: var(--neutral-600);">
                新成员加入？ <a href="#register" style="color: var(--primary); font-weight: 600; text-decoration: none;">提交注册申请</a>
            </div>

            <div style="margin-top: 1.25rem; background-color: var(--neutral-50); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px dashed var(--neutral-300); font-size: 0.78rem; color: var(--neutral-600);">
                <b>💡 演示账号提示：</b><br>
                • 管理员：<code>admin@yiya-lab.edu.cn</code> (密码任意)<br>
                • 成员：<code>student1@yiya-lab.edu.cn</code> (密码任意)<br>
                • 待审核：<code>applicant@yiya-lab.edu.cn</code> (用于观察待审核隔离状态)
            </div>
        </div>
    `;

    const form = document.getElementById('form-login');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const user = await store.login(email, password);
            toast.success(`欢迎回来，${user.fullName}！`);
            if (user.status === 'pending') {
                window.location.hash = '#pending';
            } else if (user.status === 'rejected' || user.status === 'disabled') {
                toast.error('您的账号当前已被停用或拒绝访问，请联系实验室管理员。');
            } else {
                window.location.hash = '#overview';
            }
        } catch (err) {
            toast.error(err.message || '登录失败');
        }
    };
}
