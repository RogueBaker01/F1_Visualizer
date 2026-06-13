// ═══════════════════════════════════════════════════════════════════════════
// Driver & Team data (2023 season)
// ═══════════════════════════════════════════════════════════════════════════
const TEAMS = {
    red_bull:     { name: "Red Bull Racing",  color: "#3671C6", textColor: "#fff" },
    mercedes:     { name: "Mercedes",         color: "#00D2BE", textColor: "#000" },
    ferrari:      { name: "Ferrari",          color: "#E8002D", textColor: "#fff" },
    mclaren:      { name: "McLaren",          color: "#FF8000", textColor: "#000" },
    aston_martin: { name: "Aston Martin",     color: "#358C75", textColor: "#fff" },
    alpine:       { name: "Alpine",           color: "#FF87BC", textColor: "#000" },
    williams:     { name: "Williams",         color: "#64C4FF", textColor: "#000" },
    alphatauri:   { name: "AlphaTauri",       color: "#5E8FAA", textColor: "#fff" },
    alfa_romeo:   { name: "Alfa Romeo",       color: "#C92D4B", textColor: "#fff" },
    haas:         { name: "Haas F1 Team",     color: "#B6BABD", textColor: "#000" },
};

const DRIVERS = {
    "1":  { abbr: "VER", name: "Max Verstappen",    team: "red_bull" },
    "11": { abbr: "PER", name: "Sergio Pérez",       team: "red_bull" },
    "44": { abbr: "HAM", name: "Lewis Hamilton",     team: "mercedes" },
    "63": { abbr: "RUS", name: "George Russell",     team: "mercedes" },
    "16": { abbr: "LEC", name: "Charles Leclerc",    team: "ferrari" },
    "55": { abbr: "SAI", name: "Carlos Sainz",       team: "ferrari" },
    "4":  { abbr: "NOR", name: "Lando Norris",       team: "mclaren" },
    "81": { abbr: "PIA", name: "Oscar Piastri",      team: "mclaren" },
    "14": { abbr: "ALO", name: "Fernando Alonso",    team: "aston_martin" },
    "18": { abbr: "STR", name: "Lance Stroll",       team: "aston_martin" },
    "31": { abbr: "OCO", name: "Esteban Ocon",       team: "alpine" },
    "10": { abbr: "GAS", name: "Pierre Gasly",       team: "alpine" },
    "23": { abbr: "ALB", name: "Alexander Albon",    team: "williams" },
    "2":  { abbr: "SAR", name: "Logan Sargeant",     team: "williams" },
    "22": { abbr: "TSU", name: "Yuki Tsunoda",       team: "alphatauri" },
    "21": { abbr: "DEV", name: "Nyck De Vries",      team: "alphatauri" },
    "77": { abbr: "BOT", name: "Valtteri Bottas",    team: "alfa_romeo" },
    "24": { abbr: "ZHO", name: "Guanyu Zhou",        team: "alfa_romeo" },
    "20": { abbr: "MAG", name: "Kevin Magnussen",    team: "haas" },
    "27": { abbr: "HUL", name: "Nico Hülkenberg",    team: "haas" },
};

