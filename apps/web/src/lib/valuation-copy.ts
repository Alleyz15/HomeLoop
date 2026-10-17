type IntermediateAutoFillCopyInput = {
  recentSales: number;
  land: string;
  floor: string;
  typicalShare: number | null;
};

export function intermediateAutoFillCopy({
  recentSales,
  land,
  floor,
  typicalShare,
}: IntermediateAutoFillCopyInput): string {
  if (recentSales === 1) {
    return `Filled in from the only recent sale on this road (${land} land, ${floor} built-up). Please check these match your home.`;
  }
  if (recentSales >= 2 && recentSales < 5) {
    return `Filled in from the ${recentSales} recent sales on this road (${land} land, ${floor} built-up). Please check these match your home.`;
  }
  if (recentSales === 0) {
    return `Filled in from older recorded sales on this road (${land} land, ${floor} built-up). Please check these match your home.`;
  }

  const share = typicalShare == null
    ? ""
    : `, which ${Math.round(typicalShare * 100)}% of these homes share`;
  return `Filled in from this road: ${land} land and ${floor} built-up${share}.`;
}
