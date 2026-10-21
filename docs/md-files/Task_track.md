# HomeLoop Task Track

最后更新：2026-10-21｜截止：**10/23 23:59**

本文件记录整个系统的任务进度，分为**后端**与**前端**两部分。

前端每阶段与每项操作的变更、受影响文件、bug、验证结果及 commit 记录见 [Frontend_Implementation_Log.md](Frontend_Implementation_Log.md)。后续前端实现或修复需同步更新该文件。

2026-10-21 全仓代码审查分两轮：
- 第一轮 [Code_Review_2026-10-21.md](Code_Review_2026-10-21.md)：**✅ 已全部修复并复验**（`main` `f06f071`），七项（正式报价无法发出、方案 B 卡在 `under_review`、复核无 admin 回应、A3 缺页、数字 guard 漏字母写法、标记规则重复、B→A 重新预约）保留为纪录，不需再处理。
- 第二轮 [Code_Review_2026-10-21_Round2.md](Code_Review_2026-10-21_Round2.md)：**✅ 2026-10-21 已在 `QY` commit `9afd563` 完成处置并复验（frontend deploy 待办）**。第 1、3–8 项已修；第 2 项依既定 deadline 决策不改估价模型，以结果页明确披露限制并保留注册估价师复核。新 `reschedule_inspection` migration 已于同日获确认并应用远端，migration list 对齐且 linked lint 无错误。

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
- [x] `monthly_limits`、2026-10 至 2027-06 种子资料与 `monthly_limit_usage`
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
- [x] 方案 B 保底价 = 估价 × 75%；公开市场预计拿到 = 市价 ×（1 − 3.2% − 1.2%），并列出预计净额区间；触发保底时由 SDP 直接买下，`net_at_floor` 等于保底价、不扣代理费
- [x] AI 低/高区间分别套用同一公式，所有金额四舍五入到 RM 整数
- [x] 换屋计划书资料：两方案时间线、10% 订金与互抵假设、订金缺口、3% RPGT 扣留款、60/90 天提醒、租赁地契另加 1–3 个月
- [x] `POST /plans/quote`：只读 anon 查询在售 `sdp_launches`，销售报价优先于官网起价，受 `X-Internal-Key` 保护
- [x] 公式、资格规则、价格来源、leasehold 与安全测试；Next.js helper 改为 server-only，并与 B2/B3 schema 对齐

### 1.6 后端 B4 申请流程 API

完成日期：2026-10-14｜commits `3ed7275`、`4a77305`、`dc9316e`、`f772eaf`

人工估价路径补充：2026-10-17｜commits `83f88e3`、`2014084`

正式报价与 Plan B 初步金额补强：2026-10-21｜commits `3e24a34`、`5ea6195`（migration 尚待 hosted push）

- [x] 提交时执行第 1 关资格、必填资料与 PDPA 检查；每位屋主同一时间只允许一份活跃申请
- [x] PostgreSQL SECURITY DEFINER RPC 状态机：锁定申请、验证调用者与合法转换，并在同一交易写入一笔 `application_events`
- [x] Admin 操作：开始审核、要求补件、初步范围、拒绝、安排/记录上门、发正式报价、回应复核及接受后追踪
- [x] 屋主操作：补件、继续/撤回、接受/换方案/拒绝/要求一次复核及标记 e-SPA 已签
- [x] 正式报价由数据库按确认市值重算；14 天到期采用 lazy expiry，方案切换与发报价均检查月度额度
- [x] Admin flags：正式估价低于 AI low 超过 10%、AI 低可信度、月度额度达到 80%
- [x] server-only Next.js RPC helpers、pgTAP 状态机测试；本地重建后 56 项测试通过
- [x] `valuation_requests.valuation_status` 保存 `ok / insufficient_data / not_found / unsupported_property_type`；旧资料保守回填。只有经保存记录及 `road_catalog` 近 3 年少于 10 笔双重验证的 `insufficient_data` 可进入人工估价，另外两种失败状态不可送申请
- [x] 人工估价状态 `manual_valuation_pending`：admin `request_manual_valuation` 后，屋主必须明确执行 `proceed_manual_valuation` 才能安排上门；也可从该状态撤回。人工路径在上门前没有 indicative RM 区间，也没有 admin 桌面估价步骤
- [x] 人工 `record_inspection` 必须有正数 `confirmed_value`，并在 note 写注册估价师与估价依据；不使用 AI adjustment reason，同时记录 `manual_valuation_resolved_at / by`
- [x] 方案 A 的 SDP township 与「确认市值不高于新屋价格」规则在 `issue_offer`、`respond_review`、`switch_plan` 再检查。人工估价后若方案 A 不合格，屋主可在正式报价前改方案 B，且不消耗一次正式 `plan_switch_count`
- [x] `admin_application_flags` 增加 `manual_valuation_required`；新 RPC 维持 SECURITY DEFINER、空 search path、owner/admin 检查、`FOR UPDATE`、每动作一笔 event、只授权 authenticated。全新本地 reset 后 pgTAP 94 项通过，schema lint 无警告
- [x] Admin 记录注册估价结果时可输入正数确认市值；落在保存的 AI low/high（含边界）内不需额外说明，超出范围必须写给屋主看的原因。人工估价没有 AI 区间，仍须写注册估价师与估价依据。正式 offer 不能手填，数据库继续按方案 A 78.5% / 方案 B 75% 重算
- [x] 新增只读 `preview_application_offer` 与带 revision/amount 的 `issue_offer_from_preview`、`respond_review_from_preview`：Admin 必须 Preview → Confirm；finalize 会锁行、检查 stale revision、方案 A 资格、MYT 月度额度及 14 天期限，再写一笔 event。旧的一步式 `issue_offer` / `respond_review` 已从 API roles 撤权
- [x] Plan B `send_indicative` 在数据库内锁行并核对申请保存的 quote、原新屋价格、eligible、whole-RM expected proceeds low/high、独立 75% floor 及 versioned receipt；不能透过直接 RPC 发送浏览器自订数字。Owner 仍只看已发送预计净收入区间与独立保底，不读取 private audit payload
- [x] 本地 Docker 从零 reset 后 pgTAP **178 项**及 schema lint 通过；Web Node **112 项**、TypeScript、lint（0 errors）与 production build 通过。真实本地 Owner/Admin/Auth/Storage/浏览器流程已覆盖补件、Plan B 初步金额、继续、上门、正式报价、一次复核、一次切换、过期保护与资料清理

申请补件照片与讯息隐私扩展：2026-10-20｜后端 commit `fe21d07`；用户批准后已套用 hosted Supabase migration `20261019191115`

- [x] 新增 migration `20261019191115_application_photos_and_message_privacy.sql`：独立私有 `application-photos` bucket、照片 reservation / cancel / submit RPC；仅 JPEG / PNG / WebP，每张最多 5 MiB，每次补件或复核最多 5 张。原 `photos` bucket、估价公式与既有流程 RPC 签名不变。
- [x] 发现并修复隐私缺口：原 event 的 RLS 只隔离不同申请，未阻止屋主直接通过 API 查询本人申请的内部 `note / payload`。现以 column grants 限制，admin 透过受保护的 `get_application_audit()` 读取；明确给屋主看的文字使用 `owner_message` / `send_owner_message()`，不会把旧 admin note 自动公开。
- [x] 照片绑定申请、当前补件/正式报价 event 与提交 event；必须本人上传、真实 Storage object 与 metadata 相符；错误、过期、跨用户与重复提交拒绝。提交后正常 session 不可覆盖或删除证据。补件及复核仍调用原状态机，维持每动作一笔 event 和一次复核限制。
- [x] 新增 server-only helpers 与验证规则：`apps/web/src/lib/application-photos.ts`、`application-photo-policy.ts`。这是后端接口支援，未修改或新增 frontend 页面。
- [x] 全新本地 reset 后 pgTAP **151 项**、Node **73 项**与 TypeScript 通过；真实本地 Auth / Storage 上传、下载、补件、Plan B 复核及权限测试通过，测试资料已清理。schema lint 无错误；保留原有公开参考目录 `road_catalog` advisor 提示，未修改不相关目录权限。
- [x] 2026-10-20 用户明确批准后，仅套用既有 photo/privacy migration 到 hosted Supabase `qcuzvdkrqzxogigsxisk`；history 对齐原版本 `20261019191115`，没有重复 migration。验证新表/字段/私有 bucket/五个 RPC、RLS/column grants、无身份拒绝及 owner-scoped 只读查询通过；原报价函数 hash、既有记录数量和 valuation `photos` bucket 配置不变。只更新部署记录，未改应用代码、原 migration 文件、公式、Render、Vercel、环境变量或 secrets；没有新增自动清理排程。此项为数据库部署，不代表 frontend 已上线或用户 session 浏览器验收完成。

逐项变更、受影响文件、API 使用方式、测试及本地 Docker Auth health-check 注意事项见 [backend-application-photos.md](../backend-application-photos.md)。此扩展的 Application Details frontend 尚未开始，不记为前端已完成。

已确定的状态机决定：

- 补件可以从 `under_review` 或 `inspected` 发起；`info_return_status` 记录来源，屋主补件后回到原关卡并清空该字段。
- 正式报价阶段每份申请只可换方案一次（`plan_switch_count`，与一次复核分开计算）：B → A 重新检查方案 A 资格、清空报价并回到 `inspection_scheduled` 等注册估价师；A → B 用已确认市价重新计算 75% 保底、检查额度并发出新的 14 天报价。
- 屋主从 `accepted` 标记 e-SPA 已签后进入 `espa_signed`；admin 以 `espa_confirmed_at` / `espa_confirmed_by` 确认，不新增状态。所有挂牌及之后的追踪动作必须等 admin 确认。
- `insufficient_data` 不制造临时价格：屋主选择方案时只看结构/公式；方案 A 仅先检查 SDP township，金额资格等注册估价师确认市值后才决定。`not_found` 与 `unsupported_property_type` 不可沿用此路径。
- 人工路径的正式转换为 `submitted → under_review → manual_valuation_pending → owner_proceed → inspection_scheduled → inspected → offer_sent`；其中 `manual_valuation_pending → withdrawn` 也是合法结束。
- 注册估价确认值在保存 AI 区间内可直接记录；超出区间必须提供屋主可见解释。Admin 提供证据与说明，正式 offer 由数据库计算，接受、拒绝、一次复核及一次方案切换仍由屋主决定。
- Plan B Stage 3 的 `indicative_low/high` 代表扣除假设销售费用后的预计公开市场净收入；75% guarantee floor 独立展示，不混入该区间。发送金额必须精确匹配申请提交时保存的后台 quote。
- 正式报价采用两步式 Preview → Confirm，并以数据库生成的 case revision 防止预览后申请、估值、事件、月份或报价基础改变。

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

### 1.9 前端 F1 共用版面与登入

完成日期：2026-10-15

- [x] `src/lib/auth.ts`：server-only `getSessionUser()`，角色一律从 `profiles.role` 读（JWT 不带角色），读不到或不认识的值一律降级为 `owner`
- [x] `src/app/auth/actions.ts`：`signIn` / `register` / `signOut` Server Actions。登入失败只回「details do not match an account」，不说是哪个栏位错；`?next=` 只接受站内相对路径，避免被导去外部网站
- [x] `src/app/auth/state.ts`：表单状态单独放一个档，因为 `"use server"` 的档案只能 export async function（build 会直接失败）
- [x] `src/app/login/`：Sign in / Create account 两个分页、`useActionState` 处理错误与提示；注册要求至少 8 码；邮件验证关闭时直接发 session，若专案开着验证则显示「去信箱确认」
- [x] `src/middleware.ts`：受保护前缀改为整条屋主流程 + `/admin`，并带上 `?next=`。中介层只检查有没有登入，**不查资料库**；角色检查放在 `/admin/layout.tsx`（每次请求从资料库读角色，屋主猜 URL 会被送回 `/dashboard`）
- [x] `src/app/layout.tsx`：导航按角色切换、显示邮箱与登出；Act 242 免责声明原文保持不变
- [x] `npm run build` 通过（11 条路由）、`tsc --noEmit` 与 `eslint` 乾净
- [x] 实机验证（本机 dev + 线上 Supabase）：7 条受保护路由全部 307 导向 `/login?next=…`；`/`、`/login`、`/guide` 保持 200；未登入的导航只有 `HomeLoop｜Home｜Sign in`，没有漏出屋主或 admin 选单

### 1.10 前端 F2（第一段）：Welcome、估价输入、估价结果

完成日期：2026-10-15

