// ==============================================================================
// 自动化测试总运行器 (Test Suite Runner - ESM)
// 项目：义牙实验室物资与耗材管理系统
// ==============================================================================

import { runWeightConverterTests } from './test_weight_converter.js';
import { runInventoryLogicTests } from './test_inventory_logic.js';
import { runToolLendingTests } from './test_tool_lending.js';
import { runRBACSecurityTests } from './test_rbac_security.js';

console.log('==============================================================================');
console.log('       义牙实验室物资与耗材管理系统 - 自动化业务逻辑与安全规则验证套件');
console.log('==============================================================================\n');

try {
    runWeightConverterTests();
    runInventoryLogicTests();
    runToolLendingTests();
    runRBACSecurityTests();

    console.log('==============================================================================');
    console.log('  🎉 所有业务逻辑、重量换算、借还状态机与 RBAC 安全防御测试均全部通过！');
    console.log('==============================================================================\n');
} catch (err) {
    console.error('测试执行中断，出现错误:', err);
    process.exit(1);
}
