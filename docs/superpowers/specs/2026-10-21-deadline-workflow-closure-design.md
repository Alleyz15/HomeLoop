# HomeLoop deadline workflow closure design

## Scope

This change closes three independent prototype gaps without changing the
published financial formulas or adding a valuer account:

1. A Plan B application switched once to Plan A can be scheduled for a new
   registered valuation and can record the external valuer's new confirmed
   value.
2. Admins can use the existing `/simulator/run` contract through a protected
   `/admin/simulator` page.
3. AI grounding recognises English number words as numbers, closing the current
   digit-only bypass.

The SQL/TypeScript flag thresholds remain unchanged. Their required 10% and
80% parity is documented explicitly.

## Plan B to Plan A registered valuation

The owner still creates one application and may switch plan once only after a
formal offer. A B-to-A switch keeps the previous Plan B confirmed value as a
reference, clears the old offer and appointment, and enters
`inspection_scheduled`.

An admin-only `schedule_plan_a_valuation` RPC records the new appointment. It
is callable only when the locked application is Plan A, has one recorded plan
switch, is in `inspection_scheduled`, has no appointment, and has a recorded
B-to-A switch event. The status remains `inspection_scheduled`; exactly one
same-stage audit event is written.

After the external registered valuer completes the visit, the admin records
the new confirmed value through the existing `record_inspection` signature.
For a B-to-A case the registered valuer and valuation basis are mandatory in
the private note. The prior confirmed value is shown as a reference and is
preserved in the event payload. An owner-visible explanation is mandatory when
the new value differs at all from the prior Plan B value, and remains mandatory
when the value is outside the saved AI range. The database then calculates the
Plan A formal purchase price through the existing 78.5% formula; the admin
cannot enter an offer amount.

## Admin risk simulator

`/admin/simulator` is protected by the existing admin layout and calls the
server-only `simulate()` helper. Initial slider values come from the API's
returned `inputs`, not duplicated constants. Changes are sent to a server
action; the internal API key never reaches the browser. Results lead with
percentages and label every RM figure with its reference-valuation basis.

## AI number grounding

The number guard parses English cardinal number phrases, including hyphenated
forms and hundred/thousand/million scales. Parsed values use the same grounding
rules as digit values. Fabricated word-numbers cause a `number_guard` template
fallback; grounded word-numbers remain valid.

## Security and compatibility

- New SQL is a new migration only.
- The new RPC is `SECURITY DEFINER`, has `search_path = ''`, locks the
  application, checks `private.is_admin()`, revokes `PUBLIC`/`anon`, and grants
  only `authenticated`.
- Existing application columns, formulas, offer preview contract and API
  response shapes are unchanged.
- No service-role key or secret is added to app code.

