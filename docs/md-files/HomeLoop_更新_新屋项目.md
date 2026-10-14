# HomeLoop 更新：SDP 在售新屋项目

版本：2026-10-14｜补充其他 HomeLoop 文件，不改动原文件
资料来源：SDP 官网项目列表 https://www.simedarbyproperty.com/home/properties/ （2026-10-14 查看）、各项目页面、SDP 新闻稿、EdgeProp
数据文件：`sdp_launches.csv`（可直接导入 Supabase 的 `sdp_launches` 表）

---

## 0. 结论

- SDP 官网列出 39 个住宅项目（含英国 Battersea），按官网标签整理后：
  - **在售（New Launch）：16 个**，其中 9 个有地屋、7 个高楼
  - **状态要再确认：3 个**（官网列表和项目页说法不一致，或没有标签）
  - **建造中、可能还有剩余单位：9 个**
  - **即将推出：7 个**
- **很多项目只公布「起价」，没有公布每个户型的价格。** 只有 Serenia Baleria（最低价和最高价）和 Serasi Residences（3 个户型各自的起价）公布得比较完整。
- 建议网站第 ③ 步：
  - **只列「在售」的 16 个**（可以加一个「即将推出」分页，按钮写「登记兴趣」）。
  - 选户型后的价格：**默认用官网起价**，并让用户填「销售人员报给你的价格（可选）」，有填就用用户的数字计算。
  - 每个项目卡片标明「价格以 SDP 销售廊为准，资料更新于 2026-10-14」。

## 1. 在售（官网标 New Launch，或已公布价格）

