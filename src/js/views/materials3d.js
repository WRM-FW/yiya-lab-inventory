// ==============================================================================
// 视图: 3D 打印耗材核心管理模块 (Materials 3D View)
// ==============================================================================

import { store } from '../store.js';
import { parseWeightToGrams, formatWeightDisplay } from '../utils/weightConverter.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderMaterials3DView(container) {
    const materials = await store.getMaterials3D();
    const locations = await store.getLocations();
    const isAdmin = store.currentUser?.role === 'admin';

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
                <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">3D 打印耗材与线材管理</h1>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                    支持按材质、品牌、颜色、规格精细建档，以克（g）为基准单位追踪剩余总重量
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem;">
                <button class="btn btn-primary" id="btn-add-material">➕ 新建耗材档案</button>
            </div>
        </div>

        <!-- 检索与多维度筛选栏 -->
        <div class="card" style="padding: 1rem; margin-bottom: 1.25rem;">
            <div class="toolbar" style="margin-bottom: 0;">
                <div class="search-box" style="flex: 1; max-width: 320px;">
                    <span>🔍</span>
                    <input type="text" id="filter-search" placeholder="搜索耗材名称、品牌或颜色..." />
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;">
                    <select class="form-select" id="filter-type" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部材质类型</option>
                        <option value="PLA">PLA</option>
                        <option value="PETG">PETG</option>
                        <option value="ABS">ABS</option>
                        <option value="TPU">TPU</option>
                        <option value="PC">PC</option>
                        <option value="树脂">光敏树脂</option>
                    </select>

                    <select class="form-select" id="filter-location" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部存放位置</option>
                        ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                    </select>

                    <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.84rem; color: var(--neutral-700); cursor: pointer;">
                        <input type="checkbox" id="filter-show-inactive" /> 显示已停用
                    </label>
                </div>
            </div>
        </div>

        <!-- 耗材数据表格 -->
        <div class="card" style="padding: 0; overflow: hidden;">
            <div class="table-responsive">
                <table id="table-materials">
                    <thead>
                        <tr>
                            <th>耗材名称与颜色</th>
                            <th>材质 / 品牌</th>
                            <th>线径 / 规格</th>
                            <th>当前剩余重量</th>
                            <th>最低预警线</th>
                            <th>存放位置</th>
                            <th>状态</th>
                            <th style="text-align: right;">业务操作</th>
                        </tr>
                    </thead>
                    <tbody id="materials-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    function renderTableRows() {
        const searchKw = document.getElementById('filter-search').value.trim().toLowerCase();
        const typeFilter = document.getElementById('filter-type').value;
        const locFilter = document.getElementById('filter-location').value;
        const showInactive = document.getElementById('filter-show-inactive').checked;

        const filtered = materials.filter(m => {
            if (!showInactive && !m.isActive) return false;
            if (typeFilter && m.materialType !== typeFilter) return false;
            if (locFilter && m.locationId !== locFilter) return false;
            if (searchKw) {
                const combined = `${m.name} ${m.brand} ${m.colorName} ${m.materialType} ${m.notes || ''}`.toLowerCase();
                if (!combined.includes(searchKw)) return false;
            }
            return true;
        });

        const tbody = document.getElementById('materials-tbody');
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--neutral-400);">
                        未检索到符合条件的 3D 打印耗材数据
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(m => {
            const isLowStock = parseFloat(m.remainingWeightG) <= parseFloat(m.minWeightThresholdG);
            const locObj = locations.find(l => l.id === m.locationId);

            return `
                <tr style="${!m.isActive ? 'opacity: 0.6; background-color: var(--neutral-100);' : ''}">
                    <td>
                        <div style="font-weight: 600; display: flex; align-items: center;">
                            <span class="color-dot" style="background-color: ${m.colorHex || '#ddd'};" title="${m.colorName}"></span>
                            ${m.name}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--neutral-500); margin-left: 18px;">
                            包装规格: ${m.packageSpec || '1 kg/卷'} ${m.supplier ? '· ' + m.supplier : ''}
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-info">${m.materialType}</span>
                        <span style="font-size: 0.8rem; color: var(--neutral-600); margin-left: 4px;">${m.brand}</span>
                    </td>
                    <td>
                        <span style="font-family: monospace;">${m.diameterMm} mm</span>
                        <div style="font-size: 0.75rem; color: var(--neutral-500);">${m.colorName}</div>
                    </td>
                    <td>
                        <div style="font-weight: 700; font-size: 0.95rem; color: ${isLowStock ? 'var(--danger)' : 'var(--neutral-900)'};">
                            ${formatWeightDisplay(parseFloat(m.remainingWeightG))}
                        </div>
                        ${isLowStock ? '<span class="badge badge-danger" style="margin-top: 2px;">⚠️ 库存紧张</span>' : ''}
                    </td>
                    <td>
                        <span style="font-size: 0.82rem; color: var(--neutral-600);">${m.minWeightThresholdG} g</span>
                    </td>
                    <td>
                        <span style="font-size: 0.82rem;">${locObj ? locObj.name : '未分配位置'}</span>
                    </td>
                    <td>
                        ${m.isActive ? '<span class="badge badge-success">正常在库</span>' : '<span class="badge badge-neutral">已停用</span>'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm btn-op-weight" data-id="${m.id}" data-op="consume" ${!m.isActive ? 'disabled' : ''}>
                            消耗扣减
                        </button>
                        <button class="btn btn-secondary btn-sm btn-op-weight" data-id="${m.id}" data-op="inbound" ${!m.isActive ? 'disabled' : ''}>
                            入库增加
                        </button>
                        <button class="btn btn-secondary btn-sm btn-edit-mat" data-id="${m.id}">
                            编辑
                        </button>
                        ${isAdmin ? `
                        <button class="btn ${m.isActive ? 'btn-danger' : 'btn-success'} btn-sm btn-toggle-active" data-id="${m.id}" data-active="${m.isActive}">
                            ${m.isActive ? '停用' : '启用'}
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        attachActionEvents();
    }

    renderTableRows();

    document.getElementById('filter-search').oninput = renderTableRows;
    document.getElementById('filter-type').onchange = renderTableRows;
    document.getElementById('filter-location').onchange = renderTableRows;
    document.getElementById('filter-show-inactive').onchange = renderTableRows;

    function attachActionEvents() {
        container.querySelectorAll('.btn-op-weight').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const defaultOp = e.currentTarget.getAttribute('data-op');
                const item = materials.find(m => m.id === id);
                openWeightOpModal(item, defaultOp);
            };
        });

        container.querySelectorAll('.btn-edit-mat').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const item = materials.find(m => m.id === id);
                openMaterialFormModal(item);
            };
        });

        container.querySelectorAll('.btn-toggle-active').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const currentActive = e.currentTarget.getAttribute('data-active') === 'true';
                const actionText = currentActive ? '停用' : '启用';
                if (confirm(`确定要${actionText}该 3D 打印耗材档案吗？历史记录将继续完整保留。`)) {
                    await store.toggleItemActive('material_3d', id, !currentActive);
                    toast.success(`耗材已成功${actionText}`);
                    renderMaterials3DView(container);
                }
            };
        });
    }

    document.getElementById('btn-add-material').onclick = () => {
        openMaterialFormModal(null);
    };

    function openWeightOpModal(item, defaultOp = 'consume') {
        modal.open({
            title: `3D耗材重量变更: ${item.name}`,
            content: `
                <div style="background: var(--neutral-50); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem;">
                    <div>当前在库总重：<b style="color: var(--primary); font-size: 1rem;">${formatWeightDisplay(parseFloat(item.remainingWeightG))}</b></div>
                    <div style="color: var(--neutral-500); font-size: 0.78rem; margin-top: 2px;">
                        材质: ${item.materialType} | 颜色: ${item.colorName} | 包装规格: ${item.packageSpec || '1 kg/卷'}
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">变更类型 <span style="color: var(--danger);">*</span></label>
                    <select class="form-select" id="op-type">
                        <option value="consume" ${defaultOp === 'consume' ? 'selected' : ''}>领用/打印消耗 (扣减重量)</option>
                        <option value="inbound" ${defaultOp === 'inbound' ? 'selected' : ''}>新采购/补充入库 (增加重量)</option>
                        <option value="scrap">报损与废料处理 (扣减重量)</option>
                        <option value="stocktake">实物盘点重置 (重置为指定总重量)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">变动数值与单位 <span style="color: var(--danger);">*</span></label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="number" step="any" min="0" class="form-input" id="op-value" placeholder="输入变动数值，如 250 或 1" style="flex: 2;" required />
                        <select class="form-select" id="op-unit" style="flex: 1;">
                            <option value="g">克 (g)</option>
                            <option value="kg">千克 (kg)</option>
                        </select>
                    </div>
                    <div class="form-help" id="unit-convert-tip">输入千克时系统将自动精确换算为克存储计算 (1 kg = 1,000 g)</div>
                </div>

                <div class="form-group">
                    <label class="form-label">用途说明 / 打印作品 / 备注</label>
                    <input class="form-input" id="op-notes" placeholder="例如：RoboMaster机甲底盘支架打印消耗，实物称重扣减" />
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
                        const opType = document.getElementById('op-type').value;
                        const rawVal = document.getElementById('op-value').value;
                        const unit = document.getElementById('op-unit').value;
                        const notes = document.getElementById('op-notes').value;

                        try {
                            const grams = parseWeightToGrams(rawVal, unit);
                            await store.adjustMaterialWeight(item.id, opType, grams, notes);
                            toast.success(`3D耗材重量更新成功！变动值: ${grams} g`);
                            m.close();
                            renderMaterials3DView(container);
                        } catch (err) {
                            toast.error(err.message || '操作失败');
                        }
                    }
                }
            ]
        });

        const valInput = document.getElementById('op-value');
        const unitSelect = document.getElementById('op-unit');
        const tipEl = document.getElementById('unit-convert-tip');
        function updateTip() {
            const val = parseFloat(valInput.value);
            if (!isNaN(val) && val > 0) {
                if (unitSelect.value === 'kg') {
                    tipEl.innerHTML = `换算结果: <b>${val * 1000} 克 (g)</b> 将被记录到数据库`;
                } else {
                    tipEl.innerHTML = `记录重量: <b>${val} 克 (g)</b> ${(val >= 1000 ? `约等于 ${(val/1000).toFixed(2)} kg` : '')}`;
                }
            }
        }
        valInput.oninput = updateTip;
        unitSelect.onchange = updateTip;
    }

    function openMaterialFormModal(item = null) {
        const isEdit = !!item;
        modal.open({
            title: isEdit ? `编辑耗材档案: ${item.name}` : '新建 3D 打印耗材档案',
            content: `
                <div class="form-group">
                    <label class="form-label">耗材名称 <span style="color: var(--danger);">*</span></label>
                    <input class="form-input" id="mat-name" placeholder="例如：拓竹 PLA Basic 哑光白 1.75mm" value="${isEdit ? item.name : ''}" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">材质类型 <span style="color: var(--danger);">*</span></label>
                        <select class="form-select" id="mat-type">
                            <option value="PLA" ${isEdit && item.materialType === 'PLA' ? 'selected' : ''}>PLA (聚乳酸)</option>
                            <option value="PETG" ${isEdit && item.materialType === 'PETG' ? 'selected' : ''}>PETG (高韧耐温)</option>
                            <option value="ABS" ${isEdit && item.materialType === 'ABS' ? 'selected' : ''}>ABS (工程塑料)</option>
                            <option value="TPU" ${isEdit && item.materialType === 'TPU' ? 'selected' : ''}>TPU (高弹柔性)</option>
                            <option value="PC" ${isEdit && item.materialType === 'PC' ? 'selected' : ''}>PC (高强耐热)</option>
                            <option value="树脂" ${isEdit && item.materialType === '树脂' ? 'selected' : ''}>光敏树脂 (SLA/DLP)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">耗材品牌 <span style="color: var(--danger);">*</span></label>
                        <input class="form-input" id="mat-brand" placeholder="例如：Bambu Lab, eSUN, Polymaker" value="${isEdit ? item.brand : 'Bambu Lab'}" required />
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">颜色描述 <span style="color: var(--danger);">*</span></label>
                        <input class="form-input" id="mat-color-name" placeholder="例如：哑光白、纯黑、亮红" value="${isEdit ? item.colorName : ''}" required />
                    </div>
                    <div class="form-group">
                        <label class="form-label">UI 识别色块</label>
                        <input type="color" class="form-input" id="mat-color-hex" value="${isEdit && item.colorHex ? item.colorHex : '#4a90e2'}" style="height: 38px; padding: 2px;" />
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">线径规格</label>
                        <select class="form-select" id="mat-diameter">
                            <option value="1.75" ${isEdit && item.diameterMm === 1.75 ? 'selected' : ''}>1.75 mm (标准)</option>
                            <option value="2.85" ${isEdit && item.diameterMm === 2.85 ? 'selected' : ''}>2.85 mm</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">采购包装规格</label>
                        <input class="form-input" id="mat-package-spec" placeholder="例如：1 kg/卷 或 500 g/盘" value="${isEdit ? item.packageSpec : '1 kg/卷'}" />
                    </div>
                </div>

                ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label">初始在库重量与单位</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="number" step="any" min="0" class="form-input" id="mat-init-weight" placeholder="初始重量" value="1000" style="flex: 2;" />
                        <select class="form-select" id="mat-init-unit" style="flex: 1;">
                            <option value="g">克 (g)</option>
                            <option value="kg">千克 (kg)</option>
                        </select>
                    </div>
                    <div class="form-help">若输入 1 kg，系统将自动换算为 1,000 g 初始化建库</div>
                </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group">
                        <label class="form-label">最低预警重量 (克)</label>
                        <input type="number" min="0" class="form-input" id="mat-threshold" placeholder="默认500克" value="${isEdit ? item.minWeightThresholdG : 500}" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">存放位置</label>
                        <select class="form-select" id="mat-location">
                            <option value="">未指定</option>
                            ${locations.map(l => `<option value="${l.id}" ${isEdit && item.locationId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">供应商与采购备注</label>
                    <input class="form-input" id="mat-supplier" placeholder="例如：官方旗舰店" value="${isEdit && item.supplier ? item.supplier : ''}" />
                </div>
            `,
            footerButtons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: (e, m) => m.close()
                },
                {
                    text: isEdit ? '保存修改' : '确认建档',
                    className: 'btn-primary',
                    onClick: async (e, m) => {
                        const name = document.getElementById('mat-name').value.trim();
                        const materialType = document.getElementById('mat-type').value;
                        const brand = document.getElementById('mat-brand').value.trim();
                        const colorName = document.getElementById('mat-color-name').value.trim();
                        const colorHex = document.getElementById('mat-color-hex').value;
                        const diameterMm = parseFloat(document.getElementById('mat-diameter').value);
                        const packageSpec = document.getElementById('mat-package-spec').value.trim();
                        const thresholdG = parseFloat(document.getElementById('mat-threshold').value) || 500;
                        const locationId = document.getElementById('mat-location').value;
                        const supplier = document.getElementById('mat-supplier').value.trim();

                        if (!name || !brand || !colorName) {
                            toast.error('请填写耗材名称、品牌及颜色！');
                            return;
                        }

                        const payload = {
                            ...(item || {}),
                            name,
                            materialType,
                            brand,
                            colorName,
                            colorHex,
                            diameterMm,
                            packageSpec,
                            minWeightThresholdG: thresholdG,
                            locationId: locationId || null,
                            supplier
                        };

                        if (!isEdit) {
                            const initWeight = document.getElementById('mat-init-weight').value;
                            const initUnit = document.getElementById('mat-init-unit').value;
                            payload.remainingWeightG = parseWeightToGrams(initWeight || 0, initUnit);
                        }

                        try {
                            await store.saveMaterial3D(payload);
                            toast.success(isEdit ? '耗材档案已保存！' : '3D耗材档案新建成功！');
                            m.close();
                            renderMaterials3DView(container);
                        } catch (err) {
                            toast.error(err.message || '保存失败');
                        }
                    }
                }
            ]
        });
    }
}
