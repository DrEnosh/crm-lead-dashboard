// app.js
const STAGES = ['NOT REACHABLE', 'CLOSED', 'COLD', 'HOT', 'WARM', 'SUBMITTED'];
const FUNNEL_STAGES = ['TOTAL', 'NOT REACHABLE', 'COLD', 'WARM', 'HOT', 'SUBMITTED', 'CLOSED'];
const STAGE_COLORS = {
    'NOT REACHABLE': '#6b7280',
    'CLOSED': '#374151',
    'COLD': '#60a5fa',
    'WARM': '#f59e0b',
    'HOT': '#ef4444',
    'SUBMITTED': '#10b981',
    'TOTAL': '#6366f1'
};
const TOP_SOURCES = ['KollegeApply', 'CollegeDunia', 'Facebook', 'EduFairDataApts', 'Chat', 'Adsgrip'];

// ───── STATE ─────
let rawData = [];
let filteredData = [];
let charts = {};
let activeSection = 'overview';
const renderedSections = new Set();

// ───── HELPERS ─────
function parseDate(str) {
    if (!str) return null;
    const parts = str.split(',')[0].trim().split('/');
    if (parts.length < 3) return null;
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
}

function getMonthKey(date) {
    if (!date) return null;
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function getWeekStart(date) {
    if (!date) return null;
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
}

function normalizeSource(raw) {
    const rawLower = (raw || '').trim().toLowerCase();
    const map = {
        'kollegeapply': 'KollegeApply',
        'collegedunia': 'CollegeDunia',
        'facebook': 'Facebook',
        'edufairdataapts': 'EduFairDataApts',
        'chat': 'Chat',
        'adsgrip': 'Adsgrip'
    };
    return map[rawLower.split('/')[0]] || raw.split('/')[0].trim();
}

function formatNum(n) { return (n || 0).toLocaleString(); }
function formatPct(n, tot) { return tot ? (n / tot * 100).toFixed(1) + '%' : '0%'; }

// ───── INIT ─────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        setupFilters();
        setupNavigation();
        
        // Hide loader
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);

        // Initial render
        applyFilters();

    } catch (err) {
        console.error(err);
        document.getElementById('loaderMessage').innerHTML = `<span style="color:#ef4444">Error: ${err.message}</span><br>Make sure CSV files are hosted on a server.`;
        document.querySelector('.spinner').style.display = 'none';
    }
});

async function loadData() {
    const files = ['Touched Leads Data.csv', 'Closed Leads Data.csv'];
    const rows = [];
    
    for (const file of files) {
        const text = await fetch(file).then(r => r.text());
        Papa.parse(text, { header: true, skipEmptyLines: true }).data.forEach(row => {
            const date = parseDate(row['User Registration Date']);
            rows.push({
                stage: (row['Lead Stage'] || '').trim().toUpperCase(),
                state: (row['State'] || '').trim(),
                source: normalizeSource(row['Primary Registration Campaign']),
                date: date,
                month: getMonthKey(date)
            });
        });
    }
    
    // Sort chronologically
    rows.sort((a,b) => (a.date && b.date) ? a.date - b.date : 0);
    rawData = rows;
    filteredData = [...rawData];
    
    // Populate dropdown options
    const states = [...new Set(rawData.map(r => r.state).filter(Boolean))].sort();
    const sources = [...new Set(rawData.map(r => r.source).filter(Boolean))].sort();
    const months = [...new Set(rawData.map(r => r.month).filter(Boolean))].sort();
    
    const pop = (id, vals) => {
        const sel = document.getElementById(id);
        vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    };
    
    pop('stateFilter', states);
    pop('sourceFilter', sources);
    pop('monthFilter', months);
    
    document.getElementById('dbStatus').textContent = `${formatNum(rawData.length)} Leads Loaded`;
}

