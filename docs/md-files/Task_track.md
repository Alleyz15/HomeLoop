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

### 1.7 B2 估价 API 修正（2026-10-14，commit `d5056d7`）

针对 B1–B3 代码审查发现的问题，已修正并以真实资料验证（golden test 仍通过，估价数字不变）：

- [x] **参考成交月份差一个月**：`ym` 实际是 `年 + (月 - 1) / 12`（已用资料验证：`yr=2024` 的 `ym` 为 2024.0–2024.9167；最新 `ym` 2026.4167 = 2026 年 6 月，与资料范围一致）。原本 12 个月有 11 个显示早一个月，1 月只是因为下限截断才正确。例：Birai RM780,000 那笔 `ym=2023.9166667` 是 2023 年 12 月，原本显示 2023-11，现已更正。
- [x] **`/roads` 会漏掉屋型**：原本 `.limit(limit * 10)` 是按「列」截断，再分组取前 N 条路，所以一条路较少见的屋型可能被切掉（第 ① 页第 2 步因此选不到自己的屋型）。改为先排序取出要显示的路，再回查这些路的全部 catalog 列。实测 `JLN BIRAI U8/66` 现在正确显示 `2 - 2 1/2 Storey Terraced` 与 `Cluster House`。
- [x] **高楼产业回传误导性结果**：高楼成交的 `floor` 为空、`road` 是空白字串，所以根本进不了 `road_catalog`，屋主只会看到 `not_found` 或「资料不足」。新增 `unsupported_property_type` 状态与说明（需注册估价师人工估价），`not_found` 只保留给真的不存在的路或期数。

### 1.8 后端 B6 风险模拟 API

完成日期：2026-10-14

