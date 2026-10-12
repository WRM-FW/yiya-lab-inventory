# 义牙实验室物资与耗材管理系统 (Yiya Lab Material Management System)

> **重要背景声明**：本项目专用于高校工程实践实验室——“**义牙实验室**”。实验室业务主要围绕**材料学研究、3D 打印加工、电子焊接与组装、学生工程竞赛及相关硬件制作活动**展开。系统严格禁止根据实验室名称推断其从事牙科、口腔医学或医疗器械相关业务。

一套专为高校工程实践实验室设计的轻量、高可靠物资与耗材管理 Web 应用。系统围绕真实实验室高频业务流程构建，解决打印线材重量管理粗放、焊锡等消耗品台账混乱、仪器工具借还缺乏闭环追踪等痛点。

---

## 🌟 核心功能特性

1. **3D 打印耗材精细化重量管理 (核心业务)**
   - 区分不同材质（PLA、PETG、ABS、TPU、PC、光敏树脂）、品牌、颜色、线径（1.75mm/2.85mm）与规格，避免不可互换材料混算。
   - 以**克（g）**为标准存储基准单位，界面智能支持克与千克双单位自由输入与展示（如 `3,250 g (3.25 kg)`）。
   - 支持新采购入库、切片/实称消耗登记、废料报损与实物盘点校准。
   - 最低剩余重量阈值告警与缺料高亮提醒。

2. **通用工程消耗品管理**
   - 覆盖焊锡丝、松香助焊剂、洗板水、阻燃热缩管、紧固件螺栓等常用耗材。
   - 强稳定计量单位约束（卷、盒、瓶、包、件等），杜绝跨单位错误算术。
   - 登记日常领用出库、采购入库、损耗处置与库存阈值监控。

3. **可重复使用工具与借还闭环**
   - 工具池化数量守恒管理（$\text{总数量} = \text{在库可用数} + \text{当前借出数}$）。
   - 烙铁、热风枪、万用表、卡尺借出登记（记录借用人、联系方式、预计归还日）。
   - 归还验收核销、可用库存自动同步累加、借还历史完整归档。

4. **不可逆审计流水与追溯**
   - 所有出入库、领用消耗、报损、盘点与工具流转操作持久化生成只读操作日志。
   - 记录操作时间、物资名称、操作类型、变动量、期初期末结存及操作人。
   - 支持一键导出标准 Excel / CSV 流水台账，满足学期末设备台账归档需求。

5. **严密 RBAC 权限与准入审核**
   - 用户注册后必须经管理员审核批准（`pending` 状态），待审核用户被严格隔离于受保护物资数据之外。
   - 审核通过后获得普通成员（`member`）权限；被拒绝或禁用的账号即刻阻断访问。
   - 数据库层面通过 PostgreSQL 触发器与行级安全策略（RLS）全面防范前端恶意提权。

---

## 🛠️ 技术路线与零成本架构

- **前端框架**：原生现代 ES 模块化架构 + 现代工程响应式 CSS（零打包构建，开箱即用）。
- **静态托管**：**GitHub Pages**（免费 CDN 加速与 HTTPS 证书，支持手机和电脑双端访问）。
- **后端与数据库**：**Supabase Free Tier**（PostgreSQL 15+、GoTrue 用户身份认证、PostgREST 接口）。
- **数据安全**：PostgreSQL 行级安全（RLS）覆盖全部业务表，原子事务存储过程（RPC）防超借与负库存。
- **运行模式**：原生支持 **“本地免配沙箱模式”**（内置完整演示种子数据）与 **“Supabase 云端模式”** 一键无缝切换。

---

## 📁 项目目录结构