// ───── NAVIGATION & UI ─────
function setupNavigation() {
    // Section Switcher
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget.dataset.target;
            e.currentTarget.classList.add('active');
            
            document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
            document.getElementById('sec-' + target).classList.add('active');
            
            activeSection = target;
            
            // Update Header Title
            const titles = {
                overview: { t: 'Executive Overview', d: 'High-level metrics and stage distribution across the pipeline.' },
                funnel: { t: 'Funnel Analysis', d: 'Ordered progression from Total Acquisition down to Closed Won.' },
                trends: { t: 'Time Trends', d: 'Monthly pipeline flow and Weekly velocity performance.' },
                sources: { t: 'Source Performance', d: 'Lead acquisition channels overlaid with conversion metrics.' },
                geography: { t: 'Geography Heatmap', d: 'Intensity of lead volume distributed across geographical states.' },
                deepdive: { t: 'Quality Deep Dive', d: 'Drill-downs into high-intent HOT pipelines and SUBMITTED applications.' }
            };
            document.getElementById('activeSectionTitle').textContent = titles[target].t;
            document.getElementById('activeSectionDesc').textContent = titles[target].d;
            
            // Lazy load charts
            renderSection(target);
        });
    });

    // Filter Panel Toggle
    document.getElementById('toggleFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterPanel').classList.toggle('open');
    });
    document.getElementById('closeFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterPanel').classList.remove('open');
    });
}

// ───── FILTERS ─────
function setupFilters() {
    // Chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const isAll = e.target.dataset.val === 'ALL';
            if (isAll) {
                const active = e.target.classList.contains('active');
                document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', !active));
            } else {
                e.target.classList.toggle('active');
                const others = document.querySelectorAll('.chip:not([data-val="ALL"])');
                const allActive = Array.from(others).every(c => c.classList.contains('active'));
                document.querySelector('.chip[data-val="ALL"]').classList.toggle('active', allActive);
            }
        });
    });

    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        applyFilters();
        document.getElementById('filterPanel').classList.remove('open');
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.add('active'));
        document.getElementById('stateFilter').value = 'ALL';
        document.getElementById('sourceFilter').value = 'ALL';
        document.getElementById('monthFilter').value = 'ALL';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        applyFilters();
    });
}

function applyFilters() {
    // Get filter values
    const chips = Array.from(document.querySelectorAll('.chip.active:not([data-val="ALL"])')).map(c => c.dataset.val);
    const hasAllChips = document.querySelector('.chip[data-val="ALL"]').classList.contains('active');
    const allowedStages = hasAllChips ? null : chips;
    
    const st = document.getElementById('stateFilter').value;
    const src = document.getElementById('sourceFilter').value;
    const mo = document.getElementById('monthFilter').value;
    const dFrom = document.getElementById('dateFrom').value ? new Date(document.getElementById('dateFrom').value) : null;
    let dTo = document.getElementById('dateTo').value ? new Date(document.getElementById('dateTo').value) : null;
    if (dTo) dTo.setHours(23, 59, 59);

    // Apply
    filteredData = rawData.filter(r => {
        if (allowedStages && !allowedStages.includes(r.stage)) return false;
        if (st !== 'ALL' && r.state !== st) return false;
        if (src !== 'ALL' && r.source !== src) return false;
        if (mo !== 'ALL' && r.month !== mo) return false;
        if (dFrom && r.date && r.date < dFrom) return false;
        if (dTo && r.date && r.date > dTo) return false;
        return true;
    });

    // Update Badge
    let activeFilters = 0;
    if (!hasAllChips) activeFilters++;
    if (st !== 'ALL') activeFilters++;
    if (src !== 'ALL') activeFilters++;
    if (mo !== 'ALL') activeFilters++;
    if (dFrom || dTo) activeFilters++;

    const badge = document.getElementById('activeFiltersBadge');
    badge.textContent = activeFilters;
    badge.classList.toggle('hidden', activeFilters === 0);

    // Redraw
    renderedSections.clear();
    renderKPIs(); // KPIs are always drawn
    renderSection(activeSection);
}

// ───── RENDERING ─────
Chart.defaults.color = '#9ca3af';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';

function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderSection(sec) {
    switch (sec) {
        case 'overview': renderOverview(); break;
        case 'funnel': renderMainFunnel(); break;
        case 'trends': renderTrends(); break;
        case 'sources': renderSources(); break;
        case 'geography': renderGeography(); break;
        case 'deepdive': renderDeepDive(); break;
    }
    renderedSections.add(sec);
}

