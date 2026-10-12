// ==============================================================================
// 应用主入口与路由调度中心 (Main Application Entry & Router)
// ==============================================================================

import { store } from './store.js';
import { renderNavbar } from './components/navbar.js';
import { renderLoginView } from './views/login.js';
import { renderRegisterView } from './views/register.js';
import { renderPendingView } from './views/pending.js';
import { renderOverviewView } from './views/overview.js';
import { renderMaterials3DView } from './views/materials3d.js';
import { renderConsumablesView } from './views/consumables.js';
import { renderToolsView } from './views/tools.js';
import { renderStockOpsView } from './views/stockOps.js';
import { renderLogsView } from './views/logs.js';
import { renderAdminUsersView } from './views/adminUsers.js';

class AppRouter {
    constructor() {
        this.appRoot = document.getElementById('app-root');
        this.init();
    }

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        store.subscribe(() => this.handleRoute());

        // 如果未设置 hash，默认定向
        if (!window.location.hash) {
            window.location.hash = store.currentUser ? (store.currentUser.status === 'approved' ? '#overview' : '#pending') : '#login';
        } else {
            this.handleRoute();
        }
    }

    handleRoute() {
        const fullHash = window.location.hash.slice(1) || 'overview';
        const route = fullHash.split('?')[0];
        const user = store.currentUser;

        // 1. 路由安全拦截守卫 (Route Security Guard)
        if (!user) {
            if (route !== 'login' && route !== 'register') {
                window.location.hash = '#login';
                return;
            }
        } else if (user.status === 'pending') {
            if (route !== 'pending') {
                window.location.hash = '#pending';
                return;
            }
        } else if (user.status === 'rejected' || user.status === 'disabled') {
            store.logout();
            window.location.hash = '#login';
            return;
        } else if (user.status === 'approved') {
            // 已激活用户访问登录或注册页时直接跳到概览页
            if (route === 'login' || route === 'register' || route === 'pending') {
                window.location.hash = '#overview';
                return;
            }
            // 管理员专区守卫
            if (route === 'adminUsers' && user.role !== 'admin') {
                window.location.hash = '#overview';
                return;
            }
        }

        // 2. 渲染顶部导航条
        renderNavbar(route);

        // 3. 渲染对应视图页面
        this.appRoot.innerHTML = '';
        switch (route) {
            case 'login':
                renderLoginView(this.appRoot);
                break;
            case 'register':
                renderRegisterView(this.appRoot);
                break;
            case 'pending':
                renderPendingView(this.appRoot);
                break;
            case 'overview':
                renderOverviewView(this.appRoot);
                break;
            case 'materials3d':
                renderMaterials3DView(this.appRoot);
                break;
            case 'consumables':
                renderConsumablesView(this.appRoot);
                break;
            case 'tools':
                renderToolsView(this.appRoot);
                break;
            case 'stockOps':
                renderStockOpsView(this.appRoot);
                break;
            case 'logs':
                renderLogsView(this.appRoot);
                break;
            case 'adminUsers':
                renderAdminUsersView(this.appRoot);
                break;
            default:
                renderOverviewView(this.appRoot);
                break;
        }

        window.scrollTo(0, 0);
    }
}

// 页面加载就绪时启动应用
window.addEventListener('DOMContentLoaded', () => {
    new AppRouter();
});
