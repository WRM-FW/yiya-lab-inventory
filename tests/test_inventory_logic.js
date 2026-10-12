// ==============================================================================
// 模块: 库存出入库与防超卖边界测试套件
// ==============================================================================

export class MockInventoryManager {
    constructor() {
        this.materials3d = new Map();
        this.consumables = new Map();
        this.logs = [];
        this.idempotentKeys = new Set();
    }

    addMaterial3d(item) {
        this.materials3d.set(item.id, { ...item });
    }

    addConsumable(item) {
        this.consumables.set(item.id, { ...item });
    }

    adjustMaterial3dWeight(materialId, opType, amountG, operator, notes = '', idempotencyKey = null) {
        if (idempotencyKey && this.idempotentKeys.has(idempotencyKey)) {
            const existingLog = this.logs.find(l => l.idempotencyKey === idempotencyKey);
            return { success: true, idempotent: true, log: existingLog };
        }

        const material = this.materials3d.get(materialId);
        if (!material) throw new Error('ERR_NOT_FOUND: 耗材不存在');
        if (!material.isActive) throw new Error('ERR_ITEM_INACTIVE: 耗材已停用');

        const prevWeight = material.remainingWeightG;
        let newWeight = prevWeight;

        if (opType === 'inbound') {
            if (amountG <= 0) throw new Error('ERR_INVALID_AMOUNT: 入库重量必须大于0');
            newWeight = prevWeight + amountG;
        } else if (opType === 'consume' || opType === 'scrap') {
            if (amountG <= 0) throw new Error('ERR_INVALID_AMOUNT: 扣减重量必须大于0');
            if (prevWeight < amountG) {
                throw new Error(`ERR_INSUFFICIENT_STOCK: 库存不足 (现有: ${prevWeight}g, 扣减: ${amountG}g)`);
            }
            newWeight = prevWeight - amountG;
        } else if (opType === 'stocktake' || opType === 'adjust') {
            if (amountG < 0) throw new Error('ERR_INVALID_AMOUNT: 盘点重量不能为负数');
            newWeight = amountG;
        } else {
            throw new Error(`ERR_INVALID_OP: 未知操作 ${opType}`);
        }

        material.remainingWeightG = Math.round(newWeight * 100) / 100;
        
        const log = {
            id: 'log_' + (this.logs.length + 1),
            targetType: 'material_3d',
            targetId: materialId,
            targetName: material.name,
            operationType: opType,
            changeAmount: material.remainingWeightG - prevWeight,
            unit: 'g',
            previousBalance: prevWeight,
            newBalance: material.remainingWeightG,
            operator: operator.name,
            idempotencyKey,
            createdAt: new Date().toISOString()
        };

        if (idempotencyKey) this.idempotentKeys.add(idempotencyKey);
        this.logs.push(log);

        return { success: true, material, log };
    }

    adjustConsumableStock(consumableId, opType, amount, operator, notes = '', idempotencyKey = null) {
        if (idempotencyKey && this.idempotentKeys.has(idempotencyKey)) {
            const existingLog = this.logs.find(l => l.idempotencyKey === idempotencyKey);
            return { success: true, idempotent: true, log: existingLog };
        }

        const item = this.consumables.get(consumableId);
        if (!item) throw new Error('ERR_NOT_FOUND: 物资不存在');
        if (!item.isActive) throw new Error('ERR_ITEM_INACTIVE: 物资已停用');

        const prevStock = item.currentStock;
        let newStock = prevStock;

        if (opType === 'inbound') {
            if (amount <= 0) throw new Error('ERR_INVALID_AMOUNT: 数量必须大于0');
            newStock = prevStock + amount;
        } else if (opType === 'consume' || opType === 'scrap') {
            if (amount <= 0) throw new Error('ERR_INVALID_AMOUNT: 数量必须大于0');
            if (prevStock < amount) {
                throw new Error(`ERR_INSUFFICIENT_STOCK: 库存不足 (现有: ${prevStock} ${item.unit}, 请求: ${amount} ${item.unit})`);
            }
            newStock = prevStock - amount;
        } else if (opType === 'stocktake' || opType === 'adjust') {
            if (amount < 0) throw new Error('ERR_INVALID_AMOUNT: 盘点数量不能为负数');
            newStock = amount;
        }

        item.currentStock = Math.round(newStock * 100) / 100;

        const log = {
            id: 'log_' + (this.logs.length + 1),
            targetType: 'consumable',
            targetId: consumableId,
            targetName: item.name,
            operationType: opType,
            changeAmount: item.currentStock - prevStock,
            unit: item.unit,
            previousBalance: prevStock,
            newBalance: item.currentStock,
            operator: operator.name,
            idempotencyKey,
            createdAt: new Date().toISOString()
        };

        if (idempotencyKey) this.idempotentKeys.add(idempotencyKey);
        this.logs.push(log);

        return { success: true, item, log };
    }
}