- [x] `src/lib/valuations.ts`：server-only `saveValuation()` / `getValuation()` / `getRoadMeta()`。**补上了之前缺的一环**：原本没有任何程式写入 `valuation_requests`，而 B4 的 `submit_application` 需要一个真实的 `p_valuation_id`，现在估价完成就会存一笔并取得 id
- [x] 估不出价（资料不足）的请求也会存，金额留 null，屋主仍有纪录、之后也能据此送申请
- [x] 2026-10-17 保存估价 API 的准确 `valuation_status`；结果页仅 `insufficient_data` 显示可继续申请说明，`not_found / unsupported_property_type` 不显示申请入口。新屋及方案页可继续人工估价路径，只显示方案结构与公式、不显示 RM 金额；非 SDP 的方案 A 停用，SDP 的方案 A 标示「Eligibility confirmed after valuation」（commit `2014084`）
- [x] `src/lib/units.ts`：m² ↔ sq ft 换算、排屋尺寸快捷、RM 格式化
- [x] `src/app/valuation/actions.ts`：`findRoads`（走 B2 `/roads`）与 `createValuation`（走 B2 `/valuate` → 存档 → 导向结果页），全部 server action，内部 key 不会进浏览器
- [x] `is_sdp` / `district` / `tenure_mode` 直接读 `road_catalog`（authenticated 有 select 权限），**不新增 migration**；`valuation_requests` 没有 `is_sdp` 栏位，这样就不用改表
- [x] `npm run build`（11 条路由）、`tsc --noEmit`、`eslint` 全部乾净
- [x] 静态核对过 insert 的 13 个栏位都存在，且 `unit_position` / `confidence` 的 CHECK 约束与送出的值相符
- [x] 2026-10-15（待 commit）修正方案报价舍入顺序：`quotePlans()` 在发送前将 `estimate` / `low` / `high` 用 `Math.round()` 转成整数 RM，后端再计算并舍入报价；原始估价保留小数。RM785,635.36 对应方案 A RM616,723、方案 B RM589,226；回归测试见 `scripts/quote_plans.test.mjs`。

**未验证**：demo 帐号已建立，但整条「搜路名 → 估价 → 存档 → 结果页」尚未用真实 session 跑过。Render 的 `/roads` 与 `/valuate` 已单独验证可用。

---

### 1.11 后端本机运行验证（2026-10-15）

- 环境：建立 gitignored `services/valuation/.venv`，使用本机 Python 3.13 安装 `requirements-dev.txt` 中的固定版本依赖；`pip check` 通过。README 建议 Python 3.11，本次未验证 3.11。
- 配置：`services/valuation/.env` 必需值均存在且可由 Settings 加载；未输出 key。未改动环境文件或业务代码。
- 离线测试：在 repo root 使用 `.venv` 的 Python 执行 `-m pytest -q -m 'not integration' --tb=short`，**165 passed，10 deselected**。
- 真实 Supabase 集成测试：从 Settings 将 URL/anon key 载入测试进程，执行 `tests/test_golden.py`、`tests/test_simulator_golden.py` 的 integration tests，**10 passed**。
- 启动：在 `services/valuation` 执行 `.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`，成功启动；本机地址 `http://127.0.0.1:8000`。
- HTTP 验证：`/health` 200；无 internal key 的 `/roads` 401；带 key 的 `/roads`、`/valuate`、`/plans/quote`、`/simulator/run`、`/ai/explain-valuation`、`/ai/admin-assist` 全部 200。
- 真实估价：Bukit Jelutong / 双层排屋 / 地 164 m² / 建筑 180 m²，回传 **RM785,635.3591160221**、10 笔参考成交；报价请求先按获批准规则取整数 RM 后，方案 A **RM616,723**、方案 B **RM589,226**；风险模拟读取 **187** 个回测案例。
- Gemini：估价解说与 admin 辅助两次检查均为 `source=llm`、无 fallback，约 13.78 秒 / 5.57 秒；这两次成功不代表持续可用性或延迟保证。
- 初次 sandbox 测试受临时目录权限与本机网络隔离影响，重新在获批权限下运行后通过；未将这些环境失败当作业务 bug。测试只读线上参考资料，无导入、migration 或申请写入。
- 限制：有第三方弃用警告；未运行 PostgreSQL pgTAP 状态机测试、真实账号写入/完整申请流程、前端 build 或线上部署检查。诊断脚本放在 gitignored `.venv/check_backend.py`，本节是验证结果记录，待 commit。

### 1.12 前端 Welcome 页设计与 EffectCraft 动画（2026-10-16，待 commit）

- [x] 完成获批准的 ivory / forest-green Welcome 设计：主视觉、介绍、三项优点、四步流程、A/B 简介及估价 CTA；guest 顶部导航可跳至页面区块，owner/admin 保留角色导航；Act 242 原文保留。
- [x] 用 EffectCraft 0.10.0 CLI 制作原生房屋/花园动画，保留 `.jsx`、可编辑 `.ecproj`、重建说明及静态 poster；后续获批升级为 13 秒版本（约 1.45 MiB），包括房屋分层组装、路径绘制、抵达高光、镜头推进及 9–13 秒花园循环；暂停/播放/独立重播、reduced-motion 与视频失败 fallback 均保留。
- [x] 最终 production build（含 lint / TypeScript）通过；Edge 实测 1440 / 768 / 390 / 320 px 无横向溢出；估价按钮正确进入 `/login?next=/valuation`，区块导航、视频解码/控制、键盘 skip link、静态 fallback 通过，无浏览器 runtime error。
- [x] 视觉检查修正初版 hero opacity 过淡，并增大辅助文字；详细变更、文件与验证见 `Frontend_Implementation_Log.md` 的 F2-01a。未改后端或 auth 实现；未 commit / deploy；真实 owner/admin session 验证仍待做。
- [x] 2026-10-16 动效升级（F2-01b）：新增指针景深、标签/浮卡不同幅度移动、滚动渐入、四步连接线、方案卡 hover 与 CTA 路径绘制。最终 build（含 lint / TypeScript）及扩展 Edge 检查通过，涵盖五个不同剧情帧、循环/暂停/重播、运行时 reduced-motion 切换、无 JS 内容与 320px 响应式；主题与内容保持不变，待 commit。

- [x] 2026-10-16 Welcome 精简（F2-01c）：按用户要求移除 How it works / Our plans / See how it works / Sign in 导航链接及动画暂停/播放/重播按钮；动画继续自动播放，其他内容、样式与估价 CTA 保留。此项取代以上旧记录中的导航/控制行为；production build（含 lint / TypeScript）及 Edge 浏览器复验通过，待 commit。

## 2. 待做：后端

按顺序做。每一项都以《HomeLoop_更新_页面与流程.md》为准，括号内是对应章节。

### B1. 数据库（新 migration）

- [x] 2026-10-14 已确认线上 `backtest_ratios` 有 187 笔、`sdp_launches` 有 35 笔（本机 CSV 在 `data/homeloop_data/`，不是 README 写的 `data/processed/homeloop_data/`）
- [x] 2026-10-15 用户已运行 `scripts/create_demo_users.py`，建立 1 个屋主与 1 个 admin demo 账号；脚本现在也会验证 role 更新确实命中 profile（commit `0388866`）

### B2. 估价 API 部署（用户操作）

- [x] 2026-10-14 已部署到 Render：`https://homeloop-valuation.onrender.com`，线上 `/health`、`/roads`、`/valuate` 均已用真实资料验证通过（免费方案冷启动约 22 秒）
- [x] 2026-10-15 已在 Vercel 设置 server-only `VALUATION_API_URL` 与 `VALUATION_INTERNAL_KEY`（不得改成 `NEXT_PUBLIC_`）
- [ ] 上述 B2 修正需重新部署 Render 才会生效

### B5. AI

完成日期：2026-10-15｜commits `1a93777`, `3474211`, `850a632`, `1fb3620`

- [x] 估价白话解说：Gemini 可选、无 key/API 错误/超时/额度/数字 guard 失败时用完整 deterministic template；所有输出数字必须来自输入（原则 14）
- [x] Admin 辅助：Python 先确定面积、低可信度及 AI/确认市值差异，LLM 只能措辞；输出一段摘要与注明需 admin review 的屋主讯息草稿
- [x] AI 只辅助，不自动批准或拒绝；`google-genai` 固定版本、500 笔记忆体 LRU、结构化 admin 输出及约 10 个 eval cases
- [x] 2026-10-15 Gemini 模型链改为每次尝试最多 8 秒（`GEMINI_ATTEMPT_TIMEOUT_SECONDS`，可覆盖），整条链仍以 `GEMINI_TIMEOUT_SECONDS=20` 为上限；timeout 直接换 fallback，只有 429/503 会重试同一模型；`eval/smoke_explain.py --runs N` 可检查真实成功率与平均延迟（commit `850a632`）
- [x] 2026-10-15 `/valuation/result/[id]` 的 AI slot 已拆成独立 async Server Component + Suspense；估价数字和参考成交先显示，AI 后续串流，失败时静默隐藏（commit `1fb3620`）
- [x] 2026-10-15 `AiThinking` 无图标 loading card 已完成：轮换短句、三点错开跳动、admin 文案 preset、reduced-motion 静态显示及 status accessibility（commit `1fb3620`）
- [x] 2026-10-21 AI 数字 guard 已补上英文数字词解析（commit `3a72485`）：`eight hundred and fifty thousand` 等表达会转换后使用与数字相同的输入 grounding 检查；输入真实包含的计数和年数仍可通过，捏造金额会触发 template fallback

### B6. 风险模拟 API

- [x] 2026-10-14 完成，见 1.8。输入：保底比例、方案 A 缓冲、成本、代理费/律师费、房价下跌幅度、township；输出：需补差额或会亏损的比例、每单平均成本、每单平均盈利、直方图（用 `backtest_ratios`）

---

## 3. 待做：前端

按用户流程排序。每一页都以《HomeLoop_更新_页面与流程.md》为准，括号内是对应章节。界面全英文。

### F1. 共用

- [x] 2026-10-15 版面：顶部导航按角色切换（未登录 Home｜屋主 Dashboard/Valuation/New home/Plans｜admin Applications/Risk simulator）、显示登入的邮箱与登出按钮、底部 Act 242 免责声明原文不变
- [x] 2026-10-15 登录 / 注册（邮箱 + 密码，Server Actions）；登录后按 `profiles.role` 导向 `/dashboard` 或 `/admin`；支援 `?next=` 回到原本要去的页面（只允许站内相对路径）
- [x] 2026-10-16 Sign in 视觉升级（F1-02a）：沿用 Welcome 的 ivory / forest-green / sage 与 serif 字体，双栏房屋/花园插画、背景网格/光晕、轻动效、tab 滑动、密码显隐、focus/点击反馈、提交载入与错误状态；保留现有 Create account / Server Actions / next / 密码规则，不新增认证功能。最终 production build（含 lint / TypeScript）、Edge 双模式 1440/768/390/320 px 与 Welcome regression 检查通过；修正手机标题空格，未创建账号，真实成功登入仍待验证，待 commit。
- [x] 2026-10-16 Sign in 动效升级（F1-02b）：以独立 EffectCraft 14 秒立体房屋/花园场景替换旧平面插画，含分层组装、路径/光点、镜头与 8–14 秒循环；扩大建筑轮廓、sage 光晕及前景叶片，新增指针多层景深，表单不跟随移动。主题/文案/认证不变；保留 reduced-motion、视频/无 JS fallback；build（含 lint / TypeScript）、扩展 Edge 与 Welcome regression 检查通过，详见前端记录，待 commit。
- [x] 2026-10-16 Sign in 门廊动效（F1-02c，取代上项房屋模型）：依获批预览改为层叠拱门；真实 3D 门板与把手绕左铰链约 5 秒缓慢向内打开，地面光线/阴影同步变化；保持开启并循环轻光影，不自动关门。移除花园/叶片与旧插画说明，主文案、表单、配色及认证不变。最终边缘融合 build（含 lint / TypeScript）、扩展 Edge 双模式 1440/768/390/320 px 与 Welcome regression 检查通过；变更/文件/验证详见前端记录，待 commit。
- [x] 2026-10-15 未登录访问受保护页面时导向 `/login?next=…`；受保护前缀为 `/dashboard`、`/valuation`、`/new-home`、`/plans`、`/apply`、`/admin`（原则 2：要登录才能估价）
- [x] 2026-10-16 定向修复（F1-04 / F2-02a）：估价初始 state 移出 `use server`，修复登入后 `results.length` 浏览器崩溃；admin 登入固定至 `/admin`，屋主只恢复允许的站内目的地；Welcome 隐藏应用导航/邮箱/登出但保留 session；应用内顶部/底部 Logo 回角色首页。4 个新 Node 测试 + 既有 rounding regression、本地 auth stub 的 owner/admin 成功登入/导航/返回/登出通过；正常 production build（含 lint / TypeScript）已恢复，Sign in / Welcome 回归通过。未改设计/动画、数据库或其他估价功能；真实账号密码未配置，仍需用户重试，待 commit。
- [ ] **待验证**：demo 帐号已建立；仍要实测屋主登入 → `/dashboard`、admin 登入 → `/admin`、屋主手动输入 `/admin` → 被送回 `/dashboard`