```text
.
├── index.html                      # 单页应用入口 (支持 GitHub Pages 根目录直接挂载)
├── package.json                    # ESM 模块与自动化测试配置
├── README.md                       # 项目总体介绍与快速上手指南
├── src/                            # 前端核心源码 (纯原生现代化架构，零构建)
│   ├── css/
│   │   └── style.css               # 实验室专属设计系统样式表 (响应式、移动端友好)
│   ├── js/
│   │   ├── app.js                  # 路由调度与安全守卫
│   │   ├── config.js               # 运行环境与 Supabase 连接配置
│   │   ├── store.js                # 响应式状态管理与双模式数据适配器
│   │   ├── supabaseClient.js       # 原生 Fetch 版轻量 Supabase REST/Auth 客户端
│   │   ├── utils/
│   │   │   └── weightConverter.js  # 耗材重量克/千克转换与格式化工具函数
│   │   ├── components/
│   │   │   ├── navbar.js           # 顶部响应式导航栏与测试角色快速切换器
│   │   │   ├── modal.js            # 业务表单模态弹窗管理器
│   │   │   └── toast.js            # 操作反馈轻量消息通知
│   │   └── views/
│   │       ├── login.js            # 用户登录页面
│   │       ├── register.js         # 新成员注册申请页面
│   │       ├── pending.js          # 待审核状态隔离提示页
│   │       ├── overview.js         # 首页概览、低库存告警与借出看板
│   │       ├── materials3d.js      # 3D 打印耗材核心管理模块
│   │       ├── consumables.js      # 通用工程消耗品管理模块
│   │       ├── tools.js            # 可重复使用工具借还管理模块
│   │       ├── stockOps.js         # 统一出入库与消耗登记页面
│   │       ├── logs.js             # 库存操作历史与不可篡改审计流水
│   │       └── adminUsers.js       # 管理员专区 (用户审核、人员管理、基础字典)
├── supabase/                       # Supabase 数据库迁移与安全配置
│   ├── migrations/
│   │   ├── 20261012000001_init_schema.sql         # 表结构、外键与检查约束
│   │   ├── 20261012000002_inventory_rpc_functions.sql # 原子操作 RPC 存储过程
│   │   └── 20261012000003_rls_policies.sql       # 细粒度行级安全策略 (RLS)
│   ├── seed.sql                                  # 初始基础字典与示范物资数据
│   └── init_admin.sql                            # 首个管理员安全初始化脚本
├── tests/                          # 自动化测试套件
│   ├── test_weight_converter.js    # 3D 耗材重量转换与精度测试
│   ├── test_inventory_logic.js     # 出入库防超卖与幂等性测试
│   ├── test_tool_lending.js        # 工具借还状态机与数量恒等式测试
│   ├── test_rbac_security.js       # RBAC 权限与审核流转测试
│   └── run_all_tests.js            # 自动化测试启动脚本 (Node.js)
└── docs/                           # 完整技术与工程文档
    ├── 01_requirements_and_assumptions.md # 需求分析与待确认事项清单
    ├── 02_database_and_rls_design.md     # 数据库架构、实体关系与 RLS 设计
    ├── 03_deployment_and_ops_guide.md    # GitHub Pages 部署与 Supabase 运维指南
    ├── 04_user_manual.md                 # 实验室成员与管理员操作手册
    └── 05_test_and_acceptance_report.md  # 30项测试用例验收通过报告
```

---

## 🚀 快速上手与运行体验

### 1. 本地免配沙箱体验（开箱即用，无需配置云端）
在任意本地静态服务器中打开本目录即可体验：
```bash
# 启动本地开发服务 (支持 python 或任意静态服务器)
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```
- 系统默认以“本地沙箱模式”启动，内置了完整的 3D 耗材、通用耗材与工具借还数据。
- 导航栏右上角支持**一键切换测试角色**（管理员、普通成员、待审核用户），便于快速演示不同权限视角。

### 2. 执行自动化测试套件
在终端中直接运行：
```bash
node tests/run_all_tests.js
```
执行全部 30 个自动化单元与集成测试用例，覆盖重量换算、防负库存、工具守恒及防自我提权攻击。

### 3. 上线至 GitHub Pages 与 Supabase 云端
请参考详细文档：[《GitHub Pages 部署与 Supabase 运维指南》](docs/03_deployment_and_ops_guide.md)。

---

## 📖 核心文档索引
- [需求分析与待确认事项清单 (含保守默认假设)](docs/01_requirements_and_assumptions.md)
- [数据库实体、约束、原子事务与 RLS 权限设计](docs/02_database_and_rls_design.md)
- [GitHub Pages 部署、Supabase 免费套餐配置与备份运维指南](docs/03_deployment_and_ops_guide.md)
- [实验室成员与管理员使用手册](docs/04_user_manual.md)
- [测试与验收用例执行报告 (30项指标 100% 通过)](docs/05_test_and_acceptance_report.md)
