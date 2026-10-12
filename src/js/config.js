// ==============================================================================
// 配置中心: 支持在线 Supabase 模式与零配置本地沙箱演示模式切换
// ==============================================================================

export const APP_CONFIG = {
    APP_NAME: '义牙实验室物资与耗材管理系统',
    VERSION: 'v1.0.0',
    LAB_NAME: '义牙实验室（工程实践与材料研究）',

    // 获取当前运行模式：优先从 localStorage 读取，默认为 'sandbox'（确保开箱即可离线试用与演示）
    getMode() {
        return localStorage.getItem('yiya_app_mode') || 'sandbox';
    },

    setMode(mode) {
        localStorage.setItem('yiya_app_mode', mode);
    },

    // Supabase 在线配置
    getSupabaseConfig() {
        return {
            url: localStorage.getItem('yiya_supabase_url') || '',
            anonKey: localStorage.getItem('yiya_supabase_key') || ''
        };
    },

    setSupabaseConfig(url, anonKey) {
        localStorage.setItem('yiya_supabase_url', (url || '').trim());
        localStorage.setItem('yiya_supabase_key', (anonKey || '').trim());
    }
};
