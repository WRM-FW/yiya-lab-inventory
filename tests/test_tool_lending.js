// ==============================================================================
// 模块: 可重复使用工具借还状态机与库存守恒测试套件
// ==============================================================================

export class MockToolManager {
    constructor() {
        this.tools = new Map();
        this.loans = new Map();
        this.logs = [];
    }

    addTool(tool) {
        if (tool.totalQuantity !== tool.availableQuantity + tool.borrowedQuantity) {
            throw new Error('ERR_INVARIANT: 初始数量不守恒 (总数 != 可用数 + 借出数)');
        }
        this.tools.set(tool.id, { ...tool });
    }

    borrowTool(toolId, quantity, borrower, expectedReturnAt, notes = '') {
        const tool = this.tools.get(toolId);
        if (!tool) throw new Error('ERR_NOT_FOUND: 工具不存在');
        if (!tool.isActive) throw new Error('ERR_TOOL_INACTIVE: 工具已被停用');
        if (quantity <= 0) throw new Error('ERR_INVALID_QUANTITY: 借用数量必须大于0');
        if (tool.availableQuantity < quantity) {
            throw new Error(`ERR_TOOL_NOT_AVAILABLE: 可用数量不足 (在库: ${tool.availableQuantity}, 申请: ${quantity})`);
        }

        tool.availableQuantity -= quantity;
        tool.borrowedQuantity += quantity;

        if (tool.totalQuantity !== tool.availableQuantity + tool.borrowedQuantity) {
            throw new Error('FATAL: 数量守恒崩溃');
        }

        const loanId = 'loan_' + (this.loans.size + 1);
        const loan = {
            id: loanId,
            toolId,
            toolName: tool.name,
            borrowQuantity: quantity,
            borrowerId: borrower.id,
            borrowerName: borrower.name,
            borrowedAt: new Date().toISOString(),
            expectedReturnAt,
            returnedAt: null,
            status: 'borrowed',
            notes
        };
        this.loans.set(loanId, loan);
        return { success: true, tool, loan };
    }

    returnTool(loanId, returnOperator, returnNotes = '') {
        const loan = this.loans.get(loanId);
        if (!loan) throw new Error('ERR_NOT_FOUND: 借出单据不存在');
        if (loan.status === 'returned') {
            throw new Error('ERR_ALREADY_RETURNED: 该单据此前已归还，请勿重复核销');
        }

        const tool = this.tools.get(loan.toolId);
        if (!tool) throw new Error('ERR_NOT_FOUND: 关联工具不存在');

        tool.availableQuantity += loan.borrowQuantity;
        tool.borrowedQuantity -= loan.borrowQuantity;

        if (tool.totalQuantity !== tool.availableQuantity + tool.borrowedQuantity) {
            throw new Error('FATAL: 归还后数量守恒崩溃');
        }

        loan.status = 'returned';
        loan.returnedAt = new Date().toISOString();
        loan.returnOperator = returnOperator.name;
        loan.returnNotes = returnNotes;

        return { success: true, tool, loan };
    }
}

export function runToolLendingTests() {
    console.log('--- [测试套件 3: 工具借还状态机与数量恒等式约束] ---');
    let passed = 0;
    let failed = 0;

    const mgr = new MockToolManager();

    // 1. 初始化工具
    mgr.addTool({
        id: 'tool_1',
        name: 'T12 便携式恒温电烙铁 72W',
        totalQuantity: 6,
        availableQuantity: 6,
        borrowedQuantity: 0,
        isActive: true
    });

    const borrowerA = { id: 'u_101', name: '张同学' };
    const borrowerB = { id: 'u_102', name: '王同学' };
    const admin = { id: 'u_admin', name: '实验室管理员' };

    // 2. 正常借出
    const res1 = mgr.borrowTool('tool_1', 2, borrowerA, '2026-10-15');
    const t1 = mgr.tools.get('tool_1');
    if (t1.availableQuantity === 4 && t1.borrowedQuantity === 2 && t1.totalQuantity === 6) {
        console.log('  ✓ [通过] 借出2件成功，可用变为4，借出变为2，总数守恒保持6');
        passed++;
    } else {
        console.error('  ✗ [失败] 借出计算错误');
        failed++;
    }

    // 3. 再次借出
    const res2 = mgr.borrowTool('tool_1', 3, borrowerB, '2026-10-16');
    const t2 = mgr.tools.get('tool_1');
    if (t2.availableQuantity === 1 && t2.borrowedQuantity === 5) {
        console.log('  ✓ [通过] 累积借出3件成功，可用变为1，借出变为5');
        passed++;
    } else {
        console.error('  ✗ [失败] 累积借出计算错误');
        failed++;
    }

    // 4. 超量借出拦截
    try {
        mgr.borrowTool('tool_1', 2, borrowerA, '2026-10-17');
        console.error('  ✗ [失败] 超额借出未拦截 (当前仅剩1件可用)');
        failed++;
    } catch (e) {
        console.log(`  ✓ [通过] 超额借出拦截成功: ${e.message}`);
        passed++;
    }

    // 5. 正常归还核销
    mgr.returnTool(res1.loan.id, admin, '检查无损');
    const t3 = mgr.tools.get('tool_1');
    if (t3.availableQuantity === 3 && t3.borrowedQuantity === 3 && res1.loan.status === 'returned') {
        console.log('  ✓ [通过] 归还首张借还单成功，可用恢复至3，借出降为3');
        passed++;
    } else {
        console.error('  ✗ [失败] 归还核销错误');
        failed++;
    }

    // 6. 重复归还拦截
    try {
        mgr.returnTool(res1.loan.id, admin, '再次归还');
        console.error('  ✗ [失败] 重复归还未拦截');
        failed++;
    } catch (e) {
        console.log(`  ✓ [通过] 重复归还拦截成功: ${e.message}`);
        passed++;
    }

    // 7. 全部借单清算
    mgr.returnTool(res2.loan.id, admin);
    const t4 = mgr.tools.get('tool_1');
    if (t4.availableQuantity === 6 && t4.borrowedQuantity === 0) {
        console.log('  ✓ [通过] 全部归还后完全恢复初始库存: 可用 6, 借出 0');
        passed++;
    } else {
        console.error('  ✗ [失败] 最终清算错误');
        failed++;
    }

    console.log(`套件 3 统计: 通过 ${passed}, 失败 ${failed}\n`);
    if (failed > 0) throw new Error('Tool lending tests failed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runToolLendingTests();
}
