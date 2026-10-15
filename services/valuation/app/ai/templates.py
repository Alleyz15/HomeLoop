from __future__ import annotations

from app.schemas import AdminAssistRequest, ExplainValuationRequest


def _rm(value: float) -> str:
    return f"RM{round(value):,}"


def explain_valuation_template(request: ExplainValuationRequest) -> str:
    if request.status != "ok" or request.estimate is None:
        return (
            "There are not enough recent comparable sales to produce a reliable price range. "
            "The available records do not support a confident preliminary estimate for this home. "
            "A registered valuer can inspect the property and assess it directly. "
            "This is preliminary guidance, not a formal valuation under Act 242."
        )

    confidence_reason = {
        "high": "the comparable prices form a relatively tight range",
        "medium": "the comparable prices show some variation",
        "low": "the comparable prices vary widely",
    }[request.confidence or "low"]
    return (
        f"The preliminary estimate is {_rm(request.estimate)}, with a range from "
        f"{_rm(request.low or request.estimate)} to {_rm(request.high or request.estimate)}. "
        f"Confidence is {request.confidence or 'low'} because {confidence_reason}. "
        "The supplied comparable sales show what similar homes in the same area have recently achieved. "
        "This is preliminary guidance, not a formal valuation under Act 242."
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
