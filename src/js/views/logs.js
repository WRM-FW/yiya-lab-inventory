// ==============================================================================
// 视图: 库存操作历史与全生命周期审计流水 (Audit Logs View)
// ==============================================================================

import { store } from '../store.js';
import { toast } from '../components/toast.js';

export async function renderLogsView(container) {
    const logs = await store.getLogs();

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
                <h1 style="font-size: 1.45rem; font-weight: 700; color: var(--neutral-900);">库存操作流水与审计追溯</h1>
                <p style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">
                    全周期只读不可篡改业务记录，覆盖入库、领用消耗、报损、盘点与工具流转
                </p>
            </div>
            <div>
                <button class="btn btn-secondary btn-sm" id="btn-export-csv">📥 导出 Excel / CSV 流水台账</button>
            </div>
        </div>

        <div class="card" style="padding: 0.85rem 1.25rem; background: var(--neutral-50); border-left: 4px solid var(--primary); margin-bottom: 1.25rem; font-size: 0.84rem; color: var(--neutral-700);">
            🛡️ <b>数据可信度保障原则：</b>
            系统历史操作记录一经提交永久只读，严禁任何普通成员或管理员私自抹除或篡改。如有录入失误，必须通过“库存调整/冲正记录”进行纠错平账。
        </div>

        <!-- 筛选栏 -->
        <div class="card" style="padding: 1rem; margin-bottom: 1.25rem;">
            <div class="toolbar" style="margin-bottom: 0;">
                <div class="search-box" style="flex: 1; max-width: 300px;">
                    <span>🔍</span>
                    <input type="text" id="filter-log-search" placeholder="搜索物资名称、操作人或说明..." />
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;">
                    <select class="form-select" id="filter-log-target" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部物资大类</option>
                        <option value="material_3d">3D 打印线材</option>
                        <option value="consumable">通用工程耗材</option>
                        <option value="tool">可重复使用工具</option>
                    </select>

                    <select class="form-select" id="filter-log-op" style="width: auto; padding: 0.45rem 0.65rem; font-size: 0.84rem;">
                        <option value="">全部操作类型</option>
                        <option value="inbound">入库增加</option>
                        <option value="consume">领用消耗</option>
                        <option value="scrap">报损扣减</option>
                        <option value="stocktake">实物盘点</option>
                        <option value="adjust">工具/状态调整</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- 流水表格 -->
        <div class="card" style="padding: 0; overflow: hidden;">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>记录时间</th>
                            <th>品类</th>
                            <th>物资名称</th>
                            <th>操作类型</th>
                            <th>变动数量</th>
                            <th>期初结存</th>
                            <th>期末结存</th>
                            <th>操作人</th>
                            <th>业务用途说明与备注</th>
                        </tr>
                    </thead>
                    <tbody id="logs-tbody"></tbody>
                </table>
            </div>
        </div>
    `;

    function renderLogRows() {
        const kw = document.getElementById('filter-log-search').value.trim().toLowerCase();
        const targetFilter = document.getElementById('filter-log-target').value;
        const opFilter = document.getElementById('filter-log-op').value;

        const filtered = logs.filter(l => {
            if (targetFilter && l.targetType !== targetFilter) return false;
            if (opFilter && l.operationType !== opFilter) return false;
            if (kw) {
                const combined = `${l.targetName} ${l.operatorName} ${l.notes || ''}`.toLowerCase();
                if (!combined.includes(kw)) return false;
            }
            return true;
        });

        const tbody = document.getElementById('logs-tbody');
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--neutral-400);">
                        未检索到符合条件的库存变动流水记录
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(log => {
            let typeBadge = '';
            let changeColor = 'var(--neutral-800)';
            let changePrefix = log.changeAmount > 0 ? '+' : '';
            if (log.operationType === 'inbound') {
                typeBadge = '<span class="badge badge-success">入库增加</span>';
                changeColor = 'var(--success)';
            } else if (log.operationType === 'consume') {
                typeBadge = '<span class="badge badge-info">领用消耗</span>';
                changeColor = 'var(--danger)';
            } else if (log.operationType === 'scrap') {
                typeBadge = '<span class="badge badge-danger">报损扣减</span>';
                changeColor = 'var(--danger)';
            } else if (log.operationType === 'stocktake') {
                typeBadge = '<span class="badge badge-warning">实物盘点</span>';
                changeColor = 'var(--warning)';
            } else {
                typeBadge = '<span class="badge badge-neutral">状态调整</span>';
            }

            return `
                <tr>
                    <td style="font-size: 0.8rem; color: var(--neutral-500); white-space: nowrap;">
                        ${new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td>
                        <span class="badge badge-neutral">
                            ${log.targetType === 'material_3d' ? '3D线材' : (log.targetType === 'consumable' ? '通用耗材' : '工具')}
                        </span>
                    </td>
                    <td style="font-weight: 600;">${log.targetName}</td>
                    <td>${typeBadge}</td>
                    <td style="font-weight: 700; color: ${changeColor};">
                        ${changePrefix}${log.changeAmount} ${log.unit}
                    </td>
                    <td style="color: var(--neutral-600);">${log.previousBalance} ${log.unit}</td>
                    <td style="font-weight: 600;">${log.newBalance} ${log.unit}</td>
                    <td><b>${log.operatorName}</b></td>
                    <td style="font-size: 0.82rem; color: var(--neutral-600);">${log.notes || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    renderLogRows();

    document.getElementById('filter-log-search').oninput = renderLogRows;
    document.getElementById('filter-log-target').onchange = renderLogRows;
    document.getElementById('filter-log-op').onchange = renderLogRows;

    // 导出 CSV 功能
    document.getElementById('btn-export-csv').onclick = () => {
        if (logs.length === 0) {
            toast.warning('当前暂无可导出的流水数据');
            return;
        }

        const headers = ['记录时间', '品类', '物资名称', '操作类型', '变动量', '单位', '期初结存', '期末结存', '操作人', '备注'];
        const csvRows = [headers.join(',')];

        logs.forEach(l => {
            const row = [
                `"${new Date(l.createdAt).toLocaleString('zh-CN')}"`,
                `"${l.targetType}"`,
                `"${(l.targetName || '').replace(/"/g, '""')}"`,
                `"${l.operationType}"`,
                l.changeAmount,
                `"${l.unit}"`,
                l.previousBalance,
                l.newBalance,
                `"${(l.operatorName || '').replace(/"/g, '""')}"`,
                `"${(l.notes || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `义牙实验室物资流转审计台账_${new Date().toISOString().substring(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('已成功生成并下载 CSV 流水报表！');
    };
}
