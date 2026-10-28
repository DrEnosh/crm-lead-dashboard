# CRM Lead Stage Dashboard

A browser dashboard for exploring a CRM export of leads: how many there are, where they came from, and how they move through the pipeline. No build step and no dependencies.

![Dashboard walkthrough](dashboard_recording.mp4)

## What it shows

- **Key totals** for the filtered set of leads
- **Proportional breakdown** of leads by stage
- **Conversion funnel** across lead stages
- **Monthly stage trends** and **weekly velocity** for the last 8 weeks
- **Top acquisition sources**
- **Filters** by state and source, applied across every chart

## Data

The dashboard reads two CSV files from this folder and merges them: `Closed Leads Data.csv` and `Touched Leads Data.csv`. Both have the columns:

`State, City, User Registration Date, Lead Stage, Primary Registration Campaign, Lead Remark`

The **Source** shown in the charts is taken from `Primary Registration Campaign`: the value is split on `/` and the first part is used.

If you open `index.html` straight from disk, the browser may block it from loading the CSVs. Either run the local server below or use the manual CSV loader inside the dashboard.

## Run it

You need Node.js. From this folder:

```bash
node server.js
```

Then open http://127.0.0.1:8080. Set the `PORT` environment variable to use another port.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The dashboard |
| `server.js` | Small static file server (no packages needed) |
| `*.csv` | Lead data |
| `dashboard_recording.mp4` | Short screen recording of the dashboard |
