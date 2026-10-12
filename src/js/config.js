// ==============================================================================
// 配置中心: 支持在线 Supabase 模式与零配置本地沙箱演示模式切换
// 优先级: URL 查询参数 (?mode=) > 浏览器本地覆盖 (localStorage) > 仓库默认值
// ==============================================================================

import { SUPABASE_DEFAULTS } from './config.defaults.js';

// 从地址栏读取强制模式，便于演示 (index.html?mode=sandbox) 与联调 (?mode=supabase)
function getModeFromUrl() {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return '';
    const forced = new URLSearchParams(window.location.search).get('mode');
    return forced === 'sandbox' || forced === 'supabase' ? forced : '';
}

export const APP_CONFIG = {
    APP_NAME: '义牙实验室物资与耗材管理系统',
    VERSION: 'v1.0.0',
    LAB_NAME: '义牙实验室（工程实践与材料研究）',

    // 仓库是否已内置可用的云端配置
    hasRepoSupabaseConfig() {
        return Boolean(SUPABASE_DEFAULTS.url && SUPABASE_DEFAULTS.anonKey);
    },

    // 获取当前运行模式：无本地覆盖时，仓库已配好云端就默认 supabase，否则退回沙箱演示
    getMode() {
        const urlMode = getModeFromUrl();
        if (urlMode) return urlMode;

        const saved = localStorage.getItem('yiya_app_mode');
        if (saved === 'sandbox' || saved === 'supabase') return saved;

        return this.hasRepoSupabaseConfig() ? 'supabase' : 'sandbox';
    },

    setMode(mode) {
        localStorage.setItem('yiya_app_mode', mode);
    },

    // Supabase 在线配置：浏览器本地填写的值优先，其次使用仓库默认值
    getSupabaseConfig() {
        const localUrl = localStorage.getItem('yiya_supabase_url') || '';
        const localKey = localStorage.getItem('yiya_supabase_key') || '';

        return {
            url: localUrl || SUPABASE_DEFAULTS.url || '',
            anonKey: localKey || SUPABASE_DEFAULTS.anonKey || '',
            // from: 'local' 表示本机手动覆盖过，'repo' 表示用的是随仓库提交的默认值
            from: (localUrl && localKey) ? 'local' : 'repo'
        };
    },

    // 与仓库默认值完全一致时清掉本地覆盖，避免默认配置日后更新被旧本地值压住
    setSupabaseConfig(url, anonKey) {
        const cleanUrl = (url || '').trim();
        const cleanKey = (anonKey || '').trim();

        if (cleanUrl === SUPABASE_DEFAULTS.url && cleanKey === SUPABASE_DEFAULTS.anonKey) {
            localStorage.removeItem('yiya_supabase_url');
            localStorage.removeItem('yiya_supabase_key');
            return;
        }

        localStorage.setItem('yiya_supabase_url', cleanUrl);
        localStorage.setItem('yiya_supabase_key', cleanKey);
    },

    // 清除本机覆盖，回到随仓库提交的默认配置
    clearLocalSupabaseOverride() {
        localStorage.removeItem('yiya_supabase_url');
        localStorage.removeItem('yiya_supabase_key');
    }
};
