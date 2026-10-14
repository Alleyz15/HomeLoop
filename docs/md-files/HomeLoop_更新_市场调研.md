# HomeLoop 更新：市场调研（马来西亚与全球）

版本：2026-10-13｜补充其他 HomeLoop 文件，不改动原文件
问题：马来西亚或全球有没有类似 HomeLoop 的 App 或网站？

---

## 0. 结论（诚实版）

1. **全球：有。** 「开发商帮你卖旧屋，卖不掉就由开发商买下」这个模式，**英国和日本的大型开发商已经在做**：
   - 英国 Barratt 的 **Part Exchange Xtra**：先由代理按市价卖，新屋交屋前 8 周还没卖出，Barratt 就买下。
   - 日本野村不动产的**买取保证**：先卖 90 天到 1 年，卖不掉按事先约定的价格买下；之后转售赚的钱还给屋主；还配合银行提供过渡贷款。
   - 这两个跟我们的**方案 B 几乎一样**。所以 HomeLoop **不是全世界第一个**，pitch 里不能这样说。
2. **马来西亚：只有零散的部分，没有完整的版本。**
   - 有**估价工具**（EdgeProp、List.my），但只给数字，不连接买卖。
   - 有**代理做的换屋**（槟城，人工处理，折价 12–20%）。
   - 有**开发商回购**（IJM Land 的 SWITCH），但只针对「失业」，不是换屋。
   - SDP 自己的 App 没有二手、估价或换屋功能。
   - **我们没有找到**由马来西亚开发商提供、在线完成、有透明估价和保底价的换屋服务。
3. **调整后的定位：**
   > 「把英国和日本大型开发商已经验证的换屋保底模式，第一次带进马来西亚，并用 NAPIC 公开数据做透明估价，整个流程在网站上完成。」

---

## 1. 马来西亚现有的东西

| 名称 | 类型 | 做什么 | 跟 HomeLoop 的差别 |
|---|---|---|---|
| **EdgeProp「Edge Reference Price」** | 估价工具（网站） | 用 NAPIC 成交加用户数据估价，给区间；每天更新；覆盖 KL、雪兰莪、槟城、柔佛 | 只给估价，没有连接到买新屋、没有保底；网站自己写明不保证准确 |
| **List.my 估价工具** | 估价工具（网站） | 输入地点、屋型、面积，30 秒出估价和可信度；用 JPPH 数据，约 51 万笔二手成交，数据大约晚 6 个月 | 只给估价；明确写「不是银行估价」；没有买卖服务 |
| **PG Property Angel 槟城换屋计划** | 代理加开发商（人工） | 代理先评估旧屋，屋主选开发商的新屋，开发商按银行估价给折价，交屋时由开发商的银行赎回旧屋贷款 | 折价比银行估价**低 12–20%**；新屋价格约比折价高 25%；不透明；没有在线流程；开发商没有具名 |
| **IJM Land × RHB「SWITCH」**（2022） | 开发商回购保证 | 从签约到拿到完工证明后 12 个月内，屋主如果**非自愿失业**，可以把房子交回给开发商 | **不是换屋**；但证明了**马来西亚开发商可以和银行合作提供回购保证** |
| **Ohmyhome 马来西亚** | 代理平台（App） | 买、卖、租屋的代理服务和 App | 一般代理服务，没有找到即时报价、保底或换屋功能 |
| **SDP App** | 开发商 App | 会员优惠、付款和工程进度、电子文件、交屋、缺陷报告 | **没有**二手、估价或换屋功能，HomeLoop 正好补上这一块 |
| **SDP × Maybank「10 秒批核」**（2023） | 开发商加银行的数字合作 | 合格买家可以快速得到房贷批核 | 说明 SDP 已经有和银行做数字合作的经验，以后可以合作提供过渡贷款 |

**马来西亚的空白：** 估价工具和换屋服务是分开的，没有一家把「透明估价 → 选新屋 → 保底卖旧屋 → 在线追踪」连在一起，也没有开发商提供换屋保底。

---

## 2. 全球的类似服务

### 2.1 开发商自己做（最接近 HomeLoop）