| 项目 | Township（地区） | 类型 | 起价 | 建筑面积（sq ft） | 地段 | 房间 | 地契 | 预计完工 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| [Serenia Baleria 1 & 2](https://www.simedarbyproperty.com/serenia-city/serenia-baleria/) | Serenia City（Sepang, Selangor） | 2-storey terrace | RM809,888 | 1,731–2,088 | 20'x70' / 22'x70' | 4R3B | Freehold | Jul 2028 (B1) / Sep 2028 (B2) | Baleria 1 from RM809,888; Baleria 2 from RM814,888; max RM1,358,888 / RM1,378,888; 7% Bumiputera discount |
| [Tiara Residences 1](https://www.simedarbyproperty.com/bukit-jelutong/tiara-residences/) | Bukit Jelutong（Shah Alam, Selangor） | 2-storey linked villa | RM1,749,888 | 2,419 起 | 22'x80' / 22'x90' | 4R4B | Freehold | Jun 2029 | 85% taken up at launch weekend (27 Jun 2026) |
| [The Nine, Elmina Green](https://www.simedarbyproperty.com/city-of-elmina/the-nine-elmina-green/) | City of Elmina（Shah Alam, Selangor） | 2-storey link | RM921,888 | 2,000–2,342 | 20'x80' / 22'x80' | 4R4B | Freehold | 未公布 |  |
| [Adira](https://www.simedarbyproperty.com/bandar-bukit-raja/adira/) | Bandar Bukit Raja 2（Klang, Selangor） | 2-storey link | RM869,888 | 1,910–2,174 | 20'x75' / 22'x75' | 4R4B | Freehold | 未公布 | Final release, limited units |
| [Casira 3](https://www.simedarbyproperty.com/bandar-bukit-raja/casira-3) | Bandar Bukit Raja（Klang, Selangor） | 2-storey link | RM797,888 | 1,700 起 | 20'x75' | 4R3B (Type A) | Freehold | 未公布 | Limited units |
| [Emilia](https://www.simedarbyproperty.com/nilai-impian/emilia) | Nilai Impian（Nilai, Negeri Sembilan） | 2-storey link | RM639,888 | 1,781–2,090 | 20'x65' | 4R | Freehold | 未公布 |  |
| [Suasana](https://www.simedarbyproperty.com/bandar-ainsdale/suasana-ainsdale) | Bandar Ainsdale（Seremban, Negeri Sembilan） | 2-storey link | RM557,899 | 未公布 | 20'x70' | — | Freehold | 未公布 |  |
| [Avira Hills 2](https://www.simedarbyproperty.com/bandar-ainsdale/avira-hills-2/) | Bandar Ainsdale（Seremban, Negeri Sembilan） | 2-storey terrace | 未公布 | 1,754 起 | 20'x70' / 22'x70' | 4R3B | Freehold | 2026 (completed) | Move-in ready; price not published |
| [East 61](https://www.simedarbyproperty.com/kl-east/east-61/) | KL East（Kuala Lumpur, Kuala Lumpur） | 3-storey superlink | RM2,789,000 | 3,574–4,196 | 26'x82' | up to 6+1R | Freehold | 未公布 |  |
| [Triara Residences](https://www.simedarbyproperty.com/ara-damansara/triara) | Ara Damansara（Petaling Jaya, Selangor） | Condominium | RM850,000 | 1,216–1,808 | — | 3-4R | Freehold | 未公布 |  |
| [The Reya](https://www.simedarbyproperty.com/kl-east/the-reya/) | KL East（Kuala Lumpur, Kuala Lumpur） | Condominium | RM899,000 | 1,350–2,210 | — | 3+1R (Type A1) | Freehold | 未公布 |  |
| [Hype Residences](https://www.simedarbyproperty.com/sj7/hype-residences) | SJ7（Subang Jaya, Selangor） | Serviced residence | RM650,000 | 未公布 | — | — | Freehold | 未公布 |  |
| [Damayan Residences](https://www.simedarbyproperty.com/putra-heights/damayan/) | Subang Jaya（Subang Jaya, Selangor） | Serviced residence | RM590,000 | 838–1,178 | — | 2-3R | Freehold | 未公布 |  |
| [Serasi Residences](https://www.simedarbyproperty.com/putra-heights/serasi-residences/) | Putra Heights（Subang Jaya, Selangor） | Service apartment | RM250,000 | 550–850 | — | 1+1 to 3R | Freehold | 未公布 | Type C 550 sqft RM250k; Type A 668 sqft RM380k; Type B 850 sqft RM470k |
| [SJCC East One](https://www.simedarbyproperty.com/sjcc/east1/) | Subang Jaya City Centre（Subang Jaya, Selangor） | Serviced residence | 未公布 | 682 起 | — | — | Freehold | 未公布 | Phase 2 open for sale; price not published |
| [The Ophera](https://www.simedarbyproperty.com/klgcc-resort/theophera/) | KLGCC Resort（Bukit Kiara, Kuala Lumpur） | Condominium | 未公布 | 未公布 | — | — | Leasehold (per listing page) | 未公布 | Price and sizes not published |

**说明：**
- **Serenia Baleria** 在官网列表标为 Upcoming，但项目页已经公布价格、户型和完工日期，所以放在在售。
- **Tiara Residences 1** 的起价来自 2026/7/6 新闻稿（官网列表没有写价格）。
- 起价是官网写的「from」价格，通常是最小的中间单位，角头和尾端单位会比较贵。

## 2. 状态要再确认

| 项目 | Township（地区） | 类型 | 起价 | 建筑面积（sq ft） | 地段 | 房间 | 地契 | 预计完工 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| [Ara Bloc Residences](https://www.simedarbyproperty.com/ara-damansara/arabloc/) | Ara Damansara（Petaling Jaya, Selangor） | Serviced apartment | 未公布 | 767–1,238 | — | 2 to 3+1R | Freehold (per listing page) | 未公布 | Status conflicting between listing and project page |
| [Arina 2](https://www.simedarbyproperty.com/bandar-ainsdale/arina/) | Bandar Ainsdale（Seremban, Negeri Sembilan） | Single-storey link | RM467,888 | 1,010 起 | 20'x70' | 3R2B | Freehold (per listing page) | 未公布 | Show unit ready; registration open |
| [Avira Hills](https://www.simedarbyproperty.com/bandar-ainsdale/avira-hills/) | Bandar Ainsdale（Seremban, Negeri Sembilan） | 2-storey terrace | 未公布 | 1,754–1,937 | 20'x70' / 22'x70' | 4R3B | Freehold | 未公布 |  |

## 3. 建造中、可能还有剩余单位

官网标为 Under Construction，并列出起价。这些项目可能已经卖完，也可能还有单位，官网没有说明。

| 项目 | Township（地区） | 类型 | 起价 | 建筑面积（sq ft） | 地段 | 房间 | 地契 | 预计完工 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| [Elmina Green Seven](https://www.simedarbyproperty.com/city-of-elmina/elmina-green-seven) | City of Elmina（Shah Alam, Selangor） | 2-storey link | RM1,054,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [The Eighth, Elmina Green](https://www.simedarbyproperty.com/city-of-elmina/the-eighth-elmina-green) | City of Elmina（Shah Alam, Selangor） | Semi-detached | RM1,252,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Ilham Residence 3](https://www.simedarbyproperty.com/city-of-elmina/ilham-residence-3) | City of Elmina（Shah Alam, Selangor） | 2-storey link | RM903,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Elmina Green Six](https://www.simedarbyproperty.com/city-of-elmina/elmina-green-six) | City of Elmina（Shah Alam, Selangor） | 2-storey link | RM1,018,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Nadira 3](https://www.simedarbyproperty.com/bandar-bukit-raja/nadira-3) | Bandar Bukit Raja（Klang, Selangor） | 2-storey link | RM924,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Serenia Anira](https://www.simedarbyproperty.com/serenia-city/serenia-anira) | Serenia City（Sepang, Selangor） | 2-storey link | RM974,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Serenia Anisa](https://www.simedarbyproperty.com/serenia-city/serenia-anisa) | Serenia City（Sepang, Selangor） | 2-storey link | RM824,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Serenia Aqila](https://www.simedarbyproperty.com/serenia-city/serenia-aqila) | Serenia City（Sepang, Selangor） | Semi-detached | RM1,712,888 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |
| [Park One Melawati](https://www.simedarbyproperty.com/melawati/park-one) | Melawati（Kuala Lumpur, Kuala Lumpur） | Serviced residence | RM760,000 | 未公布 | — | — | Freehold | 未公布 | May still have remaining units |

## 4. 即将推出

| 项目 | Township（地区） | 类型 | 起价 | 建筑面积（sq ft） | 地段 | 房间 | 地契 | 预计完工 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| [Seroja Gardens Phase 2](https://www.simedarbyproperty.com/nilai-impian/seroja-gardens) | Nilai Impian（Nilai, Negeri Sembilan） | Single-storey semi-D | RM925,888 | 1,971 起 | 40'x80' | 3+1R2B (Phase 1) | Freehold | 未公布 | Phase 2 launching Nov 2026 (GDV RM44m); Phase 1 (52 units, from RM905,888) 100% taken up |
| [Tiara Residences 2](https://www.simedarbyproperty.com/bukit-jelutong/tiara-residences/) | Bukit Jelutong（Shah Alam, Selangor） | 3-storey superlink villa | RM2,100,000 | 3,207 起 | 24'x80' | 5+1R6B | Freehold | 未公布 | Announced for Q3 2026 |
| [Emilia Lakeside](https://www.simedarbyproperty.com/nilai-impian/emilia-lakeside/) | Nilai Impian（Nilai, Negeri Sembilan） | 2-storey link | 未公布 | 1,795–1,850 | — | — | Freehold | 未公布 |  |
| [Elmina Ridge 2](https://www.simedarbyproperty.com/city-of-elmina/elmina-ridge-1) | City of Elmina（Shah Alam, Selangor） | Superlink / cluster / semi-D | 未公布 | 未公布 | — | — | Freehold | 未公布 |  |
| [Kanopi Residences](https://www.simedarbyproperty.com/city-of-elmina/elmina-city-centre/kanopi-residences/) | Elmina City Centre（Shah Alam, Selangor） | Serviced apartment | RM590,888 | 未公布 | — | — | Freehold | 未公布 |  |
| [Harmoni Permai 2](https://www.simedarbyproperty.com/bandar-universiti-pagoh/harmoni-permai) | Bandar Universiti Pagoh（Muar, Johor） | 2-storey link | 未公布 | 未公布 | — | — | Leasehold | 未公布 |  |
| [Lanai Lakeside](https://www.simedarbyproperty.com/bandar-bukit-raja/lanai-lakeside/) | Bandar Bukit Raja（Klang, Selangor） | Semi-D | 未公布 | 未公布 | — | — | Freehold | 未公布 |  |

**说明：**
- **Seroja Gardens 第 1 期**（52 间，起价 RM905,888）在 2026 年 9 月推出后 3 小时内全部售出；**第 2 期预计 2026 年 11 月推出**，起价 RM925,888。官网列表写的起价 RM780,000 应该是旧资料，以新闻稿为准。
- **Tiara Residences 2**：新闻稿说 2026 年第 3 季推出，三层 superlink，起价 RM210 万。

## 5. 资料有冲突或缺失的地方

| 项目 | 问题 | 我们的处理 |
|---|---|---|
| Serenia Baleria | 官网列表写 Upcoming，项目页已有价格 | 放在在售 |
| Seroja Gardens | 官网列表起价 RM780,000；新闻稿第 1 期 RM905,888、第 2 期 RM925,888 | 以新闻稿为准 |
| Tiara Residences | 项目页 Type B 地段一处写 22'x90'，另一处写 24'x80' | 采用新闻稿：第 1 期 Type B 22'x90' |
| Ara Bloc | 官网列表写 New Launch，项目页写 Unveiling soon | 列为「要再确认」 |
| The Ophera、SJCC East One、Hype Residences、Avira Hills 2 | 没有公布起价或面积 | 网站显示「价格请洽销售廊」，第 ④ 步要用户自己填报价 |

## 6. 对网站和数据库的建议

- `sdp_launches` 表直接用 `sdp_launches.csv` 的栏位；`tier` 栏位决定显示在哪个分页（`selling` / `upcoming`；`check` 和 `under_construction` 默认不显示）。
- 第 ③ 步的户型列表：只有 Serenia Baleria、Serasi Residences、The Nine、Adira、Avira Hills、Triara、The Reya、Damayan 等有公布户型名称与面积，其余项目先显示「标准户型」，价格用起价。
- 第 ④ 步计算差额时，标明「以起价估算」或「以你填的销售报价计算」。
