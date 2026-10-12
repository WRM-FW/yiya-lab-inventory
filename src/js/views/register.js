// ==============================================================================
// 视图: 注册申请页面 (Register View)
// ==============================================================================

import { store } from '../store.js';
import { toast } from '../components/toast.js';

export function renderRegisterView(container) {
    container.innerHTML = `
        <div style="max-width: 480px; margin: 2.5rem auto; padding: 2rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); border: 1px solid var(--neutral-200);">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <span class="brand-badge" style="font-size: 0.85rem; padding: 6px 12px;">义牙实验室</span>
                <h2 style="font-size: 1.35rem; font-weight: 700; margin-top: 0.75rem; color: var(--neutral-900);">新成员注册申请</h2>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.25rem;">提交实名信息后需等待实验室指导老师/管理员审核批准</p>
            </div>

            <form id="form-register">
                <div class="form-group">
                    <label class="form-label" for="reg-fullname">真实姓名 <span style="color: var(--danger);">*</span></label>
                    <input type="text" id="reg-fullname" class="form-input" placeholder="例如：赵同学" required />
                </div>

                <div class="form-group">
                    <label class="form-label" for="reg-studentid">学号 / 工号</label>
                    <input type="text" id="reg-studentid" class="form-input" placeholder="例如：S20240105" />
                    <div class="form-help">便于管理员核对实验室入驻名单</div>
                </div>

                <div class="form-group">
                    <label class="form-label" for="reg-email">校园邮箱 / 常用联系邮箱 <span style="color: var(--danger);">*</span></label>
                    <input type="email" id="reg-email" class="form-input" placeholder="name@yiya-lab.edu.cn" required />
                </div>

                <div class="form-group">
                    <label class="form-label" for="reg-password">设置登录密码 <span style="color: var(--danger);">*</span></label>
                    <input type="password" id="reg-password" class="form-input" placeholder="不少于6位密码" minlength="6" required />
                </div>

                <div style="background-color: var(--warning-light); border: 1px solid #fde68a; padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem; color: #92400e; margin-bottom: 1rem;">
                    🛡️ <b>权限安全须知：</b><br>
                    注册成功后，账号将处于<b>“待审核”</b>状态，暂时无法查询物资或办理工具借还。管理员完成资质核验后将开启普通成员权限。
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.65rem;">
                    提交注册申请
                </button>
            </form>

            <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--neutral-200); text-align: center; font-size: 0.85rem; color: var(--neutral-600);">
                已有账号？ <a href="#login" style="color: var(--primary); font-weight: 600; text-decoration: none;">直接登录</a>
            </div>
        </div>
    `;

    const form = document.getElementById('form-register');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value;
        const studentId = document.getElementById('reg-studentid').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            await store.register(email, password, fullName, studentId);
            toast.success('注册申请已提交！请等待管理员审核。');
            window.location.hash = '#pending';
        } catch (err) {
            toast.error(err.message || '注册失败');
        }
    };
}