function driverColor(driver_id) {
    const d = DRIVERS[driver_id];
    return d ? (TEAMS[d.team]?.color || "#fff") : "#fff";
}
function driverAbbr(driver_id) {
    return DRIVERS[driver_id]?.abbr || driver_id;
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG Rendering
// ═══════════════════════════════════════════════════════════════════════════
const svg = document.getElementById('track-svg');
const driverNodes = {};
let circuitDrawn = false;

function drawCircuit(path) {
    if (circuitDrawn || !path || path.length < 2) return;
    circuitDrawn = true;

    const points = path.map(p => `${p.x},${p.y}`).join(' ');

    // Outer track (wide, dark grey = tarmac)
    const outer = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    outer.setAttribute("points", points);
    outer.setAttribute("fill", "none");
    outer.setAttribute("stroke", "#2a2a2a");
    outer.setAttribute("stroke-width", "22");
    outer.setAttribute("stroke-linecap", "round");
    outer.setAttribute("stroke-linejoin", "round");
    svg.insertBefore(outer, svg.firstChild);

    // White kerb lines (slightly narrower)
    const kerbs = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    kerbs.setAttribute("points", points);
    kerbs.setAttribute("fill", "none");
    kerbs.setAttribute("stroke", "#3a3a3a");
    kerbs.setAttribute("stroke-width", "20");
    kerbs.setAttribute("stroke-linecap", "round");
    kerbs.setAttribute("stroke-linejoin", "round");
    svg.insertBefore(kerbs, svg.firstChild);

    // Racing surface
    const surface = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    surface.setAttribute("points", points);
    surface.setAttribute("fill", "none");
    surface.setAttribute("stroke", "#1e1e26");
    surface.setAttribute("stroke-width", "16");
    surface.setAttribute("stroke-linecap", "round");
    surface.setAttribute("stroke-linejoin", "round");
    svg.insertBefore(surface, svg.firstChild);

    // Centerline (dashed white)
    const center = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    center.setAttribute("points", points);
    center.setAttribute("fill", "none");
    center.setAttribute("stroke", "#ffffff18");
    center.setAttribute("stroke-width", "1");
    center.setAttribute("stroke-dasharray", "8 12");
    svg.insertBefore(center, svg.firstChild);

    // Start/finish line at first point
    if (path.length > 1) {
        const sx = path[0].x, sy = path[0].y;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", sx - 12); line.setAttribute("y1", sy);
        line.setAttribute("x2", sx + 12); line.setAttribute("y2", sy);
        line.setAttribute("stroke", "#ffffff");
        line.setAttribute("stroke-width", "3");
        svg.insertBefore(line, svg.firstChild);
    }
}

function renderFrame(positions) {
    positions.forEach(pos => {
        const color = driverColor(pos.driver_id);
        const abbr  = driverAbbr(pos.driver_id);
        let node = driverNodes[pos.driver_id];

        if (!node) {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("r", 9);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", "#000");
            circle.setAttribute("stroke-width", 1.5);
            g.appendChild(circle);

            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("width", 28);
            rect.setAttribute("height", 13);
            rect.setAttribute("rx", 2);
            rect.setAttribute("fill", "#000000cc");
            rect.setAttribute("x", 11);
            rect.setAttribute("y", -7);
            g.appendChild(rect);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.textContent = abbr;
            text.setAttribute("fill", color);
            text.setAttribute("font-size", "9");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", "Roboto Mono, monospace");
            text.setAttribute("x", 13);
            text.setAttribute("y", 4);
            g.appendChild(text);

            svg.appendChild(g);
            driverNodes[pos.driver_id] = g;
        }

        driverNodes[pos.driver_id].setAttribute(
            "transform", `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`
        );
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Standings Table
// ═══════════════════════════════════════════════════════════════════════════
let standingsBuilt = false;
const POSITION_ORDER = {};  // {driver_num: {pos, lap}}

function buildStandingsRows() {
    const body = document.getElementById('standings-body');
    body.innerHTML = '';
    // Create rows for all 20 drivers, keyed by driver number
    for (const [num, d] of Object.entries(DRIVERS)) {
        const team = TEAMS[d.team];
        const row = document.createElement('div');
        row.className = 'standing-row';
        row.id = `srow-${num}`;
        row.innerHTML = `
            <span class="spos" id="spos-${num}">--</span>
            <span class="sbar" style="background:${team.color}"></span>
            <span class="sabbr" style="color:${team.color}">${d.abbr}</span>
            <span class="sname">${d.name}</span>
            <span class="slap" id="slap-${num}">L0</span>
        `;
        body.appendChild(row);
    }
    standingsBuilt = true;
}

function updateStandingsTable(racePositions) {
    if (!standingsBuilt) buildStandingsRows();
    if (!racePositions || Object.keys(racePositions).length === 0) return;

    const body = document.getElementById('standings-body');

    // Collect rows with their position numbers
    const rows = [];
    for (const [dNum, info] of Object.entries(racePositions)) {
        POSITION_ORDER[dNum] = info;
    }
    // Also include drivers not in racePositions yet
    for (const dNum of Object.keys(DRIVERS)) {
        if (!POSITION_ORDER[dNum]) POSITION_ORDER[dNum] = { pos: null, lap: 0 };
    }

    // Sort by position (nulls go to bottom)
    const sorted = Object.entries(POSITION_ORDER).sort((a, b) => {
        const pa = a[1].pos ?? 99;
        const pb = b[1].pos ?? 99;
        return pa - pb;
    });

    // Reorder DOM rows and update values
    sorted.forEach(([dNum, info]) => {
        const posEl  = document.getElementById(`spos-${dNum}`);
        const lapEl  = document.getElementById(`slap-${dNum}`);
        const rowEl  = document.getElementById(`srow-${dNum}`);
        if (!posEl || !rowEl) return;

        posEl.textContent = info.pos ? `P${info.pos}` : '--';
        posEl.style.color = info.pos === 1 ? '#ffd700' :
                            info.pos <= 3  ? '#c0c0c0' : '#888';
        if (lapEl) lapEl.textContent = info.lap ? `V${info.lap}` : 'V0';
        body.appendChild(rowEl);  // move to end = re-sort in DOM
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Event notifications (toasts)
// ═══════════════════════════════════════════════════════════════════════════
const EVENT_COLORS = {
    pit_in:       '#ff9800',
    pit_out:      '#4caf50',
    dnf:          '#f44336',
    track_status: '#ffeb3b',
};

let toastQueue = Promise.resolve();

function showEvent(event) {
    const color = EVENT_COLORS[event.type] || '#ffffff';
    const container = document.getElementById('event-log');

    const toast = document.createElement('div');
    toast.className = 'event-toast';
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<span style="color:${color}">${event.message}</span>`;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('visible');
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

// ═══════════════════════════════════════════════════════════════════════════
// Time display
// ═══════════════════════════════════════════════════════════════════════════
let raceStartMs = 0;

function updateTimeDisplay(ms) {
    const elapsed = Math.max(0, ms - raceStartMs);
    const totalSec = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    document.getElementById('time-display').innerText =
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Initialize
buildStandingsRows();