| 国家 | 名称 | 怎么运作 | 对应 |
|---|---|---|---|
| 英国 | **Barratt「Part Exchange」** | Barratt 直接买下旧屋，抵新屋的部分款项 | 方案 A |
| 英国 | **Barratt「Part Exchange Xtra」** | 两份独立估价后定出售价；Barratt 指定代理并付代理费，先按市价卖；新屋交屋前 8 周还没有满意的出价，Barratt 就买下 | **方案 B** |
| 英国 | **Barratt「Movemaker」**、Miller「Assisted Move」 | 开发商安排代理卖旧屋并付代理费，**没有**保底 | 方案 B 但没有保底 |
| 英国 | **Persimmon「Part Exchange」** | 至少两份独立估价；旧屋价值最多是新屋价格的 70% | 方案 A |
| 日本 | **野村不动产「买取保证」** | 先卖 90 天到 1 年；卖不掉按事先约定的价格买下；转售赚的钱还给屋主；配合三井住友银行提供最长 12 个月的过渡贷款 | **方案 B（几乎一样）** |
| 日本 | **东急 Livable「买取保证」** | 先卖约 3 个月，卖不掉按预计成交价的 70–90% 买下；有分成机制；用于换屋 | 方案 B |
| 中国 | **「住房以旧换新」**（2024） | 超过 100 个城市推出：国企收购旧房、代理优先卖旧房（北京：90 天内卖不出可以退订金）、开发商收购、政府补贴 | 方案 A 与 B 的各种版本 |

### 2.2 平台或科技公司做（不是开发商）

| 国家 | 名称 | 怎么运作 | 结果 |
|---|---|---|---|
| 美国 | **Opendoor**（含 2018 年开发商换屋计划） | 48 小时内给收购报价，旧屋和新屋同时交割；当时美国前 25 大开发商中有 19 家的客户用过 | 收 5% 服务费；2025 年卖出约 11,700 间房，**净亏损 13 亿美元** |
| 美国 | **Zillow Offers** | 算法出价收购 | 2021 年关闭；存货减值 3.04 亿美元；裁员约 25% |
| 美国 | **Orchard「Move First」** | 先借出旧屋部分资产净值让屋主买新屋，再帮屋主卖旧屋，附出售保证 | 约 6% 佣金加 2.4% 计划费 |
| 美国 | **Flyhomes「Buy Before You Sell」** | 用旧屋的资产净值先买新屋 | 2025 年 9 月**退出代理业务**，只做金融产品，通过贷款员和代理分销 |
| 美国 | **Homeward** | 先买后卖的现金报价 | 2022 年市场转差时裁员约 20% |
| 英国 | **Nested** | 卖屋前先预付最多 95% 的屋价 | 2019 年市场下滑，裁员约 20% |
| 澳洲 | **Bridgit × AFG**（2026 年 8 月） | 数字过渡贷款：先买新屋、之后再卖旧屋 | 只做贷款，不保证售价 |

---

## 3. 从全球经验学到的

| 观察 | 对 HomeLoop 的意义 |
|---|---|
| **平台型公司普遍亏损或收缩**（Opendoor、Zillow、Nested、Homeward、Flyhomes） | 它们靠旧屋本身赚钱，市场一转差就出问题 |
| **开发商型可以长期做**（Barratt、Persimmon、野村） | 开发商靠卖**新屋**赚钱，换屋只是促销工具。HomeLoop 由 SDP 提供，走的是这条路 |
| **「先卖、卖不掉才买」是主流**（Barratt Xtra、野村、东急、北京） | 方案 B 的设计跟成熟做法一致，风险比直接收购小 |
| **转售多赚的钱还给屋主**（野村、东急） | 方案 B「卖得高全归屋主」有先例，对屋主公平 |
| **中国：估价太低，屋主就不愿意参与** | 估价要**透明、有依据**，HomeLoop 展示 10 笔真实成交，正好针对这个问题 |
| **独立估价**（Barratt、Persimmon 都用两份独立估价） | 方案 A 用外部注册估价师，增加屋主信任 |
| **过渡贷款常和保底一起提供**（野村配合三井住友银行） | 未来 SDP 可以和银行合作，SDP 已经和 Maybank 有数字合作的经验 |

---

## 4. HomeLoop 和马来西亚现有服务比较

| 功能 | EdgeProp / List.my | 槟城换屋计划 | IJM SWITCH | Ohmyhome | **HomeLoop** |
|---|---|---|---|---|---|
| 免费在线估价 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 展示参考成交（估价依据） | List.my 有 | ❌ | ❌ | ❌ | ✅ 10 笔真实成交 |
| 连接到买新屋 | ❌ | ✅ | ✅（只有失业保障） | ❌ | ✅ |
| 不用先卖旧屋 | ❌ | ✅ | — | ❌ | ✅ |
| 保底价 | ❌ | ❌ | ❌ | ❌ | ✅ 方案 B |
| 直接收购 | ❌ | ✅（折价 12–20%） | 只限失业 | ❌ | ✅ 方案 A，每项扣除都公开 |
| 费用全部列出 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 在线追踪进度 | ❌ | ❌ | ❌ | 部分 | ✅ |
| 开发商直接提供 | ❌ | 开发商没有具名 | ✅ | ❌ | ✅（SDP） |

