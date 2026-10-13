-- service_role: backend + import script (bypasses RLS, needs table privileges)
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.transactions, public.sdp_schemes, public.mhpi_quarterly,
  public.cost_assumptions, public.fairness_curve, public.backtest_results,
  public.profiles, public.valuation_requests
to service_role;
grant usage, select on all sequences in schema public to service_role;

-- frontend: read-only reference data (RLS policies still apply)
grant usage on schema public to anon, authenticated;
grant select on table
  public.transactions, public.sdp_schemes, public.mhpi_quarterly,
  public.cost_assumptions, public.fairness_curve, public.backtest_results
to anon, authenticated;

-- logged-in users: own rows only (enforced by RLS)
grant select, update on table public.profiles to authenticated;
grant select, insert, delete on table public.valuation_requests to authenticated;