### F2. 屋主端

- [x] 2026-10-16 Welcome 页（`/`）：完成获批准的现代介绍页与 EffectCraft 原创动画；guest 可登入并继续估价，owner/admin 显示对应入口；详见 1.12 与前端记录 F2-01a（待 commit）。
- [x] 2026-10-16 Dashboard 总览画面（`/dashboard`）：8 格进度条、真实保存资料的状态卡、当前屋与所选新屋、方案 B 子进度、原创 EffectCraft 动画、手机排版及 loading/error/empty 状态。按用户确认，本阶段只完成 Dashboard；尚未完成的详情/选新屋/回应报价入口停用并注明，不扩建其他页面。详情及测试结果见前端记录 F2-06a/b/c（待 commit，未部署）。
  - [x] 2026-10-16 用户批准改为双页：`/home` 主入口（Your Records + 左右等高双卡、不同 EffectCraft 动画，无草稿/Current Home 卡），`/dashboard` 多笔记录、汇总卡、搜索筛选分页、每份申请展开自己的 8 格进度。保留一人一份活跃申请规则；全站页头 sticky，移除屋主页头四个入口，品牌返回 `/home`。Home 已先通过桌面一屏及手机验证，再实施记录页；完整验证结果见 F1-05、F2-06d/e/f。
  - [x] 2026-10-20 接上 `/dashboard/applications/[id]` 屋主详情页：从展开的个别申请进入，显示真实记录与当前阶段的回应操作；见 F2-11a–c。此项是源码完成，不代表已部署。
  - [ ] 真实 hosted 账号与线上 RLS 端到端验收；前一阶段的 photo/privacy migration 必须先套用目标数据库。保证期截止与实际结算净额没有足够资料时不虚构。
- [x] 2026-10-15 ① 估价输入（`/valuation`）：路名搜索（JALAN/JLN 同字、自动带出期数、县与是否 SDP 标签）→ 屋型（只列这条路真实成交过的，附近 3 年笔数与常见面积）→ 单位类型（中间单位自动带入常见面积并显示占比；角头/自填则手动输入）→ 地契；m² / sq ft 切换会换算已输入的数字；排屋 20×70 / 22×75 / 22×80 尺快捷按钮；搜不到路名时提示改用期数或 township（第 4 节）
  - [ ] **还没做**：照片上传（第 4 节标为可选）。需要 Supabase Storage `photos` bucket 的本人目录上传
- [x] 2026-10-15 ② 估价结果（`/valuation/result/[id]`）：区间与中间值、可信度（三档各自的白话说明）、10 笔参考成交表（月份、地段、建筑、价格、每平方米）、Act 242 免责声明在页脚；资料不足时不显示数字、改为说明少于 10 笔并建议人工估价；非 SDP 旧屋显示「只适用方案 B」卡片
  - [x] 2026-10-15 AI 白话解说已串接 server-only B5 helper，并以 Suspense 串流；服务失败时隐藏 slot，不阻断估价数字、可信度与参考成交先显示
- [ ] ③ 选新屋（`/new-home`）：在售项目卡片 + 「即将推出」分页（登记兴趣）→ 项目详情 → 选户型 → 价格默认起价、可填销售报价 → 显示差额与价格来源（第 5.1、5.3 节）
  - [x] 2026-10-16 开始、2026-10-17 验收：用户批准先做 Home → Explore SDP Homes 的浏览目录：selling/upcoming 分页、搜索、township/屋型筛选、官方项目图片、资料日期、缺价提示及新照片切片动画。项目按钮暂开官方 SDP 网页；不实现内部登记兴趣、选户型、报价或估价记录带入。25 项 Node 测试及 Home/目录/Dashboard 浏览器回归通过；线上目录只读查询确认 16 在售 + 7 upcoming。详见前端记录 F2-08a；未部署。
  - [x] 2026-10-17 F2-08b：先完成内部项目详情 `/new-home/[project]`；估价结果带 valuation ID，经本人限定读取后在目录筛选/分类/返回中保留。显示旧屋区间及较小中间值、官方项目资料、已核实户型（否则 Standard home type）、起价/可选 SDP 销售报价覆盖及基本差额，注明并非现金应付。无 View saved valuation；Choose this home 按批准停用并注明 Plan comparison coming next。Home 入口仍为官方网页浏览；无草稿保存、预订或申请。31 项 Node 测试、TypeScript、完整 lint 及本地 production 浏览器验收通过（1440/768/390/320 px、动效/低动态偏好、无 JS、本人资料隔离与既有 Home/目录/记录/角色回归）；无 runtime exception 或申请写入。详见前端记录；未部署。
- [ ] ④ 选方案（`/plans`）：方案 A / B 两张卡片 + 引导问题（能否先付 10% 订金）→ 详细计算 → 确认；不符合资格时方案 A 变灰并说明原因（第 5.3 节）
  - [x] 2026-10-17 F2-09a–d：完成 `/plans`、`/plans/a`、`/plans/b`；采用获批旧版 ivory/sage 双卡设计、新标题 Compare your trade-in options、分层阴影及独立眨眼/头部/手臂/呼吸的 2.5D adviser。Development 的 Choose this home 经校验后启用；GET 带入并返回恢复户型与报价，不存草稿。服务端重读本人估价与路段资格，不信任客户端金额/SDP flag；调用原 `quotePlans()` 保留整数 RM 顺序。显示区间、保底、订金现金缺口、资格原因及明细；后端只增明细字段与 rounding adjustment，不改公式/数据库。38 项 Node 与 145 项非线上 Python 测试、最终 production build/TypeScript/lint、完整浏览器回归（含 1440/768/390/320 px、低动态偏好、无 JS、图层顺序、角色/本人资料隔离）通过；无 runtime exception 或申请写入，正常环境 build 已恢复。详见前端记录；未部署。
  - [ ] 下一阶段：实现 `/apply` 后才启用 Confirm this plan；目前不创建申请或预订。远端后端需重新部署才返回新增扣除明细；前端兼容旧版 totals-only API 并明确提示，未部署或修改 hosted 设置。
