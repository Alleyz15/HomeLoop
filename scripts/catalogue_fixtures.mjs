const row=(id,project,tier,url,extra={})=>({id,project,tier,project_url:"https://www.simedarbyproperty.com/"+url,township:"Serenia City",area:"Sepang",state:"Selangor",category:"landed",property_type:"Terrace",price_from_rm:809888,built_up_min_sqft:1731,built_up_max_sqft:2088,tenure:"Freehold",expected_completion:null,checked_on:"2026-10-14",...extra});
export const catalogueFixtures=[
  row(2,"Serenia Baleria 1 & 2","selling","serenia-city/serenia-baleria/"),
  row(3,"Tiara Residences 1","selling","bukit-jelutong/tiara-residences/",{township:"Bukit Jelutong",area:"Shah Alam",property_type:"2-storey linked villa",price_from_rm:1749888,built_up_min_sqft:2419,built_up_max_sqft:null}),
  row(9,"Avira Hills 2","selling","bandar-ainsdale/avira-hills-2/",{township:"Bandar Ainsdale",area:"Seremban",state:"Negeri Sembilan",price_from_rm:null,built_up_min_sqft:1754,built_up_max_sqft:null,expected_completion:"2026 (completed)"}),
  row(15,"Serasi Residences","selling","putra-heights/serasi-residences/",{township:"Putra Heights",area:"Subang Jaya",category:"high-rise",property_type:"Service apartment",price_from_rm:250000,built_up_min_sqft:550,built_up_max_sqft:850}),
  row(17,"The Ophera","selling","klgcc-resort/theophera/",{township:"KLGCC Resort",area:"Bukit Kiara",state:"Kuala Lumpur",category:"high-rise",property_type:"Condominium",tenure:"Leasehold",price_from_rm:null,built_up_min_sqft:null,built_up_max_sqft:null}),
  row(5,"Adira","selling","bandar-bukit-raja/adira/",{township:"Bandar Bukit Raja",area:"Klang",price_from_rm:869888,built_up_min_sqft:1910,built_up_max_sqft:2174}),
  row(32,"Emilia Lakeside","upcoming","nilai-impian/emilia-lakeside/",{township:"Nilai Impian",area:"Nilai",state:"Negeri Sembilan",price_from_rm:null,built_up_min_sqft:1795,built_up_max_sqft:1850}),
  row(30,"Seroja Gardens Phase 2","upcoming","nilai-impian/seroja-gardens",{township:"Nilai Impian",area:"Nilai",state:"Negeri Sembilan",price_from_rm:925888,built_up_min_sqft:1971,built_up_max_sqft:null}),
  row(31,"Tiara Residences 2","upcoming","bukit-jelutong/tiara-residences/",{township:"Bukit Jelutong",area:"Shah Alam",price_from_rm:2100000,built_up_min_sqft:3207,built_up_max_sqft:null}),
  row(101,"Hidden unconfirmed project","check",""),row(102,"Hidden construction project","under_construction",""),
];
