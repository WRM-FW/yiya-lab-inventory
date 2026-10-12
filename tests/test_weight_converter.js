// ==============================================================================
// 模块: 3D 打印耗材重量计量与单位转换逻辑自动化测试
// ==============================================================================

import { parseWeightToGrams, formatWeightDisplay } from '../src/js/utils/weightConverter.js';

export function runWeightConverterTests() {
    console.log('--- [测试套件 1: 3D 打印耗材重量转换与精度计算] ---');
    let passed = 0;
    let failed = 0;

    function assertEqual(actual, expected, testName) {
        if (actual === expected) {
            console.log(`  ✓ [通过] ${testName}: ${actual}`);
            passed++;
        } else {
            console.error(`  ✗ [失败] ${testName}: 期望 ${expected}, 实际得到 ${actual}`);
            failed++;
        }
    }

    function assertThrows(fn, testName) {
        try {
            fn();
            console.error(`  ✗ [失败] ${testName}: 未如预期抛出异常`);
            failed++;
        } catch (e) {
            console.log(`  ✓ [通过] ${testName}: 捕获异常 -> ${e.message}`);
            passed++;
        }
    }

    // 1. 克数直入
    assertEqual(parseWeightToGrams(500, 'g'), 500, '500克标准转换');
    assertEqual(parseWeightToGrams('3250.5', 'g'), 3250.5, '字符串浮点数克转换');

    // 2. 千克转克
    assertEqual(parseWeightToGrams(1, 'kg'), 1000, '1千克转换为1000克');
    assertEqual(parseWeightToGrams('2.5', 'kg'), 2500, '2.5千克转换为2500克');
    assertEqual(parseWeightToGrams('0.05', 'kg'), 50, '0.05千克转换为50克');
    assertEqual(parseWeightToGrams(1.234, 'kg'), 1234, '1.234千克转换为1234克');

    // 3. 边界与非法校验
    assertThrows(() => parseWeightToGrams(-10, 'g'), '负数克数拒绝拦截');
    assertThrows(() => parseWeightToGrams(-1, 'kg'), '负数千克拒绝拦截');
    assertThrows(() => parseWeightToGrams('abc', 'g'), '非数值文本拦截');
    assertThrows(() => parseWeightToGrams(100, 'ton'), '不支持的单位拦截');

    // 4. 展示格式化验证
    assertEqual(formatWeightDisplay(3250), '3,250 g (3.25 kg)', '千克辅助展示');
    assertEqual(formatWeightDisplay(450), '450 g', '低于1000克仅显示克数');

    console.log(`套件 1 统计: 通过 ${passed}, 失败 ${failed}\n`);
    if (failed > 0) throw new Error('Weight converter tests failed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runWeightConverterTests();
}