export function runInventoryLogicTests() {
    console.log('--- [测试套件 2: 库存出入库、防超卖与幂等性保障] ---');
    let passed = 0;
    let failed = 0;

    const mgr = new MockInventoryManager();

    mgr.addMaterial3d({
        id: 'mat_1',
        name: '拓竹 PLA Basic 哑光白 1.75mm',
        materialType: 'PLA',
        brand: 'Bambu Lab',
        colorName: '哑光白',
        diameterMm: 1.75,
        remainingWeightG: 1000,
        minWeightThresholdG: 500,
        isActive: true
    });

    mgr.addMaterial3d({
        id: 'mat_2',
        name: '拓竹 PLA Basic 曜石黑 1.75mm',
        materialType: 'PLA',
        brand: 'Bambu Lab',
        colorName: '曜石黑',
        diameterMm: 1.75,
        remainingWeightG: 800,
        minWeightThresholdG: 500,
        isActive: true
    });

    mgr.addConsumable({
        id: 'con_1',
        name: '含铅焊锡丝 0.8mm',
        unit: '卷',
        currentStock: 10,
        minStockThreshold: 3,
        isActive: true
    });

    const op = { id: 'u1', name: '李同学' };

    // 1. 正常入库与消耗
    mgr.adjustMaterial3dWeight('mat_1', 'inbound', 500, op);
    if (mgr.materials3d.get('mat_1').remainingWeightG === 1500) {
        console.log('  ✓ [通过] 3D耗材正常入库累加 1000g + 500g = 1500g');
        passed++;
    } else {
        console.error('  ✗ [失败] 入库累加错误');
        failed++;
    }

    // 2. 正常消耗扣减
    mgr.adjustMaterial3dWeight('mat_1', 'consume', 300, op);
    if (mgr.materials3d.get('mat_1').remainingWeightG === 1200) {
        console.log('  ✓ [通过] 3D耗材正常消耗扣减 1500g - 300g = 1200g');
        passed++;
    } else {
        console.error('  ✗ [失败] 消耗扣减错误');
        failed++;
    }

    // 3. 独立物资隔离性测试
    if (mgr.materials3d.get('mat_2').remainingWeightG === 800) {
        console.log('  ✓ [通过] 规格隔离验证: mat_1 变动未污染 mat_2 (依然为 800g)');
        passed++;
    } else {
        console.error('  ✗ [失败] 耗材未独立隔离');
        failed++;
    }

    // 4. 防超卖与负库存拦截
    try {
        mgr.adjustMaterial3dWeight('mat_1', 'consume', 2000, op);
        console.error('  ✗ [失败] 未拦截超额消耗');
        failed++;
    } catch (e) {
        console.log(`  ✓ [通过] 超额消耗拦截成功: ${e.message}`);
        passed++;
    }

    // 5. 消耗品单位防混淆与防负库存
    mgr.adjustConsumableStock('con_1', 'consume', 4, op);
    if (mgr.consumables.get('con_1').currentStock === 6) {
        console.log('  ✓ [通过] 通用消耗品领用正常扣减 (10卷 -> 6卷)');
        passed++;
    } else {
        console.error('  ✗ [失败] 消耗品扣减错误');
        failed++;
    }

    try {
        mgr.adjustConsumableStock('con_1', 'consume', 10, op);
        console.error('  ✗ [失败] 消耗品超额领用未拦截');
        failed++;
    } catch (e) {
        console.log(`  ✓ [通过] 消耗品超额领用拦截成功: ${e.message}`);
        passed++;
    }

    // 6. 幂等性测试
    const idempotencyKey = 'req_unique_token_999';
    mgr.adjustConsumableStock('con_1', 'consume', 1, op, '打印支架固定', idempotencyKey);
    const stockAfterFirst = mgr.consumables.get('con_1').currentStock;

    const duplicateRes = mgr.adjustConsumableStock('con_1', 'consume', 1, op, '重复提交', idempotencyKey);
    const stockAfterDup = mgr.consumables.get('con_1').currentStock;

    if (stockAfterFirst === 5 && stockAfterDup === 5 && duplicateRes.idempotent) {
        console.log('  ✓ [通过] 幂等性防护生效: 重复相同 token 未引起二次扣减');
        passed++;
    } else {
        console.error('  ✗ [失败] 幂等性防护失效');
        failed++;
    }

    console.log(`套件 2 统计: 通过 ${passed}, 失败 ${failed}\n`);
    if (failed > 0) throw new Error('Inventory logic tests failed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runInventoryLogicTests();
}
