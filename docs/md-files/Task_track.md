# HomeLoop Task Track

最后更新：2026-10-14｜截止：**10/23 23:59**

本文件记录整个系统的任务进度，分为**后端**与**前端**两部分。

> **给 AI 编程助手（Codex / Claude）的规则**
> 1. 开始任何任务前，先读本文件和 `docs/md-files/` 里的其他文件。产品规则以《HomeLoop_更新_页面与流程.md》为准。
> 2. 完成一个任务后，把它从「待做」移到「已完成」，写上日期、commit 和一句说明。
> 3. 发现新问题或新任务，加进「待做」或「已知问题」，不要直接删掉别人的项目。
> 4. 不要改已经推送到 Supabase 的 migration；改表结构一律新增 migration。
> 5. 不要把任何 key、密码、`.env`、CSV 或原始数据写进 git。

**参考文件（同一个文件夹）：**

| 文件 | 内容 |
|---|---|
| `HomeLoop_方案详述.md` | 主方案：问题、数据、回测、公平模拟、法规 |
| `HomeLoop_更新_页面与流程.md` | **开发依据**：页面、流程、申请状态、决定规则、Dashboard |
| `HomeLoop_更新_政策检查.md` | 最新政策：印花税、RPGT、e-SPA/HIMS、PDPA |
| `HomeLoop_更新_市场调研.md` | 马来西亚与全球的类似服务 |
| `HomeLoop_更新_商业模式.md` | 两个方案的详细计算、每单经济账、压力测试 |
| `HomeLoop_更新_新屋项目.md` | SDP 在售新屋项目整理；数据在 `data/processed/homeloop_data/sdp_launches.csv`（不进 git） |

---

## 1. 已完成

### 1.1 方案与调研

| 日期 | 项目 |
|---|---|
| 10/12 | 确定方向：HomeLoop（换屋服务，方案 A 直接收购、方案 B 保底价） |
| 10/12 | NAPIC 数据：7 个县 120,191 笔成交（2021–2026/6）；MHPI；成本假设 |
| 10/12 | 回测：KNN 估价误差中位数 10.1%（SDP township 9.1%）；公平模拟与压力测试 |
| 10/13 | 商业模式深度研究、市场调研、政策检查 |
| 10/14 | 页面与流程定案（11 页：屋主 8 页、admin 3 页） |
| 10/14 | 整理 SDP 在售新屋项目 35 个（`sdp_launches.csv`：在售 16、待确认 3、建造中 9、即将推出 7） |

### 1.2 基础设施

| 日期 | 项目 | 备注 |
|---|---|---|
| 10/13 | GitHub repo `Alleyz15/HomeLoop`（monorepo） | commit `03e0580` |
| 10/13 | Supabase 项目 `qcuzvdkrqzxogigsxisk`（新加坡） | RLS 自动开启；新表不自动开放 |
| 10/13 | Migration `0001_init.sql`：8 张表 + RLS + 注册时自动建 profile | 远端已通过 `migration repair` 对齐 |
| 10/13 | Migration `20261013100322_grant_privileges.sql` | 补上 service_role 与前端角色的权限 |
| 10/13 | Migration `20261013100711_fix_mhpi_pk.sql` | MHPI 主键改为 (source_table, series, quarter) |
| 10/13 | 数据导入：transactions 120,191、mhpi_quarterly 3,500、fairness_curve 72、sdp_schemes 48、backtest_results 24、cost_assumptions 6 | `scripts/import_csv.py`；导入器有重复主键检查与测试，commit `810f417` |
| 10/13 | Next.js 15 骨架：7 个占位页面、Supabase SSR client、middleware 保护 `/dashboard` | |
| 10/13 | FastAPI 骨架：`/health`、`/valuate`（回 501） | |
| 10/13 | Next.js 升级到最新 15.x 补丁版；`scripts/check_supabase_read.mjs` | commit `87de5e6` |
| 10/13 | Vercel 部署：https://home-loop-coral.vercel.app（root `apps/web`） | |
| 10/13 | Supabase Auth URL Configuration：Site URL 与 Redirect URLs（Vercel、localhost） | |
| 10/14 | 4 份方案文件上传到 `docs/md-files/` | commit `9d303f6` |

### 1.3 后端 B1 数据库

完成日期：2026-10-14｜commit `2212c8e`

- [x] `profiles.role`（`owner` / `admin`）与防止屋主自行升为 admin；`private.is_admin()` 和 admin RLS
- [x] `road_catalog` materialized view：路名正规化、常见面积、占比、成交数、近 3 年成交数与搜索索引
- [x] `sdp_launches` 表与导入器规格（资料由用户另行导入）
- [x] `valuation_requests` 增加路名、单位类型、可信度与照片路径
- [x] `applications` 表、状态与申请资料约束、owner/admin RLS
- [x] `application_events` append-only 记录与 RLS
- [x] `monthly_limits`、2026-10 至 2026-12 种子资料与 `monthly_limit_usage`
- [x] `backtest_ratios` 表与导入器规格（资料由用户另行导入）
- [x] 私有 Storage bucket `photos` 与本人目录/admin 读取政策
- [x] `scripts/create_demo_users.py`（账号由用户另行建立；脚本不输出密码或 key）
- [x] `scripts/import_csv.py --only`、预检查与测试；Supabase migrations 已推送并通过 RLS/权限验证

### 1.4 后端 B2 估价 API

完成日期：2026-10-14｜commits `53e987b`–`7d020a6`

- [x] `/health` 无 Supabase 调用；client 改为首次资料请求才建立，解决原本 health 测试卡住
- [x] `/roads` 路名正规化与公开目录搜索；同一路名跨期数时要求带回所选 scheme，避免用错可比成交
- [x] `/valuate` KNN：同期数 + 同屋型 + 排除首卖，log 面积距离、每年 0.02 时间惩罚、最近 10 笔
- [x] 中位数估价、25 / 75 百分位区间、可信度门槛与近 3 年少于 10 笔的资料不足规则
- [x] 中间单位从 `road_catalog` 自动带入常见面积；回传 10 笔成交、Act 242 免责声明与非 SDP 的 Plan B 提示
- [x] `X-Internal-Key` 恒定时间验证；估价服务只用 anon key 只读资料；关闭 CORS 与公开 API 文档路由
- [x] 离线单元测试与 Bukit Jelutong golden integration test；只读核对为 RM785,635、RM742,127–877,738
- [x] Render Docker 启动与部署说明；实际 Render / Vercel 环境设定由用户完成

### 1.5 后端 B3 方案计算

完成日期：2026-10-14｜commits `3d13e61`、`85a5e48`、`83caf6a`

- [x] 方案 A 收购价 = 估价 ×（1 − 11.5% − 10%）；只限 SDP township、旧屋估价不高于新屋价格
- [x] 方案 B 保底价 = 估价 × 75%；预计拿到 = 市价 ×（1 − 3.2% − 1.2%），并列出预计净额区间与保底价净额
- [x] AI 低/高区间分别套用同一公式，所有金额四舍五入到 RM 整数
- [x] 换屋计划书资料：两方案时间线、10% 订金与互抵假设、订金缺口、3% RPGT 扣留款、60/90 天提醒、租赁地契另加 1–3 个月
- [x] `POST /plans/quote`：只读 anon 查询在售 `sdp_launches`，销售报价优先于官网起价，受 `X-Internal-Key` 保护
- [x] 公式、资格规则、价格来源、leasehold 与安全测试；Next.js helper 改为 server-only，并与 B2/B3 schema 对齐

### 1.6 后端 B4 申请流程 API

完成日期：2026-10-14｜commits `3ed7275`、`4a77305`、`dc9316e`、`f772eaf`

- [x] 提交时执行第 1 关资格、必填资料与 PDPA 检查；每位屋主同一时间只允许一份活跃申请
- [x] PostgreSQL SECURITY DEFINER RPC 状态机：锁定申请、验证调用者与合法转换，并在同一交易写入一笔 `application_events`
- [x] Admin 操作：开始审核、要求补件、初步范围、拒绝、安排/记录上门、发正式报价、回应复核及接受后追踪
- [x] 屋主操作：补件、继续/撤回、接受/换方案/拒绝/要求一次复核及标记 e-SPA 已签
- [x] 正式报价由数据库按确认市值重算；14 天到期采用 lazy expiry，方案切换与发报价均检查月度额度
- [x] Admin flags：正式估价低于 AI low 超过 10%、AI 低可信度、月度额度达到 80%
- [x] server-only Next.js RPC helpers、pgTAP 状态机测试；本地重建后 56 项测试通过

已确定的状态机决定：

- 补件可以从 `under_review` 或 `inspected` 发起；`info_return_status` 记录来源，屋主补件后回到原关卡并清空该字段。
- 正式报价阶段每份申请只可换方案一次（`plan_switch_count`，与一次复核分开计算）：B → A 重新检查方案 A 资格、清空报价并回到 `inspection_scheduled` 等注册估价师；A → B 用已确认市价重新计算 75% 保底、检查额度并发出新的 14 天报价。
- 屋主从 `accepted` 标记 e-SPA 已签后进入 `espa_signed`；admin 以 `espa_confirmed_at` / `espa_confirmed_by` 确认，不新增状态。所有挂牌及之后的追踪动作必须等 admin 确认。

---

## 2. 待做：后端

按顺序做。每一项都以《HomeLoop_更新_页面与流程.md》为准，括号内是对应章节。

### B1. 数据库（新 migration）

- [ ] 用户运行 `scripts/import_csv.py --only sdp_launches.csv,backtest_ratios.csv`；预期分别为 35 / 187 笔
- [ ] 用户运行 `scripts/create_demo_users.py`，建立 1 个屋主与 1 个 admin demo 账号

### B2. 估价 API 部署（用户操作）

- [ ] 按 `services/valuation/README.md` 部署到 Render，并确认线上 `/health`
- [ ] 在 Vercel 设置 server-only `VALUATION_API_URL` 与 `VALUATION_INTERNAL_KEY`；F4 串接时启用

### B5. AI

- [ ] 估价白话解说（LLM；数字只能从估价结果带入）（原则 14）
- [ ] Admin 辅助：一段话总结申请、找出对不上的地方（例如填的面积跟这条路的常见面积差很多）、起草给屋主的讯息
- [ ] AI 只辅助，不自动批准

### B6. 风险模拟 API

- [ ] 输入：保底比例、方案 A 缓冲、成本、房价下跌幅度；输出：需补差额或会亏损的比例、每单平均成本、每单平均盈利（用 `backtest_ratios`）

---

## 3. 待做：前端

按用户流程排序。每一页都以《HomeLoop_更新_页面与流程.md》为准，括号内是对应章节。界面全英文。

### F1. 共用

- [ ] 版面：顶部导航（屋主 / admin 显示不同选单）、底部免责声明（Act 242）
- [ ] 登录 / 注册（邮箱 + 密码）；登录后按角色导向 Dashboard 或 admin 面板
- [ ] 未登录访问受保护页面时导向 `/login`

### F2. 屋主端

- [ ] Welcome 页（`/`）：先做普通版（标题、一句话介绍、按钮），正式设计之后再定
- [ ] Dashboard（`/dashboard`）：8 格进度条 + 依状态变化的简略卡片 → 点进去看详细页；方案 B 显示挂牌子进度（第 5.6 节）
- [ ] ① 估价输入（`/valuation`）：路名搜索（自动带出期数与是否 SDP）→ 屋型 → 单位类型（中间单位自动带入面积）→ 地契 → 照片上传（可选）；m² / sq ft 切换；找不到路名时改用期数搜索（第 4 节）
- [ ] ② 估价结果（`/valuation/result/[id]`）：区间与中间值、可信度、10 笔参考成交表、AI 白话解说、免责声明；资料不足时显示提示；非 SDP 旧屋提示只适用方案 B
- [ ] ③ 选新屋（`/new-home`）：在售项目卡片 + 「即将推出」分页（登记兴趣）→ 项目详情 → 选户型 → 价格默认起价、可填销售报价 → 显示差额与价格来源（第 5.1、5.3 节）
- [ ] ④ 选方案（`/plans`）：方案 A / B 两张卡片 + 引导问题（能否先付 10% 订金）→ 详细计算 → 确认；不符合资格时方案 A 变灰并说明原因（第 5.3 节）
- [ ] ⑤ 换屋计划书 + 提交申请（`/apply`，同一页）：时间线、资金进出、订金缺口提醒、要准备的东西、RPGT 提醒；下半部填门牌、地契号码（可选）、PDPA 同意（第 5.3、5.4 节）
- [ ] 报价相关操作：初步报价「继续 / 不用了」；正式报价「接受 / 换方案 / 拒绝 / 要求复核」与 14 天倒数；接受后「我已签约」（第 5.5 节）

