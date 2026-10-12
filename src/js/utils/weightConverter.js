// ==============================================================================
// 工具库: 3D 打印耗材重量计量与单位转换
// ==============================================================================

/**
 * 将任意输入（支持克 g 或千克 kg）精确转换为以克（g）为基准的浮点数
 * @param {number|string} value - 输入数值
 * @param {string} unit - 'g' 或 'kg'
 * @returns {number} 转换后的克数，保留两位小数
 */
export function parseWeightToGrams(value, unit = 'g') {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
        throw new Error('ERR_INVALID_WEIGHT: 重量必须为大于或等于 0 的合法数值');
    }
    const cleanUnit = (unit || 'g').trim().toLowerCase();
    let resultInGrams = 0;
    if (cleanUnit === 'kg' || cleanUnit === '千克' || cleanUnit === '公斤') {
        resultInGrams = num * 1000;
    } else if (cleanUnit === 'g' || cleanUnit === '克') {
        resultInGrams = num;
    } else {
        throw new Error(`ERR_UNSUPPORTED_UNIT: 不支持的重量单位: ${unit}，仅支持克(g)或千克(kg)`);
    }
    return Math.round(resultInGrams * 100) / 100;
}

/**
 * 格式化重量展示：默认显示克数，并在适当时展示千克辅助换算
 * @param {number} grams - 克数
 * @returns {string} 友好的展示文本，如 "3,250 g (3.25 kg)" 或 "450 g"
 */
export function formatWeightDisplay(grams) {
    if (typeof grams !== 'number' || isNaN(grams)) return '0 g';
    const gFixed = Math.round(grams * 100) / 100;
    const formattedG = gFixed.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (gFixed >= 1000) {
        const kgVal = (gFixed / 1000).toFixed(2);
        return `${formattedG} g (${kgVal} kg)`;
    }
    return `${formattedG} g`;
}

// 兼顾 Node.js CommonJS 环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseWeightToGrams, formatWeightDisplay };
}
