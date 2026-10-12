// ==============================================================================
// 视图: 统一库存操作出入库页面 (Stock Operations View)
// ==============================================================================

import { store } from '../store.js';
import { parseWeightToGrams, formatWeightDisplay } from '../utils/weightConverter.js';
import { toast } from '../components/toast.js';

export async function renderStockOpsView(container) {
    const materials = await store.getMaterials3D();
    const consumables = await store.getConsumables();

    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    const queryParams = new URLSearchParams(qIndex !== -1 ? hash.substring(qIndex + 1) : '');

    const paramId = queryParams.get('id');
    const paramType = queryParams.get('type') || 'material_3d';
    const paramOp = queryParams.get('op') || 'consume';

    container.innerHTML = `
        <div style="max-width: 640px; margin: 0 auto;">
            <div style="margin-bottom: 1.5rem;">
                <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">⚡ 物资库存变动与消耗登记</h1>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                    支持 3D 打印耗材（克/千克自动换算）与通用消耗品的出入库、领用扣减、报损及盘点
                </p>
            </div>

            <div class="card" style="padding: 1.8rem;">
                <form id="form-stock-op">
                    <!-- 1. 选择物资品类 -->
                    <div class="form-group">
                        <label class="form-label">物资大类 <span style="color: var(--danger);">*</span></label>
                        <div style="display: flex; gap: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem;">
                                <input type="radio" name="target_type" value="material_3d" ${paramType === 'material_3d' ? 'checked' : ''} />
                                🧵 3D 打印线材 (按克追踪)
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem;">
                                <input type="radio" name="target_type" value="consumable" ${paramType === 'consumable' ? 'checked' : ''} />
                                📦 通用工程耗材 (按标准单位)
                            </label>
                        </div>
                    </div>

                    <!-- 2. 选择具体物资 -->
                    <div class="form-group">
                        <label class="form-label">选择目标物资 <span style="color: var(--danger);">*</span></label>
                        <select class="form-select" id="op-target-select" required></select>
                        <div id="target-detail-card" style="margin-top: 0.75rem; padding: 0.75rem; background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-sm); font-size: 0.85rem;"></div>
                    </div>

                    <!-- 3. 选择操作类型 -->
                    <div class="form-group">
                        <label class="form-label">业务操作类型 <span style="color: var(--danger);">*</span></label>
                        <select class="form-select" id="op-operation-type">
                            <option value="consume" ${paramOp === 'consume' ? 'selected' : ''}>日常领用 / 打印消耗扣减 (扣减出库)</option>
                            <option value="inbound" ${paramOp === 'inbound' ? 'selected' : ''}>采购补充 / 归还入库 (增加在库)</option>
                            <option value="scrap" ${paramOp === 'scrap' ? 'selected' : ''}>报损与损坏处置 (扣减出库)</option>
                            <option value="stocktake" ${paramOp === 'stocktake' ? 'selected' : ''}>实物盘点重置 (重置为指定结存)</option>
                        </select>
                    </div>

                    <!-- 4. 变动数值与单位 -->
                    <div class="form-group">
                        <label class="form-label">变动数值与计量单位 <span style="color: var(--danger);">*</span></label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="number" step="any" min="0" class="form-input" id="op-amount" placeholder="例如：250 或 1" style="flex: 2;" required />
                            <select class="form-select" id="op-unit-selector" style="flex: 1;"></select>
                        </div>
                        <div class="form-help" id="op-convert-preview"></div>
                    </div>

                    <!-- 5. 备注说明 -->
                    <div class="form-group">
                        <label class="form-label">用途说明 / 竞赛项目 / 备注</label>
                        <input class="form-input" id="op-notes-input" placeholder="例如：智能车底盘支架打印消耗，实物称重扣减" />
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="window.history.back()">返回</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-op">确认记账并生成审计流水</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const targetTypeRadios = container.querySelectorAll('input[name="target_type"]');
    const selectEl = document.getElementById('op-target-select');
    const detailCard = document.getElementById('target-detail-card');
    const unitSelector = document.getElementById('op-unit-selector');
    const amountInput = document.getElementById('op-amount');
    const previewEl = document.getElementById('op-convert-preview');

    function getSelectedType() {
        const checked = container.querySelector('input[name="target_type"]:checked');
        return checked ? checked.value : 'material_3d';
    }

    function refreshTargetOptions() {
        const type = getSelectedType();
        if (type === 'material_3d') {
            const activeMats = materials.filter(m => m.isActive);
            selectEl.innerHTML = activeMats.map(m => `
                <option value="${m.id}" ${paramId === m.id ? 'selected' : ''}>
                    [3D线材] ${m.brand} ${m.name} (${m.remainingWeightG} g 在库)
                </option>
            `).join('');

            unitSelector.innerHTML = `
                <option value="g">克 (g)</option>
                <option value="kg">千克 (kg)</option>
            `;
        } else {
            const activeCons = consumables.filter(c => c.isActive);
            selectEl.innerHTML = activeCons.map(c => `
                <option value="${c.id}" ${paramId === c.id ? 'selected' : ''}>
                    [通用耗材] ${c.name} (${c.currentStock} ${c.unit} 在库)
                </option>
            `).join('');

            updateConsumableUnit();
        }
        updateDetailCard();
    }

    function updateConsumableUnit() {
        const id = selectEl.value;
        const item = consumables.find(c => c.id === id);
        if (item) {
            unitSelector.innerHTML = `<option value="${item.unit}">${item.unit}</option>`;
        }
    }

    function updateDetailCard() {
        const type = getSelectedType();
        const id = selectEl.value;
        if (!id) {
            detailCard.innerHTML = '暂无选中物资';
            return;
        }

        if (type === 'material_3d') {
            const m = materials.find(x => x.id === id);
            if (!m) return;
            detailCard.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>耗材品牌/材质：<b>${m.brand} · ${m.materialType}</b></span>
                    <span>线径规格：<b>${m.diameterMm} mm</b></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>当前剩余总重：<b style="color: var(--primary); font-size: 0.95rem;">${formatWeightDisplay(parseFloat(m.remainingWeightG))}</b></span>
                    <span>最低预警线：${m.minWeightThresholdG} g</span>
                </div>
            `;
        } else {
            const c = consumables.find(x => x.id === id);
            if (!c) return;
            detailCard.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>规格型号：<b>${c.modelSpec || '标准规格'}</b></span>
                    <span>稳定计量单位：<b>${c.unit}</b></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>当前在库库存：<b style="color: var(--primary); font-size: 0.95rem;">${c.currentStock} ${c.unit}</b></span>
                    <span>最低预警线：${c.minStockThreshold} ${c.unit}</span>
                </div>
            `;
            updateConsumableUnit();
        }
        updatePreview();
    }

    function updatePreview() {
        const type = getSelectedType();
        const val = parseFloat(amountInput.value);
        if (isNaN(val) || val <= 0) {
            previewEl.innerHTML = '';
            return;
        }

        if (type === 'material_3d') {
            const unit = unitSelector.value;
            if (unit === 'kg') {
                previewEl.innerHTML = `💡 输入 ${val} kg 将精确换算为 <b>${val * 1000} 克 (g)</b> 进行扣减/累加`;
            } else {
                previewEl.innerHTML = `💡 变动 <b>${val} 克 (g)</b> ${(val >= 1000 ? `约等于 ${(val/1000).toFixed(2)} kg` : '')}`;
            }
        } else {
            previewEl.innerHTML = `💡 变动 <b>${val} ${unitSelector.value}</b>`;
        }
    }

    targetTypeRadios.forEach(r => r.onchange = refreshTargetOptions);
    selectEl.onchange = updateDetailCard;
    unitSelector.onchange = updatePreview;
    amountInput.oninput = updatePreview;

    refreshTargetOptions();

    const form = document.getElementById('form-stock-op');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const type = getSelectedType();
        const id = selectEl.value;
        const opType = document.getElementById('op-operation-type').value;
        const rawAmount = amountInput.value;
        const notes = document.getElementById('op-notes-input').value.trim();

        try {
            if (type === 'material_3d') {
                const unit = unitSelector.value;
                const grams = parseWeightToGrams(rawAmount, unit);
                await store.adjustMaterialWeight(id, opType, grams, notes);
                toast.success(`3D打印耗材重量变动登记成功！变动值: ${grams} g`);
                window.location.hash = '#materials3d';
            } else {
                const val = parseFloat(rawAmount);
                await store.adjustConsumableStock(id, opType, val, notes);
                toast.success(`通用消耗品库存变动登记成功！`);
                window.location.hash = '#consumables';
            }
        } catch (err) {
            toast.error(err.message || '操作失败');
        }
    };
}
