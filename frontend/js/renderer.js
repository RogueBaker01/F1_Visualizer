// ═══════════════════════════════════════════════════════════════════════════
// renderer.js — SVG rendering + standings + event toasts
// Uses SEASON_DRIVERS / SEASON_TEAMS from races.js (loaded first)
// ═══════════════════════════════════════════════════════════════════════════

// Active season data (set by initSeasonData)
let DRIVERS = {};
let TEAMS   = {};

function initSeasonData(year) {
    DRIVERS = SEASON_DRIVERS[year] || SEASON_DRIVERS[2023];
    TEAMS   = SEASON_TEAMS[year]   || SEASON_TEAMS[2023];
    // Reset SVG and standings
    resetVisualizer();
}

function getDriverColor(id) {
    const d = DRIVERS[String(id)];
    return d ? (TEAMS[d.team]?.color || '#fff') : '#fff';
}

function getDriverAbbr(id) {
    return DRIVERS[String(id)]?.abbr || String(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG & State
// ═══════════════════════════════════════════════════════════════════════════
const svg = document.getElementById('track-svg');
const driverNodes = {};
let circuitDrawn = false;
let raceStartMs  = 0;
const POSITION_ORDER = {};

function resetVisualizer() {
    // Clear SVG (keep the element, remove children)
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Object.keys(driverNodes).forEach(k => delete driverNodes[k]);
    Object.keys(POSITION_ORDER).forEach(k => delete POSITION_ORDER[k]);
    circuitDrawn = false;
    raceStartMs  = 0;
    // Clear standings and events
    document.getElementById('standings-body').innerHTML = '';
    document.getElementById('event-log').innerHTML = '';
    document.getElementById('current-lap').textContent = '0';
    document.getElementById('time-display').textContent = '00:00:00';
    standingsBuilt = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Circuit drawing
// ═══════════════════════════════════════════════════════════════════════════
function drawCircuit(path) {
    if (circuitDrawn || !path || path.length < 2) return;
    circuitDrawn = true;

    const pts = path.map(p => `${p.x},${p.y}`).join(' ');

    const layers = [
        { stroke: '#1a1a28', width: 26, dash: null },   // outer border
        { stroke: '#252530', width: 22, dash: null },   // tarmac base
        { stroke: '#1c1c28', width: 18, dash: null },   // racing surface
        { stroke: '#ffffff10', width: 1,  dash: '6 14' }, // centre dashes
    ];

    layers.forEach(({ stroke, width, dash }) => {
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', pts);
        pl.setAttribute('fill', 'none');
        pl.setAttribute('stroke', stroke);
        pl.setAttribute('stroke-width', width);
        pl.setAttribute('stroke-linecap', 'round');
        pl.setAttribute('stroke-linejoin', 'round');
        if (dash) pl.setAttribute('stroke-dasharray', dash);
        svg.insertBefore(pl, svg.firstChild);
    });

    // Start/finish line at first point
    const sx = path[0].x, sy = path[0].y;
    const nx = path[1].x - sx, ny = path[1].y - sy;
    const len = Math.sqrt(nx*nx + ny*ny) || 1;
    // Perpendicular vector
    const px = -ny/len * 14, py = nx/len * 14;
    const sfLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    sfLine.setAttribute('x1', sx + px); sfLine.setAttribute('y1', sy + py);
    sfLine.setAttribute('x2', sx - px); sfLine.setAttribute('y2', sy - py);
    sfLine.setAttribute('stroke', '#ffffff');
    sfLine.setAttribute('stroke-width', '3');
    svg.insertBefore(sfLine, svg.firstChild);
}

// ═══════════════════════════════════════════════════════════════════════════
// Driver dots
// ═══════════════════════════════════════════════════════════════════════════
function renderFrame(positions) {
    positions.forEach(pos => {
        const id    = String(pos.driver_id);
        const color = getDriverColor(id);
        const abbr  = getDriverAbbr(id);
        let   node  = driverNodes[id];

        if (!node) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            // Glow halo
            const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            halo.setAttribute('r', 13);
            halo.setAttribute('fill', color);
            halo.setAttribute('opacity', '0.25');
            g.appendChild(halo);

            // Main circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', 8);
            circle.setAttribute('fill', color);
            circle.setAttribute('stroke', '#000');
            circle.setAttribute('stroke-width', '1.5');
            g.appendChild(circle);

            // Label background
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', 26);
            rect.setAttribute('height', 12);
            rect.setAttribute('rx', 2);
            rect.setAttribute('fill', '#000000cc');
            rect.setAttribute('x', 10);
            rect.setAttribute('y', -6);
            g.appendChild(rect);

            // Label text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = abbr;
            text.setAttribute('fill', color);
            text.setAttribute('font-size', '8.5');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('font-family', 'Roboto Mono, monospace');
            text.setAttribute('x', 12);
            text.setAttribute('y', 4);
            g.appendChild(text);

            svg.appendChild(g);
            driverNodes[id] = g;
        }

        driverNodes[id].setAttribute(
            'transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Race standings
// ═══════════════════════════════════════════════════════════════════════════
let standingsBuilt = false;

function buildStandingsRows() {
    const body = document.getElementById('standings-body');
    body.innerHTML = '';
    Object.entries(DRIVERS).forEach(([num, d]) => {
        const team  = TEAMS[d.team] || { color: '#888' };
        const row   = document.createElement('div');
        row.className = 'standing-row';
        row.id        = `srow-${num}`;
        row.title     = d.name;
        row.innerHTML = `
            <span class="spos" id="spos-${num}">--</span>
            <span class="sbar" style="background:${team.color}"></span>
            <span class="sabbr" style="color:${team.color}">${d.abbr}</span>
            <span class="sname">${d.name}</span>
            <span class="slap" id="slap-${num}">—</span>
        `;
        body.appendChild(row);
    });
    standingsBuilt = true;
}

function updateStandingsTable(racePositions) {
    if (!standingsBuilt) buildStandingsRows();
    if (!racePositions || Object.keys(racePositions).length === 0) return;

    Object.entries(racePositions).forEach(([dNum, info]) => {
        POSITION_ORDER[dNum] = info;
    });
    // Fill in any missing drivers
    Object.keys(DRIVERS).forEach(dNum => {
        if (!POSITION_ORDER[dNum]) POSITION_ORDER[dNum] = { pos: null, lap: 0 };
    });

    const sorted = Object.entries(POSITION_ORDER).sort(([,a], [,b]) => {
        return (a.pos ?? 99) - (b.pos ?? 99);
    });

    const body = document.getElementById('standings-body');
    sorted.forEach(([dNum, info]) => {
        const posEl = document.getElementById(`spos-${dNum}`);
        const lapEl = document.getElementById(`slap-${dNum}`);
        const rowEl = document.getElementById(`srow-${dNum}`);
        if (!posEl || !rowEl) return;

        posEl.textContent = info.pos ? `P${info.pos}` : '--';
        posEl.style.color = info.pos === 1 ? '#ffd700'
                          : info.pos <= 3  ? '#c0c0c0'
                          :                  '#666';
        if (lapEl) lapEl.textContent = info.lap ? `V${info.lap}` : '—';
        body.appendChild(rowEl);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Event toasts
// ═══════════════════════════════════════════════════════════════════════════
const EVENT_COLORS = {
    pit_in:       '#ff9800',
    pit_out:      '#4caf50',
    dnf:          '#f44336',
    track_status: '#ffeb3b',
};

function showEvent(event) {
    const color = EVENT_COLORS[event.type] || '#ccc';
    const log   = document.getElementById('event-log');
    const toast = document.createElement('div');
    toast.className = 'event-toast';
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<span style="color:${color}">${event.message}</span>`;
    log.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 5500);
}

// ═══════════════════════════════════════════════════════════════════════════
// Time display
// ═══════════════════════════════════════════════════════════════════════════
function updateTimeDisplay(ms) {
    const elapsed = Math.max(0, ms - raceStartMs);
    const s = Math.floor(elapsed / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    document.getElementById('time-display').textContent =
        `${String(h).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}