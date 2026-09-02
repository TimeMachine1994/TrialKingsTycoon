# Print Kings Tycoon — Inventory Tracker

A local, single-user inventory tracker for a printing business with a 32-bit pixel-art
"Lemonade Tycoon" aesthetic. Tracks purchases (receipts), jobs (sales), waste per job,
weighted-average inventory costs with sub-penny precision, and penny-by-penny
sales-vs-COGS reporting.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Data persists in `data/inventory.db` (SQLite) —
back that file up to back up everything.

## How money works

All money is stored as integer **micro-dollars** ($1 = 1,000,000), so unit costs
below a penny (e.g. $0.0032/sheet) are exact. Displays round to cents; unit costs
show 4 decimals when needed.

## Workflow

1. **Products** — add everything you buy (paper, toner, clips...). Set a base unit
   (what you consume, e.g. *sheet*) and purchase units (e.g. *ream (500)*).
2. **Receipts** — enter a purchase: vendor, date, lines, tax/shipping. Posting adds
   stock and updates each product's weighted-average cost.
3. **Jobs** — create a job with the invoiced amount, then add materials **used** and
   **waste** (with reasons). Costs snapshot the average cost at the time of use.
4. **Products → detail** — full purchase history per item: which vendor, which
   receipt, what unit cost ("what cost where").
5. **Reports** — monthly sales vs COGS vs waste, margin by client/job, waste by product,
   inventory valuation, and efficiency ratios (turnover, days of stock, waste rate,
   months of supply). Each ratio has a `?` tooltip with its formula; the tooltips turn
   red until there are 3+ months of job data, because time-based ratios are noisy before that.
6. **Planner** — break-even and overhead "what-if" scenarios. Each scenario holds
   overhead lines (rent, software, insurance... monthly / yearly / one-time, each can be
   toggled off) plus assumptions (materials % of revenue, avg job value, hours and rate per
   job, jobs per month, growth, target profit). New scenarios start from your actual
   numbers. Results update live: contribution per job, break-even revenue and jobs,
   projected net, payback on one-time costs, and a 12-month projection. Save several and
   open **Compare** to see them side by side against actuals. Mark one **active** and the
   monthly P&L on Reports gains Labor / Overhead / Net columns from it.

Every stock change writes an immutable row to `stock_movements` — the audit ledger.

## Tests

```bash
npm run test    # vitest: money math, weighted-average costing, ratios, break-even
npm run check   # svelte-check
```
