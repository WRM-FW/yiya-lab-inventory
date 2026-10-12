// ==============================================================================
// 视图: 首页与库存概览 (Overview View)
// ==============================================================================

import { store } from '../store.js';
import { formatWeightDisplay } from '../utils/weightConverter.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';

export async function renderOverviewView(container) {
    const materials = await store.getMaterials3D();
    const consumables = await store.getConsumables();
    const tools = await store.getTools();
    const loans = await store.getLoans();
    const logs = await store.getLogs();

    // 统计计算
    const activeMaterials = materials.filter(m => m.isActive);
    const totalFilamentWeightG = activeMaterials.reduce((acc, cur) => acc + (parseFloat(cur.remainingWeightG) || 0), 0);
    const lowStockFilaments = activeMaterials.filter(m => (parseFloat(m.remainingWeightG) || 0) <= (parseFloat(m.minWeightThresholdG) || 0));

    const activeConsumables = consumables.filter(c => c.isActive);
    const lowStockConsumables = activeConsumables.filter(c => (parseFloat(c.currentStock) || 0) <= (parseFloat(c.minStockThreshold) || 0));

    const activeTools = tools.filter(t => t.isActive);
    const totalToolsCount = activeTools.reduce((acc, cur) => acc + (parseInt(cur.totalQuantity, 10) || 0), 0);
    const borrowedToolsCount = activeTools.reduce((acc, cur) => acc + (parseInt(cur.borrowedQuantity, 10) || 0), 0);

    const activeLoans = loans.filter(l => l.status === 'borrowed');

    container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h1 style="font-size: 1.5rem; font-weight: 700; color: var(--neutral-900);">实验室库存与流转概览</h1>
            <p style="font-size: 0.88rem; color: var(--neutral-500); margin-top: 0.25rem;">
                义牙实验室 · 工程实践、3D 打印与焊接加工物资综合看板
            </p>
        </div>

        <!-- 统计核心卡片网格 -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: #eff6ff; color: #2563eb;">🧵</div>
                <div class="stat-content">
                    <div class="stat-label">3D 打印线材在库总重</div>
                    <div class="stat-value">${(totalFilamentWeightG / 1000).toFixed(2)} <span style="font-size: 0.9rem; font-weight: 500;">kg</span></div>
                    <div style="font-size: 0.75rem; color: var(--neutral-500); margin-top: 2px;">
                        共 ${activeMaterials.length} 种规格 · 换算 ${Math.round(totalFilamentWeightG).toLocaleString()} g
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: #f0fdf4; color: #16a34a;">📦</div>
                <div class="stat-content">
                    <div class="stat-label">通用工程消耗品</div>
                    <div class="stat-value">${activeConsumables.length} <span style="font-size: 0.9rem; font-weight: 500;">类在库</span></div>
                    <div style="font-size: 0.75rem; color: var(--neutral-500); margin-top: 2px;">
                        焊锡、助焊膏、紧固件等耗材
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: #faf5ff; color: #9333ea;">🔧</div>
                <div class="stat-content">
                    <div class="stat-label">可重复使用工具池</div>
                    <div class="stat-value">${borrowedToolsCount} / ${totalToolsCount} <span style="font-size: 0.85rem; font-weight: 500;">借出/总数</span></div>
                    <div style="font-size: 0.75rem; color: var(--neutral-500); margin-top: 2px;">
                        当前在库可用 ${totalToolsCount - borrowedToolsCount} 件
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: ${lowStockFilaments.length + lowStockConsumables.length > 0 ? '#fef2f2' : '#f8fafc'}; color: ${lowStockFilaments.length + lowStockConsumables.length > 0 ? '#dc2626' : '#64748b'};">
                    ${lowStockFilaments.length + lowStockConsumables.length > 0 ? '⚠️' : '✅'}
                </div>
                <div class="stat-content">
                    <div class="stat-label">库存短缺告警</div>
                    <div class="stat-value" style="color: ${lowStockFilaments.length + lowStockConsumables.length > 0 ? 'var(--danger)' : 'var(--neutral-900)'};">
                        ${lowStockFilaments.length + lowStockConsumables.length} <span style="font-size: 0.85rem; font-weight: 500;">项告警</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--neutral-500); margin-top: 2px;">
                        需及时补货入库
                    </div>
                </div>
            </div>
        </div>

        <!-- 快捷操作入口通道 -->
        <div class="card" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                    <h3 style="font-size: 0.98rem; font-weight: 600; color: var(--neutral-800);">⚡ 高频日常业务通道</h3>
                    <p style="font-size: 0.8rem; color: var(--neutral-500);">日常打印、焊接加工或领用归还可直接通过快捷按钮完成登记</p>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.6rem;">
                    <a href="#stockOps" class="btn btn-primary btn-sm">⚡ 登记耗材消耗 / 入库</a>
                    <a href="#tools" class="btn btn-secondary btn-sm">🔧 登记工具借出</a>
                    <a href="#materials3d" class="btn btn-secondary btn-sm">🧵 浏览 3D 打印线材</a>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 1.25rem;">
            <!-- 低库存预警列表卡片 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <span>🚨 库存预警监控 (${lowStockFilaments.length + lowStockConsumables.length})</span>
                    </div>
                    <span style="font-size: 0.78rem; color: var(--neutral-500);">低于设定阈值自动提示</span>
                </div>

                ${lowStockFilaments.length === 0 && lowStockConsumables.length === 0 ? `
                    <div style="text-align: center; padding: 2rem 1rem; color: var(--neutral-400);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
                        全部耗材与物资储备充裕，无低库存告警
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>物资类型</th>
                                    <th>名称 / 规格</th>
                                    <th>当前在库</th>
                                    <th>最低预警线</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lowStockFilaments.map(m => `
                                    <tr>
                                        <td><span class="badge badge-info">3D线材</span></td>
                                        <td>
                                            <div style="font-weight: 600;">
                                                <span class="color-dot" style="background-color: ${m.colorHex || '#ccc'};"></span>
                                                ${m.name}
                                            </div>
                                            <div style="font-size: 0.75rem; color: var(--neutral-500);">${m.brand} · ${m.materialType} · ${m.colorName}</div>
                                        </td>
                                        <td><span style="color: var(--danger); font-weight: 700;">${m.remainingWeightG} g</span></td>
                                        <td>${m.minWeightThresholdG} g</td>
                                        <td>
                                            <a href="#stockOps?id=${m.id}&type=material_3d&op=inbound" class="btn btn-primary btn-sm">补仓入库</a>
                                        </td>
                                    </tr>
                                `).join('')}

                                ${lowStockConsumables.map(c => `
                                    <tr>
                                        <td><span class="badge badge-warning">通用耗材</span></td>
                                        <td>
                                            <div style="font-weight: 600;">${c.name}</div>
                                            <div style="font-size: 0.75rem; color: var(--neutral-500);">${c.modelSpec || '-'}</div>
                                        </td>
                                        <td><span style="color: var(--danger); font-weight: 700;">${c.currentStock} ${c.unit}</span></td>
                                        <td>${c.minStockThreshold} ${c.unit}</td>
                                        <td>
                                            <a href="#stockOps?id=${c.id}&type=consumable&op=inbound" class="btn btn-primary btn-sm">补仓入库</a>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- 当前借出中工具监控 -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <span>🔧 借出中工具监控 (${activeLoans.length})</span>
                    </div>
                    <a href="#tools" style="font-size: 0.8rem; color: var(--primary); text-decoration: none;">查看全部借还记录 &rarr;</a>
                </div>

                ${activeLoans.length === 0 ? `
                    <div style="text-align: center; padding: 2rem 1rem; color: var(--neutral-400);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✨</div>
                        当前所有工具均在库，无外借单据
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>工具名称</th>
                                    <th>借用人</th>
                                    <th>借用数</th>
                                    <th>预计归还</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeLoans.map(l => `
                                    <tr>
                                        <td style="font-weight: 600;">${l.toolName}</td>
                                        <td>
                                            <div>${l.borrowerName}</div>
                                            <div style="font-size: 0.72rem; color: var(--neutral-500);">${l.contactInfo || ''}</div>
                                        </td>
                                        <td><b>${l.borrowQuantity}</b> 件</td>
                                        <td><span style="font-size: 0.82rem; color: var(--neutral-600);">${l.expectedReturnAt ? l.expectedReturnAt.substring(0, 10) : '未约定'}</span></td>
                                        <td>
                                            <button class="btn btn-success btn-sm btn-quick-return" data-loan-id="${l.id}" data-tool-name="${l.toolName}">
                                                核销归还
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>

        <!-- 最近操作日志快照 -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <span>📜 最近操作动态 (最新 5 条)</span>
                </div>
                <a href="#logs" style="font-size: 0.8rem; color: var(--primary); text-decoration: none;">查看全量审计流水 &rarr;</a>
            </div>
            
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>物资分类</th>
                            <th>物资名称</th>
                            <th>操作类型</th>
                            <th>变动数量</th>
                            <th>期末结存</th>
                            <th>操作人</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.slice(0, 5).map(log => {
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
                            } else {
                                typeBadge = '<span class="badge badge-neutral">盘点调整</span>';
                            }

                            return `
                                <tr>
                                    <td style="font-size: 0.8rem; color: var(--neutral-500);">${new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                                    <td><span class="badge badge-neutral">${log.targetType === 'material_3d' ? '3D线材' : (log.targetType === 'consumable' ? '通用耗材' : '工具')}</span></td>
                                    <td style="font-weight: 600;">${log.targetName}</td>
                                    <td>${typeBadge}</td>
                                    <td style="font-weight: 700; color: ${changeColor};">${changePrefix}${log.changeAmount} ${log.unit}</td>
                                    <td>${log.newBalance} ${log.unit}</td>
                                    <td>${log.operatorName}</td>
                                    <td style="font-size: 0.82rem; color: var(--neutral-600);">${log.notes || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 绑定快捷归还按钮
    container.querySelectorAll('.btn-quick-return').forEach(btn => {
        btn.onclick = (e) => {
            const loanId = e.currentTarget.getAttribute('data-loan-id');
            const toolName = e.currentTarget.getAttribute('data-tool-name');

            modal.open({
                title: '工具归还确认核销',
                content: `
                    <p style="margin-bottom: 1rem;">确认将工具 <b>${toolName}</b> 办理归还入库吗？</p>
                    <div class="form-group">
                        <label class="form-label">归还验收说明 / 完好度备注</label>
                        <input class="form-input" id="return-notes" placeholder="例如：配件齐全，外观无损" value="检查完好，正常入库" />
                    </div>
                `,
                footerButtons: [
                    {
                        text: '取消',
                        className: 'btn-secondary',
                        onClick: (e, m) => m.close()
                    },
                    {
                        text: '确认归还并核销',
                        className: 'btn-success',
                        onClick: async (e, m) => {
                            const notes = document.getElementById('return-notes').value;
                            try {
                                await store.returnTool(loanId, notes);
                                toast.success(`工具 ${toolName} 归还核销成功！在库可用数已自动增加。`);
                                m.close();
                                renderOverviewView(container);
                            } catch (err) {
                                toast.error(err.message || '归还失败');
                            }
                        }
                    }
                ]
            });
        };
    });
}