- [ ] ⑤ 换屋计划书 + 提交申请（`/apply`，同一页）：时间线、资金进出、订金缺口提醒、要准备的东西、RPGT 提醒；下半部填门牌、地契号码（可选）、PDPA 同意（第 5.3、5.4 节）
  - [x] 2026-10-20 用户批准定向文案/动效完善（F2-10a/b，待 commit）：保留队友 `e94dbf1` 已有申请页面、表单与金额；新增每阶段白话说明及屋主行动提示，分清 priced A / priced B / manual 的上门类型，补齐初步区间/继续意愿、leasehold 同意时间、B 订金资金先后与 RPGT 来源提醒。保留方案页全部明细、保底、区间及注意事项；仅详情页/申请页加柔和 yuzu 点缀、小动效与 reduced-motion。62 项 Node 测试、独立 TypeScript 及两次隔离 production 浏览器验收通过（priced/manual A/B、leasehold、1440/768/390/320px、动效/低动态偏好、选择保留、表单及内存提交/重复申请回归）；无 runtime exception。未改后端、数据库或线上配置；完整流程仍需后续屋主回应及 admin 画面。
- [x] 2026-10-20 F2-11a–c（待 commit，未部署）：新增屋主申请详情与真实阶段回应；初步范围 Continue / Withdraw、人工估价独立同意、补件文字/私有照片、正式报价 Accept / 合资格一次 Switch / Decline / 一次 Review 与真实到期倒数、接受后 e-SPA 签署声明。后台仍需确认签署；不连接 HIMS 或收款。沿用 ivory / forest / sage、小幅暖色点缀、分层阴影、移动文件图案、hover/focus/click 动效与 reduced-motion。服务端重读本人申请/上下文/版本后调用原 RPC；不修改后端、原公式、已有 migration 或 .env。
  - [x] 84 项 Node 测试、独立 TypeScript、lint error 检查及 production build 通过。逐动作文件/问题/完整浏览器验收结果见 `Frontend_Implementation_Log.md` F2-11a–c；真实 hosted 部署仍另行确认。

### F3. Admin 端

- [x] 2026-10-20 仅完成双页实施交接计划（非页面实现）：[Admin Dashboard / Application Details plan](../superpowers/plans/2026-10-20-admin-dashboard-and-application-details.md)。包含逐阶段控件与 RPC、资料/隐私/照片/AI 规则、文件分工、测试及 G1 正式报价预览 / G2 方案 B 初步范围语义的批准停点。实际 A1 / A2 仍如下列待做；不更改屋主现有画面或后台合同。
- [x] 2026-10-20 A1 只读申请面板（`/admin`）源码完成：真实每月额度/用量、All + 七个工作队列（含接受后追踪）、完整资料计数、分页、申请人/物业/项目搜索、旧屋 township/方案/警告筛选、明确缺资料/错误状态；沿用 ivory / forest-green / sage，轻动效、键盘操作、reduced-motion 与手机横向表格。读取不调用会修改到期状态的 flags RPC，不新增报价公式或 workflow 写入。94 项 Node 测试、TypeScript、lint 与 production/browser 检查记录见 `Frontend_Implementation_Log.md` F3-01a；hosted migration/权限/额度配置只读核对完成。待用户审核/commit，未部署；真实 LOCAL Supabase / 浏览器 RLS 验证因本机无 Docker/Supabase 未执行。Details 尚未实现，逐案入口诚实注明不可用。
  - [ ] A1.4 每月额度编辑：按计划在 Dashboard 审核后另外实施；不在本次只读面板阶段新增。
  - [x] 2026-10-20 用户批准简化 admin 页头（F3-01b，待 commit）：移除 Refresh records 按钮、Loaded 时间与不用的 DTO 字段/样式；移除 Applications / Risk simulator 导航链接。保留 Logo、账号、Sign out、admin 登录直达 `/admin` 与原有资料读取/API。A1 原始实现 commit 已核实为 `96edfb8`。
- [x] 2026-10-21 A2 申请详情（`/admin/applications/[id]`）本地流程完成：完整资料、AI 估价与参考成交、照片、AI 辅助摘要、操作记录；按当前关卡显示操作按钮与表单（看屋结果、调整原因、数据库公式算出的报价预览）（第 5.5 节）。相关 hosted migrations 与前端仍待部署验证
  - [x] 2026-10-20 本地实现 A2 资料页与现有后台支持的操作（F3-02a，待 commit）：房屋/保存报价/看屋资料、protected audit 分页、owner message 与内部 note 分离、private 照片查看、stage-based review/补件/拒绝/Plan A 初步范围/manual consent/上门/签约确认/后续里程碑、明确发送讯息与受限 AI 辅助。Dashboard 已接逐案入口并保留筛选返回。104 项 Node 测试、TypeScript、lint、production/browser fixture 检查通过；详见前端记录。
  - [x] 2026-10-20 按批准的视觉稿重排 A2（F3-02b，待 commit）：平衡摘要/操作卡片、全宽资料分页、折叠 AI/内部 note、柔和柚橙色操作标题、轻量动画及 reduced-motion；保留原后台与 G1/G2 停点，不改屋主页面。
  - [x] 2026-10-21 G2 Plan B 初步金额完整接通（commits `113a4af`、`3e24a34`、`5ea6195`，未部署）：Admin 在 `under_review` 发送与申请/新屋价格匹配的保存 quote；`indicative_low/high` 是扣除假设销售费用后的预计公开市场净收入区间，75% guarantee floor 独立展示。Server Action 与数据库都会 fail closed；snapshot 缺失、不完整、不合资格、非 whole-RM、不匹配、已切换方案、人工估价或 receipt 被修改均阻止发送。Owner 不读取 private audit；补件后仍等 Admin 明确判断，不自动推进。
  - [x] 2026-10-21 G1 正式报价预览、正式发出及回应一次复核已完成本地实现（commits `3e24a34`、`5ea6195`，未部署）：Admin 输入注册估价确认值；区间外必须写屋主可见说明。页面显示数据库 authoritative preview、资格和额度，再明确 Confirm；finalize 锁定并核对 revision/amount，不信任浏览器报价。Owner 详情及 Dashboard 显示正式计算基础与公开说明，最后决定接受、拒绝、复核或合资格换方案。
  - [x] 2026-10-21 B→A registered-valuer handoff 已完成本地实现（commit `6b629b3`；migration `20261021074642_add_b_to_a_registered_valuation.sql`，尚待远端 push）：安全 RPC 只允许 Admin 在一次 B→A 切换后预约，锁行并写一笔 event。Admin 录入外部注册估价师的新确认值时，页面保留旧 Plan B 确认值作参考；金额有任何变化都必须提供屋主可见说明，超出 AI 区间亦须说明，valuer/basis 写入内部记录。正式 Plan A offer 仍由数据库按 78.5% 计算，Owner 决定接受、拒绝或复核
