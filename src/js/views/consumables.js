// ==============================================================================
// 视图: 通用工程消耗品管理模块 (General Consumables View)
// ==============================================================================

import { store } from '../store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderConsumablesView(container) {
    const consumables = await store.getConsumables();
    const categories = await store.getCategories();
    const locations = await store.getLocations();
    const isAdmin = store.currentUser?.role === 'admin';

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
                <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">通用工程消耗品管理</h1>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                    焊锡丝、松香助焊剂、热缩管、螺栓紧固件及焊接加工日常消耗物资
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem;">
                <button class="btn btn-primary" id="btn-add-consumable">➕ 新建消耗品档案</button>
            </div>
        </div>

        <!-- 筛选与检索栏 -->
        <div class="card" style="padding: 1rem; margin-bottom: 1.25rem;">
            <div class="toolbar" style="margin-bottom: 0;">
                <div class="search-box" style="flex: 1; max-width: 320px;">
                    <span>🔍</span>
                    <input type="text" id="filter-search-con" placeholder="搜索耗材名称、规格型号或备注..." />
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;">
                    <select class="form-select" id="filter-cat-con" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部分类</option>
                        ${categories.filter(c => c.type === 'general_consumable').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>

                    <select class="form-select" id="filter-loc-con" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部存放位置</option>
                        ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                    </select>

                    <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.84rem; color: var(--neutral-700); cursor: pointer;">
                        <input type="checkbox" id="filter-con-show-inactive" /> 显示已停用
                    </label>
                </div>
            </div>
        </div>

        <!-- 消耗品数据表格 -->
        <div class="card" style="padding: 0; overflow: hidden;">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>物资名称</th>
                            <th>分类</th>
                            <th>规格型号</th>
                            <th>当前在库数量</th>
                            <th>预警阈值</th>
                            <th>存放位置</th>
                            <th>状态</th>
                            <th style="text-align: right;">业务操作</th>
                        </tr>
                    </thead>
                    <tbody id="consumables-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    function renderTableRows() {
        const searchKw = document.getElementById('filter-search-con').value.trim().toLowerCase();
        const catFilter = document.getElementById('filter-cat-con').value;
        const locFilter = document.getElementById('filter-loc-con').value;
        const showInactive = document.getElementById('filter-con-show-inactive').checked;

        const filtered = consumables.filter(c => {
            if (!showInactive && !c.isActive) return false;
            if (catFilter && c.categoryId !== catFilter) return false;
            if (locFilter && c.locationId !== locFilter) return false;
            if (searchKw) {
                const combined = `${c.name} ${c.modelSpec || ''} ${c.supplier || ''} ${c.notes || ''}`.toLowerCase();
                if (!combined.includes(searchKw)) return false;
            }
            return true;
        });

        const tbody = document.getElementById('consumables-tbody');
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--neutral-400);">
                        未检索到符合条件的通用工程消耗品
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const isLowStock = parseFloat(c.currentStock) <= parseFloat(c.minStockThreshold);
            const catObj = categories.find(cat => cat.id === c.categoryId);
            const locObj = locations.find(l => l.id === c.locationId);

            return `
                <tr style="${!c.isActive ? 'opacity: 0.6; background-color: var(--neutral-100);' : ''}">
                    <td>
                        <div style="font-weight: 600;">${c.name}</div>
                        <div style="font-size: 0.75rem; color: var(--neutral-500);">
                            单位: <b>${c.unit}</b> ${c.supplier ? '· 供应商: ' + c.supplier : ''}
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-neutral">${catObj ? catObj.name : '通用物资'}</span>
                    </td>
                    <td>
                        <span style="font-size: 0.85rem; color: var(--neutral-700);">${c.modelSpec || '-'}</span>
                    </td>
                    <td>
                        <div style="font-weight: 700; font-size: 0.95rem; color: ${isLowStock ? 'var(--danger)' : 'var(--neutral-900)'};">
                            ${c.currentStock} <span style="font-size: 0.8rem; font-weight: normal;">${c.unit}</span>
                        </div>
                        ${isLowStock ? '<span class="badge badge-danger" style="margin-top: 2px;">⚠️ 库存不足</span>' : ''}
                    </td>
                    <td>
                        <span style="font-size: 0.82rem; color: var(--neutral-600);">${c.minStockThreshold} ${c.unit}</span>
                    </td>
                    <td>
                        <span style="font-size: 0.82rem;">${locObj ? locObj.name : '未分配位置'}</span>
                    </td>
                    <td>
                        ${c.isActive ? '<span class="badge badge-success">正常流转</span>' : '<span class="badge badge-neutral">已停用</span>'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm btn-op-con" data-id="${c.id}" data-op="consume" ${!c.isActive ? 'disabled' : ''}>
                            领用扣减
                        </button>
                        <button class="btn btn-secondary btn-sm btn-op-con" data-id="${c.id}" data-op="inbound" ${!c.isActive ? 'disabled' : ''}>
                            入库增加
                        </button>
                        <button class="btn btn-secondary btn-sm btn-edit-con" data-id="${c.id}">
                            编辑
                        </button>
                        ${isAdmin ? `
                        <button class="btn ${c.isActive ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-con-active" data-id="${c.id}" data-active="${c.isActive}">
                            ${c.isActive ? '停用' : '启用'}
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        attachActionEvents();
    }

    renderTableRows();

    document.getElementById('filter-search-con').oninput = renderTableRows;
    document.getElementById('filter-cat-con').onchange = renderTableRows;
    document.getElementById('filter-loc-con').onchange = renderTableRows;
    document.getElementById('filter-con-show-inactive').onchange = renderTableRows;

    function attachActionEvents() {
        container.querySelectorAll('.btn-op-con').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const defaultOp = e.currentTarget.getAttribute('data-op');
                const item = consumables.find(c => c.id === id);
                openConsumableOpModal(item, defaultOp);
            };
        });

        container.querySelectorAll('.btn-edit-con').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const item = consumables.find(c => c.id === id);
                openConsumableFormModal(item);
            };
        });

        container.querySelectorAll('.btn-toggle-con-active').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const currentActive = e.currentTarget.getAttribute('data-active') === 'true';
                const actionText = currentActive ? '停用' : '启用';
                if (confirm(`确定要${actionText}该消耗品档案吗？历史记录将继续完整保留。`)) {
                    await store.toggleItemActive('consumable', id, !currentActive);
                    toast.success(`消耗品已成功${actionText}`);
                    renderConsumablesView(container);
                }
            };
        });
    }

    document.getElementById('btn-add-consumable').onclick = () => {
        openConsumableFormModal(null);
    };

    function openConsumableOpModal(item, defaultOp = 'consume') {
        modal.open({
            title: `消耗品库存变更: ${item.name}`,
            content: `
                <div style="background: var(--neutral-50); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem;">
                    <div>当前在库数量：<b style="color: var(--primary); font-size: 1rem;">${item.currentStock} ${item.unit}</b></div>
                    <div style="color: var(--neutral-500); font-size: 0.78rem; margin-top: 2px;">
                        规格: ${item.modelSpec || '标准规格'} | 稳定计量单位: <b>${item.unit}</b>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">变更类型 <span style="color: var(--danger);">*</span></label>
                    <select class="form-select" id="op-con-type">
                        <option value="consume" ${defaultOp === 'consume' ? 'selected' : ''}>日常领用出库 (扣减)</option>
                        <option value="inbound" ${defaultOp === 'inbound' ? 'selected' : ''}>采购入库增加 (累加)</option>
                        <option value="scrap">报损与损坏处置 (扣减)</option>
                        <option value="stocktake">库存盘点重置 (设定指定数量)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">操作数量 (${item.unit}) <span style="color: var(--danger);">*</span></label>
                    <input type="number" step="any" min="0" class="form-input" id="op-con-value" placeholder="例如：2 或 0.5" required />
                </div>

                <div class="form-group">
                    <label class="form-label">领用部门 / 竞赛项目 / 备注</label>
                    <input class="form-input" id="op-con-notes" placeholder="例如：智能车焊接工位领用" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: '提交变更并记账',
                    className: 'btn-primary',
                    onClick: async (e, m) => {
                        const opType = document.getElementById('op-con-type').value;
                        const val = parseFloat(document.getElementById('op-con-value').value);
                        const notes = document.getElementById('op-con-notes').value;

                        if (isNaN(val) || val < 0) {
                            toast.error('请输入大于或等于 0 的有效数量！');
                            return;
                        }

                        try {
                            await store.adjustConsumableStock(item.id, opType, val, notes);
                            toast.success(`消耗品库存更新成功！`);
                            m.close();
                            renderConsumablesView(container);
                        } catch (err) {
                            toast.error(err.message || '操作失败');
                        }
                    }
                }
            ]
        });
    }

    function openConsumableFormModal(item = null) {
        const isEdit = !!item;
        modal.open({
            title: isEdit ? `编辑消耗品档案: ${item.name}` : '新建通用消耗品档案',
            content: `
                <div class="form-group">
                    <label class="form-label">物资名称 <span style="color: var(--danger);">*</span></label>
                    <input class="form-input" id="con-name" placeholder="例如：维修级 63/37 含铅焊锡丝 0.8mm" value="${isEdit ? item.name : ''}" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">所属分类 <span style="color: var(--danger);">*</span></label>
                        <select class="form-select" id="con-category">
                            ${categories.filter(c => c.type === 'general_consumable').map(c => `<option value="${c.id}" ${isEdit && item.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">计量单位 (严禁混算) <span style="color: var(--danger);">*</span></label>
                        <input class="form-input" id="con-unit" placeholder="例如：卷、盒、瓶、包、件、支" value="${isEdit ? item.unit : '卷'}" ${isEdit ? 'disabled title="为保障历史流水一致性，已建档案不可直接修改单位"' : ''} required />
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">规格型号描述</label>
                    <input class="form-input" id="con-spec" placeholder="例如：500g/卷 熔点183℃ 或 M3*10 100只/包" value="${isEdit ? (item.modelSpec || '') : ''}" />
                </div>

                ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label">初始在库数量</label>
                    <input type="number" min="0" class="form-input" id="con-init-stock" placeholder="例如：10" value="10" />
                </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">最低预警阈值</label>
                        <input type="number" min="0" class="form-input" id="con-threshold" placeholder="默认3" value="${isEdit ? item.minStockThreshold : 3}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">存放位置</label>
                        <select class="form-select" id="con-location">
                            <option value="">未指定</option>
                            ${locations.map(l => `<option value="${l.id}" ${isEdit && item.locationId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">供应商与采购渠道</label>
                    <input class="form-input" id="con-supplier" placeholder="例如：得力工业品、震坤行" value="${isEdit ? (item.supplier || '') : ''}" />
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
                        const name = document.getElementById('con-name').value.trim();
                        const categoryId = document.getElementById('con-category').value;
                        const unit = document.getElementById('con-unit').value.trim();
                        const modelSpec = document.getElementById('con-spec').value.trim();
                        const threshold = parseFloat(document.getElementById('con-threshold').value) || 3;
                        const locationId = document.getElementById('con-location').value;
                        const supplier = document.getElementById('con-supplier').value.trim();

                        if (!name || !unit) {
                            toast.error('请填写物资名称及计量单位！');
                            return;
                        }

                        const payload = {
                            ...(item || {}),
                            name,
                            categoryId,
                            unit,
                            modelSpec,
                            minStockThreshold: threshold,
                            locationId: locationId || null,
                            supplier
                        };

                        if (!isEdit) {
                            payload.currentStock = parseFloat(document.getElementById('con-init-stock').value) || 0;
                        }

                        try {
                            await store.saveConsumable(payload);
                            toast.success(isEdit ? '消耗品档案已保存！' : '通用消耗品档案新建成功！');
                            m.close();
                            renderConsumablesView(container);
                        } catch (err) {
                            toast.error(err.message || '保存失败');
                        }
                    }
                }
            ]
        });
    }
}