- [x] `POST /simulator/run`（受 `X-Internal-Key` 保护）：拉杆参数全部可选，预设值直接取自 `app/plans/constants.py`，没有重复写死任何数字
- [x] 压力测试方法完全照《商业模式》第 5 节：实现市价 = 估价 × 误差比 ×（1 − 跌幅）；**方案 B 补差额 = max(0, 保底比例 − 误差比 ×（1 − 跌幅）×（1 − 3.2% − 1.2%））**，即保底价对比屋主扣掉代理费与律师费后的**净收款**；**方案 A 旧屋盈亏 = 误差比 ×（1 − 跌幅）×（1 − 成本 11.5%）− 收购率 78.5%**，即 11.5% 成本是按**转售价**计算
- [x] 以线上 187 笔 `backtest_ratios`（anon key 只读、进程内缓存）重现《商业模式》第 5 节整张表：方案 A 平均 +12.3% / +7.7% / +3.2% / −5.9%，亏损单 15% / 30% / 47% / 72%；方案 B 触发 6% / 9% / 13% / 45%，平均成本 0.45% / 0.70% / 1.08% / 3.29% —— **八个数字全部吻合**
- [x] 输出 `n_cases`、方案 B（触发比例、每单平均、触发时平均、p90、最大）、方案 A（亏损比例、每单平均、平均百分比、p10）、10 格误差比直方图（供 A3 图表，格数合计 = n_cases）、使用的参数、`model_version` 与「这是基于历史回测误差的模拟、不是预测」说明
- [x] 可选 township 筛选（例：Bukit Jelutong 38 笔）
- [x] 30 项离线单元测试（纯函数以小 fixture 验证、参数越界回 422、无 key 回 401、直方图合计）＋ 9 项 integration benchmark（无环境变量时 skip），把《商业模式》的数字钉成验收契约
- [x] `apps/web/src/lib/valuation.ts` 新增 server-only `simulate()` 与完整型别

**金额基准（重要，给 A3 前端）：** 文件第 5 节的原生结果是**占估价的百分比**，RM3,500 / RM26,000 是把百分比套在文件示例的 RM786,000 估价上得出的，不是 187 笔的 RM 平均。所以回传三种基准：`avg_topup_pct_of_valuation`（原生，完全吻合文件）、`avg_topup_per_deal`（按 `reference_valuation_rm` 换算，预设 786,000，得 RM3,549 / RM25,863，与文件差 1.4% / 0.5%）、`avg_topup_per_deal_sample_weighted`（按每笔自己的估价平均，得 RM7,354 / RM36,953 —— 因为 187 笔的平均估价是 RM944,511，远高于 786,000）。A3 页面要显示百分比，或显示 RM 时必须标明用的是哪个估价。

---

## 2. 待做：后端

按顺序做。每一项都以《HomeLoop_更新_页面与流程.md》为准，括号内是对应章节。

### B1. 数据库（新 migration）

- [x] 2026-10-14 已确认线上 `backtest_ratios` 有 187 笔、`sdp_launches` 有 35 笔（本机 CSV 在 `data/homeloop_data/`，不是 README 写的 `data/processed/homeloop_data/`）
- [ ] 用户运行 `scripts/create_demo_users.py`，建立 1 个屋主与 1 个 admin demo 账号

### B2. 估价 API 部署（用户操作）

- [x] 2026-10-14 已部署到 Render：`https://homeloop-valuation.onrender.com`，线上 `/health`、`/roads`、`/valuate` 均已用真实资料验证通过（免费方案冷启动约 22 秒）
- [ ] 在 Vercel 设置 server-only `VALUATION_API_URL` 与 `VALUATION_INTERNAL_KEY`；F4 串接时启用（本机 `apps/web/.env.local` 已设好）
- [ ] 上述 B2 修正需重新部署 Render 才会生效

### B5. AI

- [ ] 估价白话解说（LLM；数字只能从估价结果带入）（原则 14）
- [ ] Admin 辅助：一段话总结申请、找出对不上的地方（例如填的面积跟这条路的常见面积差很多）、起草给屋主的讯息
- [ ] AI 只辅助，不自动批准

### B6. 风险模拟 API

- [x] 2026-10-14 完成，见 1.8。输入：保底比例、方案 A 缓冲、成本、代理费/律师费、房价下跌幅度、township；输出：需补差额或会亏损的比例、每单平均成本、每单平均盈利、直方图（用 `backtest_ratios`）

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
| **估价对地段面积不单调（未修）** | 估价 = 可比成交「每平方米建筑面积」中位数 × 建筑面积，地段面积只影响选哪 10 笔，不影响换算。实测 Bukit Jelutong（建筑固定 190 m²）：地段 430 m² → RM1,420,880，但 480 m² → RM1,348,384，**地段更大反而少 RM72,496**；140–700 m² 范围内有 10 处下跌，最大一处在 180→190 m²（−RM84,329），正好落在最常见的地段大小附近。测过三种改法：加「有效面积」权重只能把下跌从 10 处降到 4 处；加距离上限完全无效；只有改成核权重平滑估计才能完全消除（0 处下跌），但中间值会变成 RM821,651（偏离文件的 RM786,000 约 4.5%），**会让 golden test 失败，也会使 deck 里「误差中位数 10.1%」的回测结论失效**。属模型设计问题，要改必须重跑回测，需团队决定 |
| 高楼产业（41% 的成交）无法估价 | `Condominium/Apartment` 33,324 笔、`Flat` 6,548、`Low-Cost Flat` 8,276、`Town House` 1,601 共 49,749 笔的 `floor` 为空（单位面积放在 `land` 和 `area`），且 `road` 是空白字串，所以 `road_catalog` 里一笔都没有。方案 B 原本开放给 7 个县任何发展商的房子（含高楼）。要支持需：新 migration 把空白路名的成交纳入期数层级目录 + 改用 `area_sqm` 当面积基准。目前已改为明确告知不支持（见 1.7），属范围决定 |
| 方案 A/B 报价公式有两处来源 | `private.application_offer` 写死 `0.785` / `0.75`，`services/valuation/app/plans/constants.py` 则由 11.5% + 10% / 75% 推导。目前两边一致（RM786,000 都得出 617,010 / 589,500），但改任何一个比率都要同时改 Python **和新增一个 migration**（规则 4 不准改已套用的 migration） |
| `net_at_floor` 对保底买下也扣 3.2% 代理费 | `plans/calc.py` 的 `net_at_floor` = 保底价 × 0.956 = RM563,562，但《商业模式》第 0.2、4 节把 RM589,500 当成屋主实拿。保底触发时是 SDP 直接买下、没有代理，需产品决定是不扣费还是改栏位名称 |
| `create_demo_users.py` 可能静默失效 | 第 41 行 `.update({"role": role}).eq("id", user.id)` 没有检查回传列数，无论是否更新成功都印出 `role=admin`。若 profile 列不存在，admin demo 帐号会留在 `owner`，整个 admin 面板进不去，而脚本却显示成功。建议加上回传检查 |
| 每月额度按 UTC 月份计算 | `monthly_limit_usage` 与 `issue_offer` 的 `date_trunc('month', ...)` 用 session 时区（Supabase 预设 UTC）。马来西亚时间 11 月 1 日 02:00 发出的报价会算进 10 月。两处一致，所以不会重复计算，只是月份归属不对 |
| `monthly_limits` 只种子到 2026-12 | `check_monthly_limit` 找不到当月列时会直接报错（fail closed，行为正确）。2027-01 起所有报价都会失败，长期使用前要补列 |
| `backtest_ratios` 部分导入后无法重试 | `requires_empty=True`，187 笔导入中途失败后必须先手动 truncate 才能重跑；README 只说明了 `transactions` 需要 truncate |
| 风险模拟的 RM 金额要标明估价基准 | 《商业模式》第 5 节算的是**占估价的百分比**；RM3,500 / RM26,000 是套在示例的 RM786,000 上。187 笔的平均估价是 RM944,511，所以按每笔自己估价平均会得到 RM7,354 / RM36,953。`/simulator/run` 三种基准都回传，A3 优先显示百分比 |
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
