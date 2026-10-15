from __future__ import annotations

from app.ai.facts import build_explanation_facts
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
    stage = request.status or "current"
    if mismatches:
        summary = (
            f"This Plan {request.plan} application is at the {stage} stage. "
            "The deterministic checks below need an administrator's review before the case proceeds."
        )
        owner_detail = "We need to review a few differences in the submitted information."
    else:
        summary = (
            f"This Plan {request.plan} application is at the {stage} stage. "
            "The deterministic checks found no size, confidence, or valuation mismatch to highlight."
        )
        owner_detail = "We are reviewing the information already provided."

    return {
        "summary": summary,
        "mismatches": mismatches,
        "draft_message": (
            "Draft for admin review: Thank you for your HomeLoop application. "
            f"{owner_detail} An administrator will review the case before this message is sent."
        ),
    }
