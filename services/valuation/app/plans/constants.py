from typing import Final


PLAN_A_COST_RATE: Final = 0.115
PLAN_A_RISK_BUFFER_RATE: Final = 0.10
PLAN_A_OFFER_RATE: Final = 1 - PLAN_A_COST_RATE - PLAN_A_RISK_BUFFER_RATE

PLAN_B_FLOOR_RATE: Final = 0.75
SELLER_AGENT_FEE_RATE: Final = 0.032
SELLER_LEGAL_FEE_RATE: Final = 0.012
PLAN_B_EXPECTED_NET_RATE: Final = 1 - SELLER_AGENT_FEE_RATE - SELLER_LEGAL_FEE_RATE

NEW_HOME_DEPOSIT_RATE: Final = 0.10
OLD_HOME_DEPOSIT_RATE: Final = 0.10
RPGT_RETENTION_RATE: Final = 0.03

MODEL_VERSION: Final = "homeloop-plan-quote-v1"
DISCLAIMER: Final = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)
RPGT_REMINDER: Final = (
    "The buyer retains 3% of the old-home price. File RPGT within 60 days and "
    "pay any tax due within 90 days."
)

