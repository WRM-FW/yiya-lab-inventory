// ==============================================================================
// 视图: 可重复使用工具借还管理模块 (Reusable Tools View)
// ==============================================================================

import { store } from '../store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderToolsView(container) {
    const tools = await store.getTools();
    const loans = await store.getLoans();
    const categories = await store.getCategories();
    const locations = await store.getLocations();
    const isAdmin = store.currentUser?.role === 'admin';

    let activeTab = 'pool'; // 'pool' | 'active_loans' | 'history_loans'

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
                <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">可重复使用工具与借还管理</h1>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                    烙铁、热风枪、万用表、游标卡尺等仪器工具池化管理与借还闭环追踪
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem;">
                <button class="btn btn-primary" id="btn-quick-borrow">⚡ 办理工具借出</button>
                <button class="btn btn-secondary" id="btn-add-tool">➕ 新增工具资产</button>
            </div>
        </div>

        <!-- 选项卡 Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--neutral-200); padding-bottom: 0.25rem;">
            <button class="btn btn-secondary btn-sm" id="tab-btn-pool" style="border: none; background: transparent; font-weight: 600; color: var(--primary); border-bottom: 2px solid var(--primary); border-radius: 0;">
                🛠️ 工具资产池与在库情况 (${tools.length})
            </button>
            <button class="btn btn-secondary btn-sm" id="tab-btn-active" style="border: none; background: transparent; font-weight: 500; color: var(--neutral-600); border-radius: 0;">
                ⏳ 当前借出中单据 (${loans.filter(l => l.status === 'borrowed').length})
            </button>
            <button class="btn btn-secondary btn-sm" id="tab-btn-history" style="border: none; background: transparent; font-weight: 500; color: var(--neutral-600); border-radius: 0;">
                📜 历史归还记录 (${loans.filter(l => l.status === 'returned').length})
            </button>
        </div>

        <!-- 选项卡内容区 -->
        <div id="tools-tab-content"></div>
    `;

    function renderTab() {
        const tabContentEl = document.getElementById('tools-tab-content');
        if (activeTab === 'pool') {
            renderPoolTab(tabContentEl);
        } else if (activeTab === 'active_loans') {
            renderActiveLoansTab(tabContentEl);
        } else {
            renderHistoryLoansTab(tabContentEl);
        }
    }

    function updateTabHeaders() {
        const pBtn = document.getElementById('tab-btn-pool');
        const aBtn = document.getElementById('tab-btn-active');
        const hBtn = document.getElementById('tab-btn-history');

        [pBtn, aBtn, hBtn].forEach(b => {
            b.style.color = 'var(--neutral-600)';
            b.style.borderBottom = 'none';
        });

        if (activeTab === 'pool') {
            pBtn.style.color = 'var(--primary)';
            pBtn.style.borderBottom = '2px solid var(--primary)';
        } else if (activeTab === 'active_loans') {
            aBtn.style.color = 'var(--primary)';
            aBtn.style.borderBottom = '2px solid var(--primary)';
        } else {
            hBtn.style.color = 'var(--primary)';
            hBtn.style.borderBottom = '2px solid var(--primary)';
        }
    }

    document.getElementById('tab-btn-pool').onclick = () => { activeTab = 'pool'; updateTabHeaders(); renderTab(); };
    document.getElementById('tab-btn-active').onclick = () => { activeTab = 'active_loans'; updateTabHeaders(); renderTab(); };
    document.getElementById('tab-btn-history').onclick = () => { activeTab = 'history_loans'; updateTabHeaders(); renderTab(); };

    // 1. 资产池 Tab
    function renderPoolTab(targetEl) {
        targetEl.innerHTML = `
            <div class="card" style="padding: 0; overflow: hidden;">
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>工具名称</th>
                                <th>型号 / 规格</th>
                                <th>总数量</th>
                                <th>可用在库数</th>
                                <th>当前借出数</th>
                                <th>存放位置</th>
                                <th>状态</th>
                                <th style="text-align: right;">借还与管理</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tools.map(t => {
                                const locObj = locations.find(l => l.id === t.locationId);
                                const isAvailable = t.availableQuantity > 0;
                                return `
                                    <tr style="${!t.isActive ? 'opacity: 0.6; background: var(--neutral-100);' : ''}">
                                        <td>
                                            <div style="font-weight: 600;">${t.name}</div>
                                            <div style="font-size: 0.75rem; color: var(--neutral-500);">${t.notes || '实验室公用'}</div>
                                        </td>
                                        <td><span style="font-size: 0.85rem;">${t.modelSpec || '-'}</span></td>
                                        <td><b style="font-size: 1rem;">${t.totalQuantity}</b> 件</td>
                                        <td>
                                            <span style="font-size: 1.05rem; font-weight: 700; color: ${isAvailable ? 'var(--success)' : 'var(--danger)'};">
                                                ${t.availableQuantity}
                                            </span> 件
                                        </td>
                                        <td>
                                            <span style="font-weight: 600; color: ${t.borrowedQuantity > 0 ? 'var(--warning)' : 'var(--neutral-500)'};">
                                                ${t.borrowedQuantity}
                                            </span> 件
                                        </td>
                                        <td><span style="font-size: 0.82rem;">${locObj ? locObj.name : '未指定位置'}</span></td>
                                        <td>
                                            ${t.isActive ? (isAvailable ? '<span class="badge badge-success">可借用</span>' : '<span class="badge badge-warning">全部借出</span>') : '<span class="badge badge-neutral">已停用</span>'}
                                        </td>
                                        <td style="text-align: right; white-space: nowrap;">
                                            <button class="btn btn-primary btn-sm btn-borrow-this" data-id="${t.id}" ${(!t.isActive || t.availableQuantity <= 0) ? 'disabled' : ''}>
                                                办理借用
                                            </button>
                                            <button class="btn btn-secondary btn-sm btn-edit-tool" data-id="${t.id}">
                                                编辑
                                            </button>
                                            ${isAdmin ? `
                                            <button class="btn ${t.isActive ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-tool-active" data-id="${t.id}" data-active="${t.isActive}">
                                                ${t.isActive ? '停用' : '启用'}
                                            </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        targetEl.querySelectorAll('.btn-borrow-this').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const t = tools.find(x => x.id === id);
                openBorrowModal(t);
            };
        });

        targetEl.querySelectorAll('.btn-edit-tool').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const t = tools.find(x => x.id === id);
                openToolFormModal(t);
            };
        });

        targetEl.querySelectorAll('.btn-toggle-tool-active').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const currentActive = e.currentTarget.getAttribute('data-active') === 'true';
                const actionText = currentActive ? '停用' : '启用';
                if (confirm(`确定要${actionText}该工具吗？`)) {
                    await store.toggleItemActive('tool', id, !currentActive);
                    toast.success(`工具已成功${actionText}`);
                    renderToolsView(container);
                }
            };
        });
    }

    // 2. 当前外借中单据 Tab
    function renderActiveLoansTab(targetEl) {
        const activeLoans = loans.filter(l => l.status === 'borrowed');
        if (activeLoans.length === 0) {
            targetEl.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem 1rem; color: var(--neutral-400);">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
                    当前暂无外借中的工具，全部资产均在库完好保存
                </div>
            `;
            return;
        }

        targetEl.innerHTML = `
            <div class="card" style="padding: 0; overflow: hidden;">
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>借出单号</th>
                                <th>工具名称</th>
                                <th>借用数量</th>
                                <th>借用人</th>
                                <th>联系电话</th>
                                <th>借出时间</th>
                                <th>预计归还时间</th>
                                <th>用途备注</th>
                                <th style="text-align: right;">归还核销</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeLoans.map(l => `
                                <tr>
                                    <td style="font-family: monospace; font-size: 0.78rem; color: var(--neutral-500);">${l.id.substring(0, 12)}</td>
                                    <td style="font-weight: 600;">${l.toolName}</td>
                                    <td><b style="color: var(--primary);">${l.borrowQuantity}</b> 件</td>
                                    <td><span style="font-weight: 600;">${l.borrowerName}</span></td>
                                    <td>${l.contactInfo || '-'}</td>
                                    <td style="font-size: 0.8rem; color: var(--neutral-500);">${new Date(l.borrowedAt).toLocaleDateString('zh-CN')}</td>
                                    <td><span style="color: var(--danger); font-weight: 500;">${l.expectedReturnAt ? l.expectedReturnAt.substring(0, 10) : '未约定'}</span></td>
                                    <td style="font-size: 0.82rem; color: var(--neutral-600);">${l.notes || '-'}</td>
                                    <td style="text-align: right;">
                                        <button class="btn btn-success btn-sm btn-return-loan" data-loan-id="${l.id}" data-tool-name="${l.toolName}">
                                            核销归还
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        targetEl.querySelectorAll('.btn-return-loan').forEach(btn => {
            btn.onclick = (e) => {
                const loanId = e.currentTarget.getAttribute('data-loan-id');
                const toolName = e.currentTarget.getAttribute('data-tool-name');
                openReturnModal(loanId, toolName);
            };
        });
    }

    // 3. 历史归还记录 Tab
    function renderHistoryLoansTab(targetEl) {
        const historyLoans = loans.filter(l => l.status === 'returned');
        if (historyLoans.length === 0) {
            targetEl.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem 1rem; color: var(--neutral-400);">
                    暂无历史归还归档记录
                </div>
            `;
            return;
        }

        targetEl.innerHTML = `
            <div class="card" style="padding: 0; overflow: hidden;">
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>单号</th>
                                <th>工具名称</th>
                                <th>借还数量</th>
                                <th>借用人</th>
                                <th>借出日期</th>
                                <th>实际归还时间</th>
                                <th>归还验收人</th>
                                <th>状态</th>
                                <th>流转备注</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historyLoans.map(l => `
                                <tr>
                                    <td style="font-family: monospace; font-size: 0.78rem; color: var(--neutral-500);">${l.id.substring(0, 12)}</td>
                                    <td style="font-weight: 600;">${l.toolName}</td>
                                    <td>${l.borrowQuantity} 件</td>
                                    <td>${l.borrowerName}</td>
                                    <td style="font-size: 0.8rem; color: var(--neutral-500);">${new Date(l.borrowedAt).toLocaleDateString('zh-CN')}</td>
                                    <td style="font-size: 0.8rem; color: var(--success);">${new Date(l.returnedAt).toLocaleString('zh-CN')}</td>
                                    <td>${l.returnOperator || '实验室管理员'}</td>
                                    <td><span class="badge badge-success">已归还入库</span></td>
                                    <td style="font-size: 0.82rem; color: var(--neutral-600);">${l.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTab();

    // 快捷办理借出按钮
    document.getElementById('btn-quick-borrow').onclick = () => {
        openBorrowModal(null);
    };

    // 新增工具资产按钮
    document.getElementById('btn-add-tool').onclick = () => {
        openToolFormModal(null);
    };

    // 借出登记 Modal
    function openBorrowModal(preselectedTool = null) {
        modal.open({
            title: '登记可重复使用工具借出',
            content: `
                <div class="form-group">
                    <label class="form-label">选择借出工具 <span style="color: var(--danger);">*</span></label>
                    <select class="form-select" id="borrow-tool-id">
                        ${tools.filter(t => t.isActive).map(t => `
                            <option value="${t.id}" ${preselectedTool && preselectedTool.id === t.id ? 'selected' : ''} ${t.availableQuantity <= 0 ? 'disabled' : ''}>
                                ${t.name} (在库可用: ${t.availableQuantity} 件 / 总量: ${t.totalQuantity} 件)
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">申请借出数量 (件) <span style="color: var(--danger);">*</span></label>
                    <input type="number" min="1" class="form-input" id="borrow-qty" value="1" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">借用人姓名 <span style="color: var(--danger);">*</span></label>
                        <input class="form-input" id="borrow-user-name" value="${store.currentUser?.fullName || ''}" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">联系电话 / 微信号</label>
                        <input class="form-input" id="borrow-contact" placeholder="例如：13800138000" />
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">预计归还日期</label>
                    <input type="date" class="form-input" id="borrow-expected-date" value="${new Date(Date.now() + 86400000 * 3).toISOString().substring(0, 10)}" />
                </div>

                <div class="form-group">
                    <label class="form-label">借用用途说明 / 竞赛组别</label>
                    <input class="form-input" id="borrow-notes" placeholder="例如：RoboMaster 机械组装调试借用" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: '确认借出登记',
                    className: 'btn-primary',
                    onClick: async (e, m) => {
                        const toolId = document.getElementById('borrow-tool-id').value;
                        const qty = parseInt(document.getElementById('borrow-qty').value, 10);
                        const bName = document.getElementById('borrow-user-name').value.trim();
                        const contact = document.getElementById('borrow-contact').value.trim();
                        const expDate = document.getElementById('borrow-expected-date').value;
                        const notes = document.getElementById('borrow-notes').value.trim();

                        if (!toolId || isNaN(qty) || qty <= 0 || !bName) {
                            toast.error('请填写完整工具与借用人信息！');
                            return;
                        }

                        try {
                            await store.borrowTool(toolId, qty, bName, contact, expDate, notes);
                            toast.success('工具借出登记成功！可用库存已自动扣减。');
                            m.close();
                            renderToolsView(container);
                        } catch (err) {
                            toast.error(err.message || '借出失败');
                        }
                    }
                }
            ]
        });
    }

    // 归还核销 Modal
    function openReturnModal(loanId, toolName) {
        modal.open({
            title: `工具归还核销: ${toolName}`,
            content: `
                <p style="margin-bottom: 1rem; font-size: 0.9rem;">
                    确认将工具 <b>${toolName}</b> 办理归还吗？归还后工具在库可用数量将自动原子累加。
                </p>
                <div class="form-group">
                    <label class="form-label">归还验收情况 / 完好度备注</label>
                    <input class="form-input" id="return-modal-notes" placeholder="例如：配件齐全，外观无损，正常入库" value="配件齐全，正常归还" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: '确认归还并入库',
                    className: 'btn-success',
                    onClick: async (e, m) => {
                        const notes = document.getElementById('return-modal-notes').value.trim();
                        try {
                            await store.returnTool(loanId, notes);
                            toast.success(`工具 ${toolName} 归还核销成功！在库数已恢复。`);
                            m.close();
                            renderToolsView(container);
                        } catch (err) {
                            toast.error(err.message || '归还失败');
                        }
                    }
                }
            ]
        });
    }

    // 新增与编辑工具 Modal
    function openToolFormModal(item = null) {
        const isEdit = !!item;
        modal.open({
            title: isEdit ? `编辑工具档案: ${item.name}` : '新增可重复使用工具档案',
            content: `
                <div class="form-group">
                    <label class="form-label">工具名称 <span style="color: var(--danger);">*</span></label>
                    <input class="form-input" id="tool-name" placeholder="例如：T12 便携式数显恒温电烙铁 72W" value="${isEdit ? item.name : ''}" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">工具类别 <span style="color: var(--danger);">*</span></label>
                        <select class="form-select" id="tool-category">
                            ${categories.filter(c => c.type === 'tool').map(c => `<option value="${c.id}" ${isEdit && item.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">存放位置</label>
                        <select class="form-select" id="tool-location">
                            <option value="">未指定</option>
                            ${locations.map(l => `<option value="${l.id}" ${isEdit && item.locationId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">型号与技术参数规格</label>
                    <input class="form-input" id="tool-spec" placeholder="例如：快热型 自动休眠 / 分辨率 0.01mm" value="${isEdit ? (item.modelSpec || '') : ''}" />
                </div>

                <div class="form-group">
                    <label class="form-label">总购置数量 (件) <span style="color: var(--danger);">*</span></label>
                    <input type="number" min="1" class="form-input" id="tool-total-qty" value="${isEdit ? item.totalQuantity : 1}" ${isEdit ? 'disabled title="已有流转记录的工具如需调整数量请通过盘点流转"' : ''} required />
                    <div class="form-help">池化管理模式下，新建档案初始在库可用数 = 购置总数</div>
                </div>

                <div class="form-group">
                    <label class="form-label">使用须知与保养备注</label>
                    <input class="form-input" id="tool-notes" placeholder="例如：借出前请检查烙铁头氧化情况" value="${isEdit ? (item.notes || '') : ''}" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: isEdit ? '保存档案' : '确认建档',
                    className: 'btn-primary',
                    onClick: async (e, m) => {
                        const name = document.getElementById('tool-name').value.trim();
                        const categoryId = document.getElementById('tool-category').value;
                        const locationId = document.getElementById('tool-location').value;
                        const modelSpec = document.getElementById('tool-spec').value.trim();
                        const notes = document.getElementById('tool-notes').value.trim();

                        if (!name) {
                            toast.error('请填写工具名称！');
                            return;
                        }

                        const payload = {
                            ...(item || {}),
                            name,
                            categoryId,
                            locationId: locationId || null,
                            modelSpec,
                            notes
                        };

                        if (!isEdit) {
                            const totalQty = parseInt(document.getElementById('tool-total-qty').value, 10) || 1;
                            payload.totalQuantity = totalQty;
                        }

                        try {
                            await store.saveTool(payload);
                            toast.success(isEdit ? '工具档案已保存！' : '工具资产新建成功！');
                            m.close();
                            renderToolsView(container);
                        } catch (err) {
                            toast.error(err.message || '保存失败');
                        }
                    }
                }
            ]
        });
    }
}
