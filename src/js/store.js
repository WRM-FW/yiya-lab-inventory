// ==============================================================================
// 全局状态管理中心 (Store)
// 支持双模式: 1. 本地免配沙箱演示模式 (Sandbox Demo) 2. 生产 Supabase 云端模式
// ==============================================================================

import { APP_CONFIG } from './config.js';
import { supabase } from './supabaseClient.js';

// 初始沙箱演示数据
const INITIAL_SANDBOX_STATE = {
    users: [
        { id: 'u_admin', email: 'admin@yiya-lab.edu.cn', fullName: '陈老师 (实验室主管)', role: 'admin', status: 'approved', studentOrStaffId: 'T2019088' },
        { id: 'u_member_1', email: 'student1@yiya-lab.edu.cn', fullName: '张同学 (竞赛队长)', role: 'member', status: 'approved', studentOrStaffId: 'S20230101' },
        { id: 'u_member_2', email: 'student2@yiya-lab.edu.cn', fullName: '李同学 (材料组)', role: 'member', status: 'approved', studentOrStaffId: 'S20230102' },
        { id: 'u_pending_1', email: 'applicant@yiya-lab.edu.cn', fullName: '王同学 (新加入待审核)', role: 'member', status: 'pending', studentOrStaffId: 'S20240909' }
    ],
    locations: [
        { id: 'loc_1', name: 'A区3D打印耗材防潮柜', description: '带除湿卡，存放开封与整卷线材' },
        { id: 'loc_2', name: 'B区焊接操作台配件架', description: '焊接工位上方，放置焊锡丝、助焊剂' },
        { id: 'loc_3', name: 'C区工具挂板与收纳柜', description: '常用装配工具挂放与测量仪器' },
        { id: 'loc_4', name: '耗材储备库1号货架', description: '备用原材料与紧固件' }
    ],
    categories: [
        { id: 'cat_1', name: '3D打印热塑性线材', type: 'filament_3d', description: '适用于FDM打印机的工程线材' },
        { id: 'cat_2', name: '焊接耗材与加工辅料', type: 'general_consumable', description: '焊接与组装消耗品' },
        { id: 'cat_3', name: '紧固件与结构耗材', type: 'general_consumable', description: '螺丝、螺母、垫片' },
        { id: 'cat_4', name: '常用工程装配工具', type: 'tool', description: '可重复借用工具' },
        { id: 'cat_5', name: '电子与测量仪器', type: 'tool', description: '万用表、卡尺' }
    ],
    materials3d: [
        {
            id: 'm3d_1',
            name: '拓竹 PLA Basic 哑光白 1.75mm',
            materialType: 'PLA',
            brand: 'Bambu Lab',
            colorName: '哑光白',
            colorHex: '#FAFAFA',
            diameterMm: 1.75,
            packageSpec: '1 kg/卷',
            remainingWeightG: 3250.00, // 3.25 kg
            minWeightThresholdG: 500.00,
            locationId: 'loc_1',
            supplier: '拓竹官方自营店',
            isActive: true,
            notes: '外观件常用'
        },
        {
            id: 'm3d_2',
            name: '拓竹 PLA Basic 曜石黑 1.75mm',
            materialType: 'PLA',
            brand: 'Bambu Lab',
            colorName: '曜石黑',
            colorHex: '#222222',
            diameterMm: 1.75,
            packageSpec: '1 kg/卷',
            remainingWeightG: 1800.00,
            minWeightThresholdG: 500.00,
            locationId: 'loc_1',
            supplier: '拓竹官方自营店',
            isActive: true,
            notes: '结构支架高频色'
        },
        {
            id: 'm3d_3',
            name: 'eSUN 易生 PETG 高透亮 1.75mm',
            materialType: 'PETG',
            brand: 'eSUN',
            colorName: '高透明',
            colorHex: '#E0F7FA',
            diameterMm: 1.75,
            packageSpec: '1 kg/卷',
            remainingWeightG: 380.00, // 低于500g预警！
            minWeightThresholdG: 500.00,
            locationId: 'loc_1',
            supplier: '易生旗舰店',
            isActive: true,
            notes: '耐温部件专用（已低于预警线，需及时补仓）'
        },
        {
            id: 'm3d_4',
            name: 'Polymaker PolyLite ABS 浅灰 1.75mm',
            materialType: 'ABS',
            brand: 'Polymaker',
            colorName: '浅灰',
            colorHex: '#BDBDBD',
            diameterMm: 1.75,
            packageSpec: '1 kg/卷',
            remainingWeightG: 2150.00,
            minWeightThresholdG: 500.00,
            locationId: 'loc_1',
            supplier: '京东自营',
            isActive: true,
            notes: '封箱打印机使用'
        },
        {
            id: 'm3d_5',
            name: '三绿 TPU 95A 高弹荧光黄 1.75mm',
            materialType: 'TPU',
            brand: '三绿',
            colorName: '荧光黄',
            colorHex: '#FFEB3B',
            diameterMm: 1.75,
            packageSpec: '1 kg/卷',
            remainingWeightG: 920.00,
            minWeightThresholdG: 300.00,
            locationId: 'loc_1',
            supplier: '三绿自营店',
            isActive: true,
            notes: '柔性轮垫专用'
        }
    ],
    consumables: [
        {
            id: 'con_1',
            name: '维修级 63/37 含铅焊锡丝 0.8mm',
            categoryId: 'cat_2',
            modelSpec: '500g/卷 熔点183℃',
            unit: '卷',
            currentStock: 12.00,
            minStockThreshold: 3.00,
            locationId: 'loc_2',
            supplier: '得力工业品',
            isActive: true,
            notes: '焊接工位基础消耗品'
        },
        {
            id: 'con_2',
            name: '高活性中性松香助焊膏 50g',
            categoryId: 'cat_2',
            modelSpec: '黄盒 50g',
            unit: '盒',
            currentStock: 8.00,
            minStockThreshold: 2.00,
            locationId: 'loc_2',
            supplier: '得力工业品',
            isActive: true,
            notes: 'PCB 焊接'
        },
        {
            id: 'con_3',
            name: '环保型高纯度洗板水 500ml',
            categoryId: 'cat_2',
            modelSpec: '带防挥发压泵瓶',
            unit: '瓶',
            currentStock: 1.00, // 低于3瓶预警！
            minStockThreshold: 3.00,
            locationId: 'loc_2',
            supplier: '得力工业品',
            isActive: true,
            notes: '焊后松香清洗，已达预警线'
        },
        {
            id: 'con_4',
            name: '多规格阻燃热缩管套盒',
            categoryId: 'cat_2',
            modelSpec: '127支/盒',
            unit: '盒',
            currentStock: 6.00,
            minStockThreshold: 2.00,
            locationId: 'loc_2',
            supplier: '天猫电工专营',
            isActive: true,
            notes: '线束绝缘保护'
        },
        {
            id: 'con_5',
            name: '304不锈钢内六角螺钉 M3*10',
            categoryId: 'cat_3',
            modelSpec: '100只/包 A2-70',
            unit: '包',
            currentStock: 16.00,
            minStockThreshold: 4.00,
            locationId: 'loc_4',
            supplier: '震坤行工业超市',
            isActive: true,
            notes: '机甲结构件紧固常用'
        }
    ],
    tools: [
        {
            id: 'tool_1',
            name: 'T12 便携式数显恒温电烙铁 72W',
            categoryId: 'cat_4',
            modelSpec: '快热型 自动休眠',
            totalQuantity: 6,
            availableQuantity: 4,
            borrowedQuantity: 2,
            locationId: 'loc_3',
            isActive: true,
            notes: '借出前请检查烙铁头'
        },
        {
            id: 'tool_2',
            name: '858D 热风拆焊台 700W',
            categoryId: 'cat_4',
            modelSpec: '无刷风机 旋钮调温',
            totalQuantity: 3,
            availableQuantity: 3,
            borrowedQuantity: 0,
            locationId: 'loc_2',
            isActive: true,
            notes: '仅限焊接实验台使用'
        },
        {
            id: 'tool_3',
            name: '优利德 UT33D+ 手持数字万用表',
            categoryId: 'cat_5',
            modelSpec: '带蜂鸣测通断/防烧',
            totalQuantity: 5,
            availableQuantity: 4,
            borrowedQuantity: 1,
            locationId: 'loc_3',
            isActive: true,
            notes: '附带测试表笔一副'
        },
        {
            id: 'tool_4',
            name: '高精度数显不锈钢游标卡尺 150mm',
            categoryId: 'cat_5',
            modelSpec: '分辨率 0.01mm',
            totalQuantity: 4,
            availableQuantity: 3,
            borrowedQuantity: 1,
            locationId: 'loc_3',
            isActive: true,
            notes: '借还请装入塑料保护盒'
        },
        {
            id: 'tool_5',
            name: '罗宾汉防静电精密斜口钳 5寸',
            categoryId: 'cat_4',
            modelSpec: '碳钢刃口 剪切铜丝专用',
            totalQuantity: 8,
            availableQuantity: 8,
            borrowedQuantity: 0,
            locationId: 'loc_3',
            isActive: true,
            notes: '严禁剪铁丝'
        }
    ],
    loans: [
        {
            id: 'loan_1',
            toolId: 'tool_1',
            toolName: 'T12 便携式数显恒温电烙铁 72W',
            borrowQuantity: 1,
            borrowerId: 'u_member_1',
            borrowerName: '张同学 (竞赛队长)',
            contactInfo: '13800138001',
            borrowedAt: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
            expectedReturnAt: '2026-10-15',
            returnedAt: null,
            status: 'borrowed',
            notes: '机甲战车电控板调试'
        },
        {
            id: 'loan_2',
            toolId: 'tool_1',
            toolName: 'T12 便携式数显恒温电烙铁 72W',
            borrowQuantity: 1,
            borrowerId: 'u_member_2',
            borrowerName: '李同学 (材料组)',
            contactInfo: '13800138002',
            borrowedAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
            expectedReturnAt: '2026-10-14',
            returnedAt: null,
            status: 'borrowed',
            notes: '热电偶导线引脚焊接'
        },
        {
            id: 'loan_3',
            toolId: 'tool_3',
            toolName: '优利德 UT33D+ 手持数字万用表',
            borrowQuantity: 1,
            borrowerId: 'u_member_1',
            borrowerName: '张同学 (竞赛队长)',
            contactInfo: '13800138001',
            borrowedAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
            expectedReturnAt: '2026-10-13',
            returnedAt: null,
            status: 'borrowed',
            notes: '测试供电母线电压稳定性'
        },
        {
            id: 'loan_4',
            toolId: 'tool_4',
            toolName: '高精度数显不锈钢游标卡尺 150mm',
            borrowQuantity: 1,
            borrowerId: 'u_member_2',
            borrowerName: '李同学 (材料组)',
            contactInfo: '13800138002',
            borrowedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
            expectedReturnAt: '2026-10-13',
            returnedAt: null,
            status: 'borrowed',
            notes: '测量打印样件收缩率'
        }
    ],
    logs: [
        {
            id: 'log_1',
            targetType: 'material_3d',
            targetId: 'm3d_1',
            targetName: '拓竹 PLA Basic 哑光白 1.75mm',
            operationType: 'inbound',
            changeAmount: 1000,
            unit: 'g',
            previousBalance: 2250,
            newBalance: 3250,
            operatorId: 'u_admin',
            operatorName: '陈老师 (实验室主管)',
            notes: '秋季学期采购线材入库 (1卷 1kg)',
            createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString()
        },
        {
            id: 'log_2',
            targetType: 'material_3d',
            targetId: 'm3d_3',
            targetName: 'eSUN 易生 PETG 高透亮 1.75mm',
            operationType: 'consume',
            changeAmount: -420,
            unit: 'g',
            previousBalance: 800,
            newBalance: 380,
            operatorId: 'u_member_1',
            operatorName: '张同学 (竞赛队长)',
            notes: '打印无人机高透保护外壳 2套 (实际称重扣减)',
            createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString()
        },
        {
            id: 'log_3',
            targetType: 'consumable',
            targetId: 'con_1',
            targetName: '维修级 63/37 含铅焊锡丝 0.8mm',
            operationType: 'consume',
            changeAmount: -1,
            unit: '卷',
            previousBalance: 13,
            newBalance: 12,
            operatorId: 'u_member_2',
            operatorName: '李同学 (材料组)',
            notes: '领用1卷至焊接2号工位',
            createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
        }
    ]
};

