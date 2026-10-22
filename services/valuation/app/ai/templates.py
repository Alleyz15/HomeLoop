from __future__ import annotations

from app.ai.facts import admin_stage_context, build_explanation_facts
from app.schemas import AdminAssistRequest, ExplainValuationRequest


def explain_valuation_template(request: ExplainValuationRequest) -> str:
    facts = build_explanation_facts(request)
    if request.status != "ok" or request.estimate is None:
        return (
            "There are not enough recent sales of similar homes to produce a reliable price range. "
            "The available records do not support a confident preliminary estimate for this home. "
            "This is preliminary guidance, not a formal valuation under Act 242, and a registered "
            "valuer can inspect the property and confirm the final figure if you proceed."
        )

    sales = facts["sales_summary"]
    area = facts["area_name"] or "the selected area"
    earliest = sales["earliest_sale_month"] or "the earliest supplied month"
    latest = sales["latest_sale_month"] or "the latest supplied month"
    confidence_reason = str(facts["confidence_reason"])
    confidence_reason = confidence_reason[:1].lower() + confidence_reason[1:]
    return (
        f"The preliminary estimate is {facts['estimate_rm']}, with a range from "
        f"{facts['low_rm']} to {facts['high_rm']}. "
        f"It is based on {sales['count']} recent sales of similar homes in {area} "
        f"between {earliest} and {latest}. "
        f"Confidence is {facts['confidence']} because "
        f"{confidence_reason} "
        "This is a preliminary estimate, not a formal valuation under Act 242, and a "
        "registered valuer will confirm the final figure if you proceed."
    )


def admin_assist_template(
    request: AdminAssistRequest, mismatches: list[str]
) -> dict[str, object]:
    context = admin_stage_context(request.status)
    if mismatches:
        checks = " The listed inconsistencies need an administrator's review."
    else:
        checks = " The supplied checks raised no inconsistency for review."

    summary = (
        f"This Plan {request.plan} application is at {context['label']}. "
        f"{context['what_happened']} {context['team_next_action']}"
        f"{checks}"
    )
    if context["terminal"]:
        draft = (
            "Draft for admin review: "
            f"{context['what_happened']} "
            f"{context['owner_next_action']}"
        )
    else:
        draft = (
            "Draft for admin review: Here is the latest update on your HomeLoop application. "
            f"{context['what_happened']} {context['owner_next_action']}"
        )

    return {
        "summary": summary,
        "mismatches": mismatches,
        "draft_message": draft,
    }
