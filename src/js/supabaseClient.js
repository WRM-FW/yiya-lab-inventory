// ==============================================================================
// 轻量级原生 Supabase 客户端 (基于浏览器 Fetch API，零依赖，高兼容)
// ------------------------------------------------------------------------------
// 本文件承担前端 camelCase 与数据库 snake_case 之间的唯一映射层：
// 视图层与 store 全程使用 camelCase 字段名，PostgREST 只认数据库列名，
// 因此读取出口统一转 camelCase，写入入口统一转 snake_case。
// ==============================================================================

import { APP_CONFIG } from './config.js';

// materials_3d -> materials3d, remaining_weight_g -> remainingWeightG
function toCamel(key) {
    return key.replace(/_+([a-z0-9])/gi, (_, ch) => ch.toUpperCase());
}

// remainingWeightG -> remaining_weight_g, diameterMm -> diameter_mm
function toSnake(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function mapKeysDeep(value, mapper) {
    if (Array.isArray(value)) return value.map(v => mapKeysDeep(v, mapper));
    if (value && typeof value === 'object' && value.constructor === Object) {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[mapper(k)] = mapKeysDeep(v, mapper);
        return out;
    }
    return value;
}

// PostgREST 过滤语法要求 "列=操作符.值"，缺操作符会报 failed to parse filter
function buildFilterParams(filters) {
    const params = new URLSearchParams();
    for (const [column, value] of Object.entries(filters || {})) {
        const col = toSnake(column);
        if (value === null || value === undefined) {
            params.append(col, 'is.null');
        } else if (Array.isArray(value)) {
            params.append(col, `in.(${value.map(v => String(v).replace(/[(),]/g, '')).join(',')})`);
        } else if (typeof value === 'string' && /^(eq|neq|gt|gte|lt|lte|like|ilike|is)\./.test(value)) {
            params.append(col, value);
        } else {
            params.append(col, `eq.${value}`);
        }
    }
    return params;
}

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

        // 注册接口若直接下发会话（未开启邮箱确认时），一并持久化，
        // 避免刚提交完申请的浏览器处于“有档案无凭证”状态，刷新后还要再登录一次
        if (data.access_token) {
            this.token = data.access_token;
            this.user = data.user;
            localStorage.setItem('yiya_sb_token', this.token);
            localStorage.setItem('yiya_sb_user', JSON.stringify(this.user));
        }
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
            body: JSON.stringify(mapKeysDeep(params, toSnake))
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || data.hint || `执行 ${functionName} 失败`);
        }
        return mapKeysDeep(data, toCamel);
    }

    from(table) {
        const { url } = this.getConfig();
        const self = this;
        const path = `${url}/rest/v1/${table}`;

        return {
            // filters 默认等值匹配；options.order 形如 { createdAt: 'desc' }
            async select(columns = '*', filters = {}, options = {}) {
                const params = buildFilterParams(filters);
                params.set('select', columns);
                if (options.order) {
                    const order = Object.entries(options.order)
                        .map(([col, dir]) => `${toSnake(col)}.${dir === 'asc' || dir === true ? 'asc' : 'desc'}`)
                        .join(',');
                    params.set('order', order);
                }
                if (options.limit) params.set('limit', String(options.limit));

                const res = await fetch(`${path}?${params.toString()}`, {
                    method: 'GET',
                    headers: self.getHeaders()
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '查询失败');
                return mapKeysDeep(data, toCamel);
            },

            async insert(records) {
                const res = await fetch(path, {
                    method: 'POST',
                    headers: self.getHeaders(),
                    body: JSON.stringify(mapKeysDeep(records, toSnake))
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '插入失败');
                return mapKeysDeep(data, toCamel);
            },

            async update(values, match) {
                const params = buildFilterParams(match);
                const res = await fetch(`${path}?${params.toString()}`, {
                    method: 'PATCH',
                    headers: self.getHeaders(),
                    body: JSON.stringify(mapKeysDeep(values, toSnake))
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || '更新失败');
                return mapKeysDeep(data, toCamel);
            }
        };
    }
}

export const supabase = new SupabaseRestClient();
