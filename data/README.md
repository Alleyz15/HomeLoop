# Local data

Raw NAPIC Open Transaction Data, Malaysian House Price Index (MHPI) files, and processed CSVs live in this directory on each developer's machine. They are never committed to Git.

The importer recognises these files under a directory such as `data/processed`:

- `out_transactions_clean.csv`
- `out_sdp_schemes.csv`
- `mhpi_quarterly.csv`
- `cost_assumptions.csv`
- `out_fairness.csv`
- `out_backtest.csv`

Spreadsheet source files are also local-only.

`out_transactions_clean.csv` has no stable row identifier. The importer therefore refuses to load it when the `transactions` table already contains rows; this prevents a retry from silently creating duplicates.