// -- OVERVIEW --
function renderKPIs() {
    const tot = filteredData.length;
    
    const count = (stage) => filteredData.filter(r => r.stage === stage).length;
    const nr = count('NOT REACHABLE');
    const cl = count('CLOSED');
    const cd = count('COLD');
    const ht = count('HOT');
    const wm = count('WARM');
    const sb = count('SUBMITTED');

    document.getElementById('kpi-total').textContent = formatNum(tot);
    
    document.getElementById('kpi-nr').textContent = formatNum(nr);
    document.getElementById('kpi-nr-sub').textContent = formatPct(nr, tot) + ' of total';
    document.getElementById('pb-nr').style.width = tot ? (nr/tot*100)+'%' : '0%';

    document.getElementById('kpi-closed').textContent = formatNum(cl);
    document.getElementById('kpi-closed-sub').textContent = formatPct(cl, tot) + ' of total';
    document.getElementById('pb-closed').style.width = tot ? (cl/tot*100)+'%' : '0%';

    document.getElementById('kpi-cold').textContent = formatNum(cd);
    document.getElementById('kpi-cold-sub').textContent = formatPct(cd, tot) + ' of total';
    document.getElementById('pb-cold').style.width = tot ? (cd/tot*100)+'%' : '0%';

    document.getElementById('kpi-hotwarm').textContent = formatNum(ht + wm);
    document.getElementById('kpi-hotwarm-sub').textContent = `Hot: ${formatNum(ht)} | Warm: ${formatNum(wm)}`;
    document.getElementById('pb-hotwarm').style.width = tot ? ((ht+wm)/tot*100)+'%' : '0%';

    document.getElementById('kpi-sub').textContent = formatNum(sb);
    document.getElementById('kpi-sub-sub').textContent = formatPct(sb, tot) + ' of total';
    document.getElementById('pb-sub').style.width = tot ? (sb/tot*100)+'%' : '0%';
}

function renderOverview() {
    destroyChart('donut');
    destroyChart('funnelMini');
    
    const tot = filteredData.length;
    const counts = STAGES.map(s => filteredData.filter(r => r.stage === s).length);
    const colors = STAGES.map(s => STAGE_COLORS[s]);
    
    document.getElementById('donut-center-total').querySelector('.val').textContent = formatNum(tot);

    charts.donut = new Chart(document.getElementById('chart-donut'), {
        type: 'doughnut',
        data: {
            labels: STAGES.map(s => s.charAt(0) + s.slice(1).toLowerCase()),
            datasets: [{
                data: counts,
                backgroundColor: colors.map(c => c + 'E6'),
                borderColor: '#161925',
                borderWidth: 4,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10, padding: 16 } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${formatNum(c.raw)} (${formatPct(c.raw, tot)})` } }
            }
        }
    });

    const fVals = FUNNEL_STAGES.map(s => s === 'TOTAL' ? tot : filteredData.filter(r => r.stage === s).length);
    charts.funnelMini = new Chart(document.getElementById('chart-funnel-mini'), {
        type: 'bar',
        data: {
            labels: FUNNEL_STAGES.map(s => s.charAt(0) + s.slice(1).toLowerCase()),
            datasets: [{
                data: fVals,
                backgroundColor: FUNNEL_STAGES.map(s => STAGE_COLORS[s] + 'CC'),
                borderColor: FUNNEL_STAGES.map(s => STAGE_COLORS[s]),
                borderWidth: 1, borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { grid: { display: false } } }
        }
    });
}

// -- FUNNEL --
function renderMainFunnel() {
    destroyChart('funnelMain');
    const tot = filteredData.length;
    const fVals = FUNNEL_STAGES.map(s => s === 'TOTAL' ? tot : filteredData.filter(r => r.stage === s).length);
    
    charts.funnelMain = new Chart(document.getElementById('chart-funnel-main'), {
        type: 'bar',
        data: {
            labels: FUNNEL_STAGES.map(s => s === 'TOTAL' ? 'Total Pipeline' : s.charAt(0) + s.slice(1).toLowerCase()),
            datasets: [{
                data: fVals,
                backgroundColor: FUNNEL_STAGES.map(s => STAGE_COLORS[s] + 'E6'),
                borderColor: FUNNEL_STAGES.map(s => STAGE_COLORS[s]),
                borderWidth: 1, borderRadius: 8, barPercentage: 0.8
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => ` ${formatNum(c.raw)} leads (${formatPct(c.raw, tot)})` } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { grid: { display: false }, ticks: { font: { size: 14, weight: 'bold' } } }
            }
        }
    });
}

// -- TRENDS --
function renderTrends() {
    // Monthly
    destroyChart('monthly');
    const months = ['2025-11', '2025-12', '2026-01', '2026-02'];
    const dsets = STAGES.map(stage => {
        return {
            label: stage.charAt(0) + stage.slice(1).toLowerCase(),
            data: months.map(m => filteredData.filter(r => r.stage === stage && r.month === m).length),
            borderColor: STAGE_COLORS[stage],
            backgroundColor: STAGE_COLORS[stage] + '22',
            borderWidth: 3, tension: 0.3, fill: true, pointRadius: 4
        };
    });

    charts.monthly = new Chart(document.getElementById('chart-monthly'), {
        type: 'line',
        data: { labels: ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026'], datasets: dsets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Weekly
    destroyChart('weekly');
    const wMap = {};
    filteredData.forEach(r => {
        if (!r.date) return;
        const wKey = getWeekStart(r.date).toISOString().split('T')[0];
        if (!wMap[wKey]) wMap[wKey] = [];
        wMap[wKey].push(r);
    });
    
    const sortedK = Object.keys(wMap).sort().slice(-8); // last 8 weeks
    const wLabels = sortedK.map(k => {
        const d = new Date(k);
        return d.toLocaleString('default', { month: 'short' }) + ' ' + d.getDate();
    });

    const highlightTarget = sortedK.findIndex(k => k === '2026-01-12'); // week of Jan 12

    const wStages = ['CLOSED', 'NOT REACHABLE', 'COLD', 'HOT'];
    const wDsets = wStages.map(stage => {
        return {
            label: stage.charAt(0) + stage.slice(1).toLowerCase(),
            data: sortedK.map(k => wMap[k].filter(r => r.stage === stage).length),
            backgroundColor: STAGE_COLORS[stage] + 'CC',
            borderRadius: 4
        };
    });

    charts.weekly = new Chart(document.getElementById('chart-weekly'), {
        type: 'bar',
        data: { labels: wLabels, datasets: wDsets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { 
                    stacked: false, 
                    grid: { display: false },
                    ticks: {
                        color: ctx => ctx.index === highlightTarget ? '#ef4444' : '#9ca3af',
                        font: ctx => ({ weight: ctx.index === highlightTarget ? 'bold' : 'normal' })
                    }
                },
                y: { stacked: false, beginAtZero: true }
            },
            plugins: { legend: { usePointStyle: true } }
        },
        plugins: [{
            id: 'highlightWeek',
            beforeDraw: (chart) => {
                if (highlightTarget > -1) {
                    const ctx = chart.ctx;
                    const xArea = chart.scales.x;
                    const yArea = chart.scales.y;
                    const xL = xArea.getPixelForTick(highlightTarget) - (xArea.width / wLabels.length / 2);
                    const xR = xArea.getPixelForTick(highlightTarget) + (xArea.width / wLabels.length / 2);
                    
                    ctx.save();
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
                    ctx.fillRect(xL, yArea.top, xR - xL, yArea.bottom - yArea.top);
                    ctx.restore();
                }
            }
        }]
    });
}

// -- SOURCES --
function renderSources() {
    destroyChart('sources');
    const dsets = STAGES.map(stage => ({
        label: stage.charAt(0) + stage.slice(1).toLowerCase(),
        data: TOP_SOURCES.map(src => filteredData.filter(r => r.source === src && r.stage === stage).length),
        backgroundColor: STAGE_COLORS[stage] + 'CC',
        borderRadius: 4,
        yAxisID: 'y'
    }));

    const convObj = TOP_SOURCES.map(src => {
        const rows = filteredData.filter(r => r.source === src);
        const closed = rows.filter(r => r.stage === 'CLOSED').length;
        return rows.length ? (closed / rows.length * 100).toFixed(1) : 0;
    });

    dsets.push({
        label: 'Conv Rate %',
        data: convObj,
        type: 'line',
        borderColor: '#a855f7', // purple
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointBackgroundColor: '#a855f7',
        pointRadius: 6,
        yAxisID: 'yconv'
    });

    charts.sources = new Chart(document.getElementById('chart-sources'), {
        type: 'bar',
        data: { labels: TOP_SOURCES, datasets: dsets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false } },
                y: { title: { display: true, text: 'Lead Volume' } },
                yconv: { 
                    position: 'right', 
                    title: { display: true, text: 'Conversion %' },
                    grid: { display: false },
                    ticks: { callback: v => v + '%' },
                    max: 100, min: 0
                }
            }
        }
    });
}

// -- GEOGRAPHY HEATMAP --
function renderGeography() {
    const tableHead = document.getElementById('heatmap-head');
    const tableBody = document.getElementById('heatmap-body');
    tableHead.innerHTML = ''; tableBody.innerHTML = '';

    const sortedStates = Object.entries(filteredData.reduce((acc, r) => {
        if(r.state) acc[r.state] = (acc[r.state]||0) + 1;
        return acc;
    }, {})).sort((a,b)=>b[1]-a[1]).slice(0, 8).map(x => x[0]);

    if(sortedStates.length === 0) return;

    // Header
    let hHTML = `<th>State Geo</th>`;
    STAGES.forEach(s => hHTML += `<th>${s.charAt(0)+s.slice(1).toLowerCase()}</th>`);
    hHTML += `<th>TOTAL</th>`;
    tableHead.innerHTML = hHTML;

    // Find absolute max for color scaling
    let maxV = 0;
    sortedStates.forEach(st => {
        STAGES.forEach(sg => {
            const v = filteredData.filter(r => r.state === st && r.stage === sg).length;
            if (v > maxV) maxV = v;
        });
    });

    // Body
    sortedStates.forEach(st => {
        let tr = `<tr><td>${st}</td>`;
        let tot = 0;
        STAGES.forEach(sg => {
            const v = filteredData.filter(r => r.state === st && r.stage === sg).length;
            tot += v;
            
            // Calc color
            let bg = 'rgba(255,255,255,0.02)';
            let clr = '#9ca3af';
            if (v > 0) {
                const intensity = 0.2 + (v / maxV * 0.8);
                const hex = STAGE_COLORS[sg];
                const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                bg = `rgba(${r}, ${g}, ${b}, ${intensity})`;
                clr = intensity > 0.5 ? '#fff' : '#e5e7eb';
            }
            tr += `<td style="background:${bg}; color:${clr}">${formatNum(v)}</td>`;
        });
        tr += `<td style="font-weight:700">${formatNum(tot)}</td></tr>`;
        tableBody.innerHTML += tr;
    });
}

// -- DEEP DIVE --
function renderDeepDive() {
    ['hot-source', 'hot-state', 'sub-source', 'sub-state'].forEach(id => destroyChart(id));

    const draw = (id, stage, mode) => {
        const subset = filteredData.filter(r => r.stage === stage);
        const aggs = Object.entries(subset.reduce((acc, r) => {
            const k = r[mode];
            if(k) acc[k] = (acc[k]||0)+1;
            return acc;
        }, {})).sort((a,b)=>b[1]-a[1]).slice(0, 6);

        charts[id] = new Chart(document.getElementById(`chart-${id}`), {
            type: 'bar',
            data: {
                labels: aggs.map(x=>x[0]),
                datasets: [{
                    data: aggs.map(x=>x[1]),
                    backgroundColor: stage === 'HOT' ? '#ef4444CC' : '#10b981CC',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display:false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
            }
        });
    };

    draw('hot-source', 'HOT', 'source');
    draw('hot-state', 'HOT', 'state');
    draw('sub-source', 'SUBMITTED', 'source');
    draw('sub-state', 'SUBMITTED', 'state');
}
