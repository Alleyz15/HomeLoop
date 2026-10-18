import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogueLaunch } from "./catalogue-model";

const FIELDS = "id,tier,project,township,area,state,category,property_type,price_from_rm,built_up_min_sqft,built_up_max_sqft,tenure,expected_completion,project_url,checked_on";

export async function getCatalogue(): Promise<{ launches: CatalogueLaunch[]; error: boolean }> {
  try {
    const client = await createClient();
    const launches: CatalogueLaunch[] = [];
    let offset = 0;
    while (true) {
      const result = await client.from("sdp_launches").select(FIELDS, { count: "exact" })
        .in("tier", ["selling", "upcoming"]).order("project").order("id").range(offset, offset + 99);
      if (result.error || result.count == null) throw new Error("Catalogue unavailable");
      const batch = result.data ?? [];
      if (!batch.length && offset < result.count) throw new Error("Incomplete catalogue");
      launches.push(...batch as CatalogueLaunch[]);
      offset += batch.length;
      if (offset >= result.count) return { launches, error: false };
    }
  } catch { return { launches: [], error: true }; }
}
