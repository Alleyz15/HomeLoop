// Presentation copy only: no eligibility, prices or application states are changed here.
// Sources: HomeLoop_更新_页面与流程.md §5.3–5.4 and the manual-valuation contract.
export type JourneyStep = { id: string; title: string; time: string; body: string; note: string };

export function applicationJourney(plan: "A" | "B", mode: "priced" | "manual", tenure: string | null): JourneyStep[] {
  const isA = plan === "A";
  const registered = isA || mode === "manual";
  const steps: JourneyStep[] = [
    {
      id: "review", title: "Send your application for review", time: "Start here",
      body: "The trade-in team checks your property details, chosen new home and selected plan. They may ask you for missing information.",
      note: "Your part: check your details and submit the form below. This does not accept a purchase offer.",
    },
    mode === "manual" ? {
      id: "consent", title: "Decide whether to arrange a valuation", time: "After the team reviews your application",
      body: "There are not enough recent sales to estimate your old home. The team asks whether you want a registered valuer to assess it. No initial price range is invented.",
      note: "Your choice: agree to proceed or withdraw. PDPA consent on this form is not consent to a visit; you will be asked separately before one is scheduled.",
    } : {
      id: "consent", title: "Review the initial price range", time: "After the team reviews your application",
      body: "The team sends an initial price range based on your saved estimate and chosen plan. It is a guide, not the final offer.",
      note: "Your choice: say you are interested to continue, or stop here. A home visit is arranged only after you agree to proceed.",
    },
    {
      id: "visit", title: registered ? "Meet the registered valuer" : "Arrange a home inspection",
      time: "After you agree to proceed · about 1–2 weeks is a planning assumption",
      body: registered
        ? "A registered valuer visits your old home and confirms its market value. The team records the valuation before preparing a formal offer."
        : "An SDP team member or partner agent visits your old home to check its condition and details. A registered valuation is not normally needed for this priced Plan B path.",
      note: "Your part: agree a visit time and provide access to the property. The team will confirm the actual appointment.",
    },
    {
      id: "offer", title: "Review your formal offer", time: "After the visit · the offer is valid for 14 days",
      body: isA
        ? "The team reviews the confirmed value and sends the amount SDP offers to pay for your old home. Eligibility is checked before an offer is issued."
        : "The team sends the confirmed guarantee floor and its conditions. The floor is the fallback purchase amount, not a promise of the price a market buyer will pay.",
      note: "Your choice: accept, decline, ask for one review, or request a plan switch subject to eligibility. Confirm your financing before accepting.",
    },
    {
      id: "sign", title: isA ? "Sign the agreements and confirm the offset" : "Sign for your new home and pay the deposit",
      time: "After you accept the formal offer",
      body: isA
        ? "The plan assumes you sign the old-home sale agreement and new-home agreement on the same day. The deposit SDP owes on your old home may offset your new-home deposit."
        : "You pay about 10% of the new-home price when signing its sale and purchase agreement. There is no old-home deposit offset in Plan B.",
      note: "The new-home e-SPA is the electronic sale and purchase agreement signed through HIMS, with iDsaya identity verification. Confirm the terms with your lawyer and SDP sales; no booking fee is collected before the SPA.",
    },
  ];
  if (!isA) steps.push(
    {
      id: "market", title: "Let the agent find a buyer", time: "Buyer search: 0–9 months is a simulation assumption",
      body: "A partner agent lists your old home and arranges viewings. If it has not sold by the agreed guarantee deadline, SDP buys it at the confirmed floor, subject to the agreed conditions.",
      note: "Your part: keep the home available for viewings. Confirm the guarantee deadline and conditions in your offer; the website does not promise a buyer date.",
    },
    {
      id: "old-spa", title: "Sign the old-home sale agreement", time: "After finding a buyer · about 14 working days is a guide",
      body: "You and the buyer sign the old-home sale and purchase agreement, and the buyer brings their deposit to 10%. If the guarantee is triggered instead, the team explains the SDP purchase paperwork.",
      note: "Signing is not the same as receiving all the sale proceeds. The transfer and the buyer’s payment still need to complete.",
    },
  );
  if (tenure?.toLowerCase().includes("leasehold")) steps.push({
    id: "consent-state", title: "Allow time for state consent", time: "Leasehold only · allow an additional 1–3 months",
    body: "Your lawyer checks and applies for the state permission needed to transfer a leasehold property. This can delay completion.",
    note: "The normal transfer-completion period starts after the required consent is received. Your lawyer will confirm the actual dates.",
  });
  steps.push(
    {
      id: "complete", title: isA ? "Complete the direct purchase" : "Receive the old-home sale proceeds",
      time: isA ? "About 1–3 months after acceptance is a planning assumption" : "About 3–4 months after the old-home SPA · roughly 3–13 months overall",
      body: isA
        ? "SDP completes the old-home purchase. The sale proceeds are settled after repaying any outstanding old-home loan, applicable tax retention and agreed costs."
        : "The market sale or agreed guarantee purchase completes. The sale proceeds are settled after repaying any outstanding old-home loan, applicable tax retention and agreed costs.",
      note: isA
        ? "Your part: ask your lawyer for the final payment statement. The purchase price shown earlier is not the amount you will necessarily receive in your bank account."
        : "Prepare your new-home deposit first: old-home proceeds may take more than a year to arrive. Ask your lawyer for the final payment statement.",
    },
    {
      id: "handover", title: "Collect the keys to your new home", time: "Usually 24 or 36 months after the new-home agreement, depending on its terms",
      body: "SDP confirms when your new home is ready for handover. Follow the date and requirements in your signed agreement, rather than treating this planning timeline as a promised moving date.",
      note: "Your part: coordinate your move with SDP and the team. Your old-home sale and new-home handover may happen at different times.",
    },
  );
  return steps;
}