---

## 5. Pitch 可以这样说

- **不要说：**「全世界第一个」、「马来西亚没有人做过换屋」。
- **可以说：**
  > 「英国 Barratt 和日本野村不动产等大型开发商，已经证明『先按市价卖、卖不掉由开发商买下』行得通。马来西亚现在只有估价工具和零散的代理换屋计划，没有开发商提供完整、透明的换屋服务。HomeLoop 把这个模式带进 SDP，用 NAPIC 公开成交做透明估价，整个流程在网站上完成。」
- **评审问「为什么不会变成 Zillow」时：**
  > 「Zillow、Opendoor 这类平台靠旧屋赚钱，市场一跌就亏。HomeLoop 跟 Barratt、野村一样，由开发商提供，靠卖新屋赚钱，主推的方案 B 也不需要先买下旧屋。」

---

## 6. 来源

**马来西亚**
- EdgeProp Edge Reference Price：https://www.edgeprop.my/home-estimate
- List.my 估价工具：https://list.my/tools/property-valuation
- PG Property Angel 槟城换屋计划：https://penangpropertyangel.com/foreigner-handbook/want-to-upgrade-your-property-without-the-stress-of-selling-first
- IJM Land × RHB SWITCH（EdgeProp，2022）：https://www.edgeprop.my/content/1903095/ijm-land-partners-rhb-switch-scheme
- IJM Land 回购计划（NST，2022）：https://nst.com.my/amp/property/2022/07/815626/ijm-land-hopes-increase-buyer-confidence-its-buy-back-scheme
- Ohmyhome 马来西亚：https://ohmyhome.com/en-my/
- SDP App（App Store）：https://apps.apple.com/us/app/id6474657954
- SDP × Maybank 10 秒批核（2023）：https://www.simedarbyproperty.com/sites/default/files/2023-10/20231010%20-%20FOR%20IMMEDIATE%20RELEASE%20-%20MAYBANK%20AND%20SIME%20DARBY%20PROPERTY%20OFFER%2010%20SECOND%20APPROVAL%20FOR%20ELIGIBLE%20HOME%20BUYERS.pdf

**英国**
- Barratt Part Exchange Xtra：https://www.barratthomes.co.uk/offers/part-exchange-xtra
- Barratt Movemaker：https://www.barratthomes.co.uk/Offers/Movemaker
- Persimmon Part Exchange：https://www.persimmonhomes.com/schemes/part-exchange
- Miller Homes Assisted Move：https://www.millerhomes.co.uk/our-offers/assistedmove
- Nested 裁员（Estate Agent Today，2019/3/18）：https://www.estateagenttoday.co.uk/breaking-news/2019/03/another-online-agency-in-trouble-and-blames-brexit-for-redundancies/

**日本**
- 野村不动产 买换支持（买取保证、过渡贷款）：https://www.nomu.com/plus/kaikae/index.html
- 东急 Livable 买取保证：https://www.livable.co.jp/l-note/?p=53912
- at home：買取保証付き仲介：https://www.athome.co.jp/contents/for-sellers/sellers-kiso/kaitori-hoshou/

**中国**
- 人民日报《中国城市报》：超百城推住房「以旧换新」（2024/8/12）：https://paper.people.com.cn/zgcsbwap/html/2024-08/12/content_26074370.htm

**美国与澳洲**
- Opendoor 开发商合作（2018）：https://www.opendoor.com/articles/opendoor-partners-with-builders-making-new-home-buying-easier
- Opendoor 2025 年报（10-K）：https://www.sec.gov/Archives/edgar/data/1801169/000180116926000010/open-20251231.htm
- Zillow 8-K（2021/11/2）：https://www.sec.gov/Archives/edgar/data/1617640/000161764021000085/z-20211102.htm
- HomeLight：Orchard 评测：https://www.homelight.com/blog/buyer-orchard-reviews/
- GeekWire：Flyhomes 退出代理业务（2025/9）：https://www.geekwire.com/2025/flyhomes-officially-exits-real-estate-brokerage-business-to-focus-on-financing-products/
- Inman：Homeward 裁员 20%（2022）：https://www.inman.com/2022/08/10/homeward-sheds-20-of-workforce-amid-sudden-and-sizable-downturn/
- Broker News：AFG × Bridgit 过渡贷款（2026/8）：https://www.brokernews.com.au/news/breaking-news/afg-rolls-out-bridging-finance-product-with-bridgit-289825.aspx
