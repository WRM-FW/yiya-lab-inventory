// ==============================================================================
// 轻量级原生 Supabase 客户端 (基于浏览器 Fetch API，零依赖，高兼容)
// ==============================================================================

import { APP_CONFIG } from './config.js';

class SupabaseRestClient {
    constructor() {
        this.token = localStorage.getItem('yiya_sb_token') || null;
        this.user = JSON.parse(localStorage.getItem('yiya_sb_user') || 'null');
    }

    getConfig() {
        return APP_CONFIG.getSupabaseConfig();
    }

    getHeaders() {
        const { anonKey } = this.getConfig();
        const headers = {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Prefer': 'return=representation'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async signUp(email, password, metadata = {}) {
        const { url, anonKey } = this.getConfig();
        if (!url || !anonKey) throw new Error('ERR_CONFIG: 请先配置 Supabase URL 与 Anon Key');

        const res = await fetch(`${url}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey
            },
            body: JSON.stringify({
                email,
                password,
                data: metadata
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.msg || data.error_description || '注册失败');
        return data;
    }

    async signInWithPassword(email, password) {
        const { url, anonKey } = this.getConfig();
        if (!url || !anonKey) throw new Error('ERR_CONFIG: 请先配置 Supabase URL 与 Anon Key');

        const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.msg || '登录失败');

        this.token = data.access_token;
        this.user = data.user;
        localStorage.setItem('yiya_sb_token', this.token);
        localStorage.setItem('yiya_sb_user', JSON.stringify(this.user));
        return data;
    }

    async signOut() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('yiya_sb_token');
        localStorage.removeItem('yiya_sb_user');
    }

    async rpc(functionName, params = {}) {
        const { url } = this.getConfig();
        const res = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || data.hint || `执行 ${functionName} 失败`);
        }
        return data;
    }

    from(table) {
        const { url } = this.getConfig();
        const self = this;

        return {
            async select(columns = '*', filters = {}) {
                let queryUrl = `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}`;
                for (const [k, v] of Object.entries(filters)) {
                    queryUrl += `&${k}=${encodeURIComponent(v)}`;
                }
                const res = await fetch(queryUrl, {
                    method: 'GET',
                    headers: self.getHeaders()
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '查询失败');
                return data;
            },

            async insert(records) {
                const res = await fetch(`${url}/rest/v1/${table}`, {
                    method: 'POST',
                    headers: self.getHeaders(),
                    body: JSON.stringify(records)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '插入失败');
                return data;
            },

            async update(values, match) {
                let queryUrl = `${url}/rest/v1/${table}?`;
                for (const [k, v] of Object.entries(match)) {
                    queryUrl += `${k}=${encodeURIComponent(v)}&`;
                }
                const res = await fetch(queryUrl, {
                    method: 'PATCH',
                    headers: self.getHeaders(),
                    body: JSON.stringify(values)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '更新失败');
                return data;
            }
        };
    }
}

export const supabase = new SupabaseRestClient();