### F3. Admin 端

- [ ] A1 申请面板（`/admin`）：顶部每月额度用量条；分页（新申请｜等屋主回复｜待上门｜待出正式报价｜已发报价｜完成或关闭）；简略列表 + 标记 + 筛选（第 5.2 节）
- [ ] A2 申请详情（`/admin/applications/[id]`）：完整资料、AI 估价与参考成交、照片、AI 辅助摘要、操作记录；按当前关卡显示操作按钮与表单（看屋结果、调整原因、公式算出的报价预览）（第 5.5 节）
- [ ] A3 风险模拟（`/admin/simulator`）：拉杆与即时结果

### F4. 串接与收尾

- [ ] 所有页面串接后端 API（B2–B6）
- [ ] 载入中、错误、空资料的画面
- [ ] 电脑为主、手机可正常浏览
- [ ] 部署到 Vercel 并用 demo 账号走完整个流程（《页面与流程》第 7 节 demo 剧本）

---

## 4. 已知问题与注意事项

| 问题 | 说明 |
|---|---|
| 部分网络的路由器 DNS 查不到 `*.supabase.co` | 改用 1.1.1.1 / 8.8.8.8，或在 hosts 文件加 `104.18.38.10 qcuzvdkrqzxogigsxisk.supabase.co`（Supabase IP 改变时要更新） |
| `transactions` 只能导入一次 | 重新导入前要先 `truncate` 6 张参考表（见 README） |
| 大部分新屋项目只公布起价 | 第 ③ 步用起价，允许用户填销售报价 |
| 所有 CSV 被 `.gitignore` 排除 | 数据放 `data/processed/`，用脚本导入 |
| `road_catalog` 的 Birai 验收笔数与任务文字不同 | 按指定的 trim/JLN 正规化后，`JLN BIRAI U8/69` 有 13 笔（其中 1 笔原始路名有前导空格）；常见地段 178 m²、建筑 190 m² 均符合预期 |
| 相同 `road_norm` + 屋型可能横跨多个 scheme | `/roads` 会回传 scheme；这种情况调用 `/valuate` 时必须同时带入所选 scheme，否则回 422，避免使用错误期数的成交 |
| 估价与方案 API 只能由服务器调用 | `apps/web/src/lib/valuation.ts` 已加 `server-only`；F4 必须从 Server Component、Server Action 或 route handler 调用，绝不能从 client component 调用或把内部 key 改成 `NEXT_PUBLIC_` |
| B4 提交时的 valuation / plan snapshot 可由恶意屋主伪造 | `submit_application` 从 Next.js server 接收 snapshot，因此这些数值只作初步参考；admin 会在上门检查时重新核实，正式报价始终由数据库根据 `confirmed_value` 按固定公式重算，不信任客户端报价金额 |

## 5. 已确定的关键数字（不要随意改）

| 项目 | 数值 | 来源 |
|---|---|---|
| 方案 A 成本 | 11.5% | 方案详述第 7.1 节 |
| 方案 A 风险缓冲 | 10% | 第 7.2 节 |
| 方案 B 保底 | 估价的 75% | 第 7.3 节 |
| 卖方代理费 / 律师费 | 3.2% / 1.2% | 成本假设 |
| 报价有效期 | 14 天 | 页面与流程第 5.5 节 |
| 复核次数 | 1 次 | 第 5.5 节 |
| 估价资料不足门槛 | 近 3 年少于 10 笔 | 第 4 节 |
| 每月额度（假设） | 方案 A RM500 万、方案 B RM2,000 万 | 原则 12 |
