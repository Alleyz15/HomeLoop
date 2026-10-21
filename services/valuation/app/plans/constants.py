from decimal import Decimal
from typing import Final


PLAN_A_COST_RATE: Final = Decimal("0.115")
PLAN_A_RISK_BUFFER_RATE: Final = Decimal("0.10")
# Formal offers are recomputed by Postgres in private.application_offer.
# Keep these Python indicative rates and the database function in parity.
PLAN_A_OFFER_RATE: Final = 1 - PLAN_A_COST_RATE - PLAN_A_RISK_BUFFER_RATE

PLAN_B_FLOOR_RATE: Final = Decimal("0.75")
SELLER_AGENT_FEE_RATE: Final = Decimal("0.032")
SELLER_LEGAL_FEE_RATE: Final = Decimal("0.012")
PLAN_B_EXPECTED_NET_RATE: Final = 1 - SELLER_AGENT_FEE_RATE - SELLER_LEGAL_FEE_RATE

NEW_HOME_DEPOSIT_RATE: Final = Decimal("0.10")
OLD_HOME_DEPOSIT_RATE: Final = Decimal("0.10")
RPGT_RETENTION_RATE: Final = Decimal("0.03")

MODEL_VERSION: Final = "homeloop-plan-quote-v1"
SIMULATOR_MODEL_VERSION: Final = "homeloop-risk-simulator-v1"

# The stress test in HomeLoop_更新_商业模式.md works in percentages of the
# valuation and only converts to ringgit through its worked example, whose
# valuation is RM786,000. Percentages are the primitive result; this reference
# valuation exists solely to express them in ringgit, and callers can override
# it. It is not a demo scenario and must never be pre-filled into the UI.
REFERENCE_VALUATION_RM: Final = Decimal("786000")

SIMULATOR_NOTE: Final = (
    "Simulation based on the 187 historical backtest errors in SDP townships, "
    "not a forecast. Ringgit amounts restate percentages of the valuation at "
    "the reference valuation; the sample's own mean valuation differs."
)
DISCLAIMER: Final = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)
RPGT_REMINDER: Final = (
    "The buyer retains 3% of the old-home price. File RPGT within 60 days and "
    "pay any tax due within 90 days."
)