class Store {
    constructor() {
        this.listeners = [];
        this.mode = APP_CONFIG.getMode();
        this.currentUser = null;
        this.init();
    }

    init() {
        // 读取登录用户缓存
        const cachedUser = localStorage.getItem('yiya_current_user');
        if (cachedUser) {
            try {
                this.currentUser = JSON.parse(cachedUser);
            } catch (e) {
                this.currentUser = null;
            }
        } else {
            // 沙箱默认默认以管理员体验登录，提供极致流畅体验
            if (this.mode === 'sandbox') {
                this.currentUser = INITIAL_SANDBOX_STATE.users[0]; // admin
                localStorage.setItem('yiya_current_user', JSON.stringify(this.currentUser));
            }
        }

        // 初始化沙箱数据到 localStorage（若无）
        if (!localStorage.getItem('yiya_sandbox_data')) {
            localStorage.setItem('yiya_sandbox_data', JSON.stringify(INITIAL_SANDBOX_STATE));
        }
    }

    subscribe(fn) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    notify() {
        this.listeners.forEach(fn => fn());
    }

    getSandboxData() {
        try {
            return JSON.parse(localStorage.getItem('yiya_sandbox_data')) || INITIAL_SANDBOX_STATE;
        } catch (e) {
            return INITIAL_SANDBOX_STATE;
        }
    }