- [x] 2026-10-21 A3 风险模拟（`/admin/simulator`）本地完成（commit `7448fe2`）：Admin-only、server-only 调用现有 B6 API；拉杆 debounce 与手动运行并存，percentage-first 显示 Plan A / Plan B 风险，RM 数字明确区分 RM786,000 reference valuation 与 sample-weighted 基准，直方图笔数会与 `n_cases` 对账；含 loading/error/empty、手机及 reduced-motion 状态

### F4. 串接与收尾

- [ ] 所有页面串接后端 API（B2–B6）
- [ ] 载入中、错误、空资料的画面
- [ ] 电脑为主、手机可正常浏览
- [ ] 部署到 Vercel 并用 demo 账号走完整个流程（《页面与流程》第 7 节 demo 剧本）

---

## 4. 已知问题与注意事项

| 问题 | 说明 |
|---|---|
| 前端待处理的整合问题（更新 2026-10-16） | 前端记录 FE-BUG-02、03、05 仍待处理：资料不足结果页承诺可申请，但 SQL 拒绝；地契自动带入未接线；无常见面积的中间单位手填面积未随表单提交。FE-BUG-04 已由用户提供的 production chunk 确认为浏览器 state 边界错误，移至独立 state 模块修复；FE-BUG-06/07 的角色跳转及公开页导航也已定向修复，本地隔离 auth 浏览器验证通过，真实账号流程仍待用户重试。 |
| 部分网络的路由器 DNS 查不到 `*.supabase.co` | 改用 1.1.1.1 / 8.8.8.8，或在 hosts 文件加 `104.18.38.10 qcuzvdkrqzxogigsxisk.supabase.co`（Supabase IP 改变时要更新） |
| `transactions` 只能导入一次 | 重新导入前要先 `truncate` 6 张参考表（见 README） |
| 大部分新屋项目只公布起价 | 第 ③ 步用起价，允许用户填销售报价 |
| 所有 CSV 被 `.gitignore` 排除 | 数据放 `data/processed/`，用脚本导入 |
| `road_catalog` 的 Birai 验收笔数与任务文字不同 | 按指定的 trim/JLN 正规化后，`JLN BIRAI U8/69` 有 13 笔（其中 1 笔原始路名有前导空格）；常见地段 178 m²、建筑 190 m² 均符合预期 |
| 相同 `road_norm` + 屋型可能横跨多个 scheme | `/roads` 会回传 scheme；这种情况调用 `/valuate` 时必须同时带入所选 scheme，否则回 422，避免使用错误期数的成交 |
| 估价与方案 API 只能由服务器调用 | `apps/web/src/lib/valuation.ts` 已加 `server-only`；F4 必须从 Server Component、Server Action 或 route handler 调用，绝不能从 client component 调用或把内部 key 改成 `NEXT_PUBLIC_` |
| B→A 换方案后重新安排估价师上门（已解决） | 首次 B→A 注册估价预约已由 migration `20261021074642` 的专用动作处理；一般已预约案件改期则由 migration `20261021130515_reschedule_inspection.sql` 的 admin-only RPC 处理。RPC 锁行、只接受未来且不同的时间、维持 `inspection_scheduled`，并把旧/新时间写入一笔 audit event；本地 pgTAP 通过，远端已应用且 linked lint 无错误。 |
| **正式报价无法发出（2026-10-21 审查，阻断 demo）** | `app/admin/applications/[id]/actions.ts:48` 的 switch 与 `ADMIN_ACTIONS`（`lib/admin-application-detail-model.ts:21`）共 14 个动作，**没有任何一个的目标状态是 `offer_sent`**；`issue_offer` 全站与所有 SQL wrapper 都没有调用，`findings` 的说明文字本身就写「This does not issue an offer」。申请走到 `inspected` 后永久停住，连带 **12 个 RPC 不可达，其中 10 个 UI 已做好**（屋主 accept / decline / switch_plan / mark_espa_signed，admin signing / listed / buyer / guarantee / completed / handover）。对应第 5.5 节第 4 关的「admin 批准」与 demo 剧本第 8–9 步。Task_track 第 291 行已记录 G1 延后，但没有记录延后会切断整条流程。修法：在现有 switch 加一个 case 加确认表单；报价金额、14 天到期与月度额度都由资料库处理，前端不算价。详见审查文件第 1 项 |
| **方案 B 申请无法离开 `under_review`（2026-10-21 审查｜已在 `QY` 修好，待 merge）** | **`origin/QY` commit `3f301d2` 已修**：新增 `initial_b` 动作、`initialBFigures()` helper 与第 72 行的方案 B 分支，只差 merge 进 `main`。采用的做法与审查文件原本的建议不同、且更好：存的是**预计公开市场净额区间**（`expected_net_low` … `expected_net_high`），保底价另外单独显示，更贴近第 5.5 节「并显示预计可拿到的市价范围」。原本的问题说明保留如下，供 merge 后验收参考。 |
| ↳ merge 后要验收的点（原问题说明） | `lib/admin-application-detail-model.ts:65` 只在 `app.plan === "A"` 时提供 `initial_a`，而 `proceed_application` 要求状态为 `indicative_sent`，所以方案 B 的申请在 `under_review` 只剩 information / reject / message，永远走不到安排看屋。`caseStageNote()` 第 83 行与 Task_track 第 291 行的 G2 已诚实记录这是待确认项目，但后果是：**方案 B 是主推方案**（《商业模式》第 7.3 节），demo 剧本第 5 步就是选方案 B，第 6 步就卡住，比上一项还早两关。**这纯粹是前端闸门**：`send_indicative` 的 SQL 不限制方案，只拒绝人工估价案件并要求 `under_review`。语意其实第 5.5 节第 2 关已写明「方案 B 保底 = AI 中间值 × 75%，并显示预计可拿到的市价范围」；建议 `indicative_low = indicative_high = plan_b.floor`（点值），市价范围从 `plan_quote_snapshot` 显示。详见审查文件第 2 项 |
| 复核的 admin 回应端没有 UI | 屋主端**已做好**：`app/dashboard/applications/[id]/actions.ts:70` 以 `purpose: "offer_review"` 呼叫 `submitApplicationResponse`，而 `submit_application_response` 内部会呼叫 `public.request_review(...)`（同一个 wrapper 也以 `info_response` 呼叫 `provide_info`）。所以只搜 TypeScript helper 名字会误判这两个未接线。缺的是 **admin 端**：`respondReview` 没有任何调用，`ADMIN_ACTIONS` 也没有对应动作，因此申请一旦进入 `review_requested` 又是一个死路。要与上一项一起做，否则只是把死路往后推一步 |
| A3 风险模拟页不存在 | 没有 `/admin/simulator` 路由，`lib/valuation.ts:373` 的 `simulate()` 从未被调用，导航也没有入口。原则 13 明订要做，且是 demo 第 10 步。B6 API 已部署并验证可重现《商业模式》第 5 节全部八个数字。**建页面时**优先显示百分比；若显示 RM 必须注明用的是哪个估价（见 1.8 与审查文件第 3 项） |
| 原则 14 的数字 guard 漏掉用英文单字写的数字 | `app/ai/guard.py:12` 的 `NUMBER_PATTERN` 只比对阿拉伯数字。以真实 facts payload 实测：`RM950,000` 与 `14` 会被拦下，但 "roughly eight hundred and fifty thousand ringgit" 与 "fourteen recent sales" 会通过。prompt 有写「Do not invent … numbers」，但那是提示而非确定性控制，而「around eight hundred thousand」正好是三句白话解说最自然的写法。修法：两个 prompt 加「数字一律用阿拉伯数字」，并在 guard 加数字单字侦测，违反就照现有机制回退 template |
| 标记规则有两份实作 | SQL 的 `admin_application_flags` 与 `lib/admin-applications-model.ts:132` 的 TypeScript 版（已有 `// Parity:` 注解说明唯读模型不能触发 lazy expiry）。理由合理，但 80% 额度门槛与「确认市值低于 AI low 超过 10%」要两边同时改；建议在 SQL 侧加注解指回 TypeScript |
| **估价对地段面积不单调（已接受并披露的 deadline 限制）** | 估价 = 可比成交「每平方米建筑面积」中位数 × 建筑面积，地段面积只影响选哪 10 笔，不直接参与价格换算。团队决定截止日前不改模型，避免破坏 Bukit Jelutong golden result 与既有回测；估价结果页现已明确披露较大地段不保证较高初步估价，并以注册估价师上门检查及正式确认市值作风险缓解。截止日后若改核权重等方法，必须重跑完整回测。 |
| Prototype 只支援 landed homes | 现阶段即使是方案 B，也只处理可由现有 road/floor 数据估价的 landed old homes。高楼 49,749 笔的 `floor` 为空、`road` 是空白字串，无法进入当前 `road_catalog`/KNN；高楼支援列为下一阶段，届时需新增期数层级目录并以 `area_sqm` 作为面积基准。长期产品范围仍可扩至 7 个县任何发展商，但 prototype 的 Plan B 文案不得暗示现已支援高楼。 |
| 方案 A/B 报价公式有两处来源（已加契约保护） | 数据库 `private.application_offer` 仍是正式报价权威来源，Python 常数只供初步报价及模拟复用。新 migration 与 Python 常数互相注解，并新增 parity test 读取既有 workflow migration，验证 Plan A `0.785` / Plan B `0.75` 始终一致；未来改率仍须同时改 Python 与新增 migration。 |
| `net_at_floor` 保底净额（已解决） | commit `0388866` 已按《商业模式》第 0.2、4 节改为保底价本身；RM786,000 对应 RM589,500。公开市场的 `expected_net` 仍保留 3.2% 代理费及 1.2% 律师费假设。 |
| `create_demo_users.py` role 验证（已解决） | commit `0388866` 会检查 update 回传确实包含目标 profile；未命中时非零退出，不再误报 admin role 已设定。 |
| 每月额度月份归属（已解决） | Migration `20261015084351_fix_monthly_limit_timezone.sql`（commit `93faa61`）已于 2026-10-15 套用线上，统一以 `Asia/Kuala_Lumpur` 计算报价月份；本机重建与 59 项 pgTAP 已通过，远端 migration list 已对齐，linked database lint 无错误。 |
| `backtest_ratios` 部分导入后无法重试（操作文件已补） | 保留正确的 `requires_empty=True` 防重复保护；README 现已写明只 truncate `public.backtest_ratios restart identity`，再以 `--only backtest_ratios.csv` 重跑，不碰其他参考表。 |
| 风险模拟的 RM 金额基准（已解决） | commit `7448fe2` 的 A3 页面以百分比为主，并把 RM 数字分别标为 RM786,000 reference valuation 与 sample-weighted basis，不再把两种金额误写成同一含义。`/simulator/run` 的三种基准维持不变。 |
| B4 提交时的 valuation / plan snapshot 可由恶意屋主伪造 | `submit_application` 从 Next.js server 接收 snapshot，因此 priced snapshot 数值仍只作初步参考；admin 会在上门检查时重新核实，正式报价始终由数据库根据 `confirmed_value` 按固定公式重算，不信任客户端报价金额。人工路径额外核对该屋主保存的 `valuation_status=insufficient_data` 与对应 `road_catalog.n_recent_3y < 10`，不接受单靠客户端自称资料不足。 |
| B→A registered-valuer 与一般预约改期（数据库已部署） | migration `20261021074642_add_b_to_a_registered_valuation.sql` 与 commit `6b629b3` 已补 B→A 专用安全 RPC、Admin 预约/录值控件、旧值审计及屋主可见差异说明；migration `20261021130515_reschedule_inspection.sql` 再补任何已预约 `inspection_scheduled` 案件的安全改期与 audit。两项 migration 已在远端对齐；新增前端控件仍待 commit / Vercel 部署。 |
| Admin flags SQL / TypeScript 门槛必须同步 | `admin_application_flags()` 与 `apps/web/src/lib/admin-applications-model.ts` 目前都使用 valuation gap 10% 与 quota near 80%。migration `20261021074642` 加入数据库 COMMENT 记录此契约但不改逻辑；以后调整任一门槛必须同时修改 SQL、TypeScript 与测试。 |
| 第二轮其余修复（commit `9afd563`） | 全站金额统一走 whole-RM formatter；AI mismatch 明确写为 mid-point estimate；number guard 对 `half` / `third` / `quarter` / `double` / `triple` / `dozen` 直接回退；删除 4 个误导审查的未使用 TS exports。完整 Node 119/119、Python 154 passed + 10 skipped + 2 个 Windows 已知挂起用例明确 deselect、importer 17/17、pgTAP 204/204、TS、lint 与 production build 通过。 |

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
