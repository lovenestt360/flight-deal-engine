# Flight Deal Engine

Global flight-deal engine focused on the lowest legitimate executable cash cost.


## Miles Acquisition Market

The engine can evaluate where to acquire the loyalty currency needed for an award, starting from zero miles.

- `GET /api/engine/miles-market`
  - compares direct purchase and transferable-source paths
  - applies annual purchase caps and new-member restrictions
  - calculates the break-even purchase price versus a cash ticket
  - keeps login-only prices as unknown rather than guessing
- `POST /api/engine/evaluate-quote`
  - evaluates a real checkout quote collected from a loyalty program
  - supports bonus miles and optional FX conversion
  - determines whether the observed quote actually beats the cash fare

Example:

```
/api/engine/miles-market?targetProgram=qatar&targetMiles=86500&cashBaselineUSD=1096&awardTaxesUSD=180&accountMode=new
```

Important: award taxes supplied to the market endpoint must be confirmed or clearly marked as an estimate. Never buy miles using only a theoretical or stale award.
