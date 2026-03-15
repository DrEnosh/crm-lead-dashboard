# CRM Lead Stage Dashboard

Run the dashboard from this folder with:

```powershell
node server.js
```

Then open `http://127.0.0.1:8080`.

Notes:

- The dashboard automatically merges `Closed Leads Data.csv` and `Touched Leads Data.csv`.
- The `Source` field is derived from `Primary Registration Campaign` by splitting on `/` and taking the first segment.
- If you open [`index.html`](./index.html) directly from disk, browser security may block auto-loading the CSVs. In that case, use the manual CSV loader inside the dashboard.