    saveSandboxData(data) {
        localStorage.setItem('yiya_sandbox_data', JSON.stringify(data));
        this.notify();
    }

    resetSandboxData() {
        localStorage.setItem('yiya_sandbox_data', JSON.stringify(INITIAL_SANDBOX_STATE));
        this.notify();
    }

    // 认证相关
    async login(email, password) {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
            if (!user) {
                throw new Error('未找到该邮箱对应的账号。演示账号：admin@yiya-lab.edu.cn 或 student1@yiya-lab.edu.cn');
            }
            this.currentUser = user;
            localStorage.setItem('yiya_current_user', JSON.stringify(user));
            this.notify();
            return user;
        } else {
            // Supabase 模式
            const res = await supabase.signInWithPassword(email, password);
            // 获取 profile
            const profiles = await supabase.from('users_profile').select('*', { id: res.user.id });
            const profile = profiles && profiles[0] ? profiles[0] : {
                id: res.user.id,
                email: res.user.email,
                fullName: res.user.user_metadata?.full_name || email,
                role: 'member',
                status: 'pending'
            };
            this.currentUser = profile;
            localStorage.setItem('yiya_current_user', JSON.stringify(profile));
            this.notify();
            return profile;
        }
    }

    async register(email, password, fullName, studentId = '') {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
                throw new Error('该邮箱已存在注册申请，不可重复注册');
            }
            const newUser = {
                id: 'u_' + Date.now(),
                email: email.trim(),
                fullName: fullName.trim(),
                studentOrStaffId: studentId.trim(),
                role: 'member',
                status: 'pending' // 必须待审核
            };
            data.users.push(newUser);
            this.saveSandboxData(data);
            this.currentUser = newUser;
            localStorage.setItem('yiya_current_user', JSON.stringify(newUser));
            this.notify();
            return newUser;
        } else {
            const res = await supabase.signUp(email, password, { full_name: fullName, student_id: studentId });
            const profile = {
                id: res.user?.id || 'temp_id',
                email,
                fullName,
                studentOrStaffId: studentId,
                role: 'member',
                status: 'pending'
            };
            this.currentUser = profile;
            localStorage.setItem('yiya_current_user', JSON.stringify(profile));
            this.notify();
            return profile;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('yiya_current_user');
        if (this.mode === 'supabase') {
            supabase.signOut();
        }
        this.notify();
    }

    // 快捷切换当前登录用户（仅沙箱模式测试用）
    switchUser(userId) {
        if (this.mode !== 'sandbox') return;
        const data = this.getSandboxData();
        const user = data.users.find(u => u.id === userId);
        if (user) {
            this.currentUser = user;
            localStorage.setItem('yiya_current_user', JSON.stringify(user));
            this.notify();
        }
    }

    // 数据读取接口 (聚合)
    async getLocations() {
        if (this.mode === 'sandbox') return this.getSandboxData().locations;
        return await supabase.from('storage_locations').select('*');
    }

    async getCategories() {
        if (this.mode === 'sandbox') return this.getSandboxData().categories;
        return await supabase.from('categories').select('*');
    }

    async getMaterials3D() {
        if (this.mode === 'sandbox') return this.getSandboxData().materials3d;
        return await supabase.from('materials_3d').select('*');
    }

    async getConsumables() {
        if (this.mode === 'sandbox') return this.getSandboxData().consumables;
        return await supabase.from('general_consumables').select('*');
    }

    async getTools() {
        if (this.mode === 'sandbox') return this.getSandboxData().tools;
        return await supabase.from('reusable_tools').select('*');
    }

    async getLoans() {
        if (this.mode === 'sandbox') return this.getSandboxData().loans;
        return await supabase.from('tool_loans').select('*');
    }

    async getLogs() {
        if (this.mode === 'sandbox') return this.getSandboxData().logs;
        return await supabase.from('inventory_logs').select('*');
    }

    async getUsers() {
        if (this.mode === 'sandbox') return this.getSandboxData().users;
        return await supabase.from('users_profile').select('*');
    }

    // 业务写操作：3D耗材变更 (入库/消耗/报损/盘点)
    async adjustMaterialWeight(materialId, opType, amountG, notes = '') {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const mat = data.materials3d.find(m => m.id === materialId);
            if (!mat) throw new Error('耗材不存在');
            if (!mat.isActive) throw new Error('该耗材已停用，无法操作');

            const prev = mat.remainingWeightG;
            let next = prev;

            if (opType === 'inbound') {
                if (amountG <= 0) throw new Error('入库重量必须大于 0 克');
                next = prev + amountG;
            } else if (opType === 'consume' || opType === 'scrap') {
                if (amountG <= 0) throw new Error('扣减重量必须大于 0 克');
                if (prev < amountG) throw new Error(`剩余重量不足 (在库: ${prev}g, 扣减: ${amountG}g)`);
                next = prev - amountG;
            } else if (opType === 'stocktake' || opType === 'adjust') {
                if (amountG < 0) throw new Error('盘点重量不能为负数');
                next = amountG;
            }

            mat.remainingWeightG = Math.round(next * 100) / 100;

            const log = {
                id: 'log_' + Date.now(),
                targetType: 'material_3d',
                targetId: materialId,
                targetName: mat.name,
                operationType: opType,
                changeAmount: mat.remainingWeightG - prev,
                unit: 'g',
                previousBalance: prev,
                newBalance: mat.remainingWeightG,
                operatorId: this.currentUser?.id || 'unknown',
                operatorName: this.currentUser?.fullName || '操作人',
                notes: notes.trim(),
                createdAt: new Date().toISOString()
            };

            data.logs.unshift(log);
            this.saveSandboxData(data);
            return { success: true, material: mat, log };
        } else {
            return await supabase.rpc('fn_adjust_material_3d_weight', {
                p_material_id: materialId,
                p_operation_type: opType,
                p_change_amount_g: amountG,
                p_operator_id: this.currentUser?.id,
                p_operator_name: this.currentUser?.fullName,
                p_notes: notes
            });
        }
    }

    // 业务写操作：消耗品变更
    async adjustConsumableStock(consumableId, opType, amount, notes = '') {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const item = data.consumables.find(c => c.id === consumableId);
            if (!item) throw new Error('消耗品不存在');
            if (!item.isActive) throw new Error('该物品已停用');

            const prev = item.currentStock;
            let next = prev;

            if (opType === 'inbound') {
                if (amount <= 0) throw new Error('入库数量必须大于 0');
                next = prev + amount;
            } else if (opType === 'consume' || opType === 'scrap') {
                if (amount <= 0) throw new Error('领用/报损数量必须大于 0');
                if (prev < amount) throw new Error(`库存不足 (现有: ${prev} ${item.unit}, 扣减: ${amount} ${item.unit})`);
                next = prev - amount;
            } else if (opType === 'stocktake' || opType === 'adjust') {
                if (amount < 0) throw new Error('盘点库存不能为负数');
                next = amount;
            }

            item.currentStock = Math.round(next * 100) / 100;

            const log = {
                id: 'log_' + Date.now(),
                targetType: 'consumable',
                targetId: consumableId,
                targetName: item.name,
                operationType: opType,
                changeAmount: item.currentStock - prev,
                unit: item.unit,
                previousBalance: prev,
                newBalance: item.currentStock,
                operatorId: this.currentUser?.id || 'unknown',
                operatorName: this.currentUser?.fullName || '操作人',
                notes: notes.trim(),
                createdAt: new Date().toISOString()
            };

            data.logs.unshift(log);
            this.saveSandboxData(data);
            return { success: true, item, log };
        } else {
            return await supabase.rpc('fn_adjust_consumable_stock', {
                p_consumable_id: consumableId,
                p_operation_type: opType,
                p_change_amount: amount,
                p_operator_id: this.currentUser?.id,
                p_operator_name: this.currentUser?.fullName,
                p_notes: notes
            });
        }
    }

    // 业务写操作：工具借出
    async borrowTool(toolId, quantity, borrowerName, contactInfo, expectedReturnAt, notes = '') {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const tool = data.tools.find(t => t.id === toolId);
            if (!tool) throw new Error('工具不存在');
            if (!tool.isActive) throw new Error('该工具已停用');
            if (quantity <= 0) throw new Error('借出数量必须大于 0');
            if (tool.availableQuantity < quantity) {
                throw new Error(`可用库存不足 (在库: ${tool.availableQuantity}, 申请借出: ${quantity})`);
            }

            tool.availableQuantity -= quantity;
            tool.borrowedQuantity += quantity;

            const loan = {
                id: 'loan_' + Date.now(),
                toolId: tool.id,
                toolName: tool.name,
                borrowQuantity: quantity,
                borrowerId: this.currentUser?.id || 'u_guest',
                borrowerName: borrowerName.trim() || this.currentUser?.fullName || '实验室成员',
                contactInfo: contactInfo.trim(),
                borrowedAt: new Date().toISOString(),
                expectedReturnAt: expectedReturnAt || null,
                returnedAt: null,
                status: 'borrowed',
                notes: notes.trim()
            };

            data.loans.unshift(loan);

            const log = {
                id: 'log_' + Date.now(),
                targetType: 'tool',
                targetId: tool.id,
                targetName: tool.name,
                operationType: 'adjust',
                changeAmount: -quantity,
                unit: '件',
                previousBalance: tool.availableQuantity + quantity,
                newBalance: tool.availableQuantity,
                operatorId: this.currentUser?.id || 'unknown',
                operatorName: this.currentUser?.fullName || '操作人',
                notes: `工具借出登记（借用人: ${loan.borrowerName}, 数量: ${quantity}件）`,
                createdAt: new Date().toISOString()
            };
            data.logs.unshift(log);

            this.saveSandboxData(data);
            return { success: true, tool, loan };
        } else {
            return await supabase.rpc('fn_borrow_tool', {
                p_tool_id: toolId,
                p_borrow_quantity: quantity,
                p_borrower_id: this.currentUser?.id,
                p_borrower_name: borrowerName || this.currentUser?.fullName,
                p_contact_info: contactInfo,
                p_expected_return_at: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : null,
                p_notes: notes
            });
        }
    }

    // 业务写操作：工具归还
    async returnTool(loanId, returnNotes = '') {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const loan = data.loans.find(l => l.id === loanId);
            if (!loan) throw new Error('借出记录不存在');
            if (loan.status === 'returned') throw new Error('该记录已归还，请勿重复操作');

            const tool = data.tools.find(t => t.id === loan.toolId);
            if (!tool) throw new Error('关联工具不存在');

            tool.availableQuantity += loan.borrowQuantity;
            tool.borrowedQuantity -= loan.borrowQuantity;

            loan.status = 'returned';
            loan.returnedAt = new Date().toISOString();
            loan.returnOperator = this.currentUser?.fullName || '管理员';
            if (returnNotes) {
                loan.notes = (loan.notes ? loan.notes + ' | ' : '') + '归还说明: ' + returnNotes;
            }

            const log = {
                id: 'log_' + Date.now(),
                targetType: 'tool',
                targetId: tool.id,
                targetName: tool.name,
                operationType: 'adjust',
                changeAmount: loan.borrowQuantity,
                unit: '件',
                previousBalance: tool.availableQuantity - loan.borrowQuantity,
                newBalance: tool.availableQuantity,
                operatorId: this.currentUser?.id || 'unknown',
                operatorName: this.currentUser?.fullName || '操作人',
                notes: `工具归还核销（单号: ${loan.id}, 借用人: ${loan.borrowerName}）`,
                createdAt: new Date().toISOString()
            };
            data.logs.unshift(log);

            this.saveSandboxData(data);
            return { success: true, tool, loan };
        } else {
            return await supabase.rpc('fn_return_tool', {
                p_loan_id: loanId,
                p_return_operator_id: this.currentUser?.id,
                p_return_operator_name: this.currentUser?.fullName,
                p_notes: returnNotes
            });
        }
    }

    // 新增物资与维护
    async saveMaterial3D(itemData) {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            if (itemData.id) {
                const idx = data.materials3d.findIndex(m => m.id === itemData.id);
                if (idx !== -1) {
                    data.materials3d[idx] = { ...data.materials3d[idx], ...itemData };
                }
            } else {
                const newItem = {
                    id: 'm3d_' + Date.now(),
                    isActive: true,
                    remainingWeightG: itemData.remainingWeightG || 0,
                    minWeightThresholdG: itemData.minWeightThresholdG || 500,
                    ...itemData
                };
                data.materials3d.push(newItem);
                // 记录初始入库流水
                if (newItem.remainingWeightG > 0) {
                    data.logs.unshift({
                        id: 'log_' + Date.now(),
                        targetType: 'material_3d',
                        targetId: newItem.id,
                        targetName: newItem.name,
                        operationType: 'inbound',
                        changeAmount: newItem.remainingWeightG,
                        unit: 'g',
                        previousBalance: 0,
                        newBalance: newItem.remainingWeightG,
                        operatorId: this.currentUser?.id || 'unknown',
                        operatorName: this.currentUser?.fullName || '操作人',
                        notes: '新建3D耗材档案初始化建库',
                        createdAt: new Date().toISOString()
                    });
                }
            }
            this.saveSandboxData(data);
        } else {
            if (itemData.id) {
                await supabase.from('materials_3d').update(itemData, { id: itemData.id });
            } else {
                await supabase.from('materials_3d').insert([itemData]);
            }
        }
    }

    async saveConsumable(itemData) {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            if (itemData.id) {
                const idx = data.consumables.findIndex(c => c.id === itemData.id);
                if (idx !== -1) {
                    data.consumables[idx] = { ...data.consumables[idx], ...itemData };
                }
            } else {
                const newItem = {
                    id: 'con_' + Date.now(),
                    isActive: true,
                    currentStock: itemData.currentStock || 0,
                    minStockThreshold: itemData.minStockThreshold || 5,
                    ...itemData
                };
                data.consumables.push(newItem);
                if (newItem.currentStock > 0) {
                    data.logs.unshift({
                        id: 'log_' + Date.now(),
                        targetType: 'consumable',
                        targetId: newItem.id,
                        targetName: newItem.name,
                        operationType: 'inbound',
                        changeAmount: newItem.currentStock,
                        unit: newItem.unit,
                        previousBalance: 0,
                        newBalance: newItem.currentStock,
                        operatorId: this.currentUser?.id || 'unknown',
                        operatorName: this.currentUser?.fullName || '操作人',
                        notes: '新建通用消耗品档案初始化建库',
                        createdAt: new Date().toISOString()
                    });
                }
            }
            this.saveSandboxData(data);
        } else {
            if (itemData.id) {
                await supabase.from('general_consumables').update(itemData, { id: itemData.id });
            } else {
                await supabase.from('general_consumables').insert([itemData]);
            }
        }
    }

    async saveTool(itemData) {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            if (itemData.id) {
                const idx = data.tools.findIndex(t => t.id === itemData.id);
                if (idx !== -1) {
                    data.tools[idx] = { ...data.tools[idx], ...itemData };
                }
            } else {
                const total = parseInt(itemData.totalQuantity, 10) || 1;
                const newItem = {
                    id: 'tool_' + Date.now(),
                    isActive: true,
                    totalQuantity: total,
                    availableQuantity: total,
                    borrowedQuantity: 0,
                    ...itemData
                };
                data.tools.push(newItem);
            }
            this.saveSandboxData(data);
        } else {
            if (itemData.id) {
                await supabase.from('reusable_tools').update(itemData, { id: itemData.id });
            } else {
                await supabase.from('reusable_tools').insert([itemData]);
            }
        }
    }

    // 停用物资 (软删除)
    async toggleItemActive(type, id, isActive) {
        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            let targetList = [];
            if (type === 'material_3d') targetList = data.materials3d;
            else if (type === 'consumable') targetList = data.consumables;
            else if (type === 'tool') targetList = data.tools;

            const item = targetList.find(i => i.id === id);
            if (item) {
                item.isActive = isActive;
                this.saveSandboxData(data);
            }
        } else {
            const tbl = type === 'material_3d' ? 'materials_3d' : (type === 'consumable' ? 'general_consumables' : 'reusable_tools');
            await supabase.from(tbl).update({ is_active: isActive }, { id });
        }
    }

    // 管理员审核与用户管理
    async auditUser(userId, newStatus, newRole = 'member') {
        if (this.currentUser?.role !== 'admin') {
            throw new Error('权限不足：只有管理员有权审核与调整用户状态');
        }

        if (this.mode === 'sandbox') {
            const data = this.getSandboxData();
            const user = data.users.find(u => u.id === userId);
            if (!user) throw new Error('用户不存在');
            user.status = newStatus;
            user.role = newRole;
            this.saveSandboxData(data);
            return user;
        } else {
            return await supabase.rpc('fn_audit_user_registration', {
                p_target_user_id: userId,
                p_status: newStatus,
                p_role: newRole,
                p_admin_id: this.currentUser?.id
            });
        }
    }
}

export const store = new Store();
