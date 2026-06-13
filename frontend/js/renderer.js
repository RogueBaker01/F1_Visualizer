// ── Driver & Team data (2023 season) ─────────────────────────────────────────
const TEAMS = {
    red_bull:     { name: "Red Bull Racing",  color: "#3671C6" },
    mercedes:     { name: "Mercedes",         color: "#00D2BE" },
    ferrari:      { name: "Ferrari",          color: "#E8002D" },
    mclaren:      { name: "McLaren",          color: "#FF8000" },
    aston_martin: { name: "Aston Martin",     color: "#358C75" },
    alpine:       { name: "Alpine",           color: "#FF87BC" },
    williams:     { name: "Williams",         color: "#64C4FF" },
    alphatauri:   { name: "AlphaTauri",       color: "#5E8FAA" },
    alfa_romeo:   { name: "Alfa Romeo",       color: "#C92D4B" },
    haas:         { name: "Haas F1 Team",     color: "#B6BABD" },
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

// ── SVG rendering ─────────────────────────────────────────────────────────────
const svg = document.getElementById('track-svg');
const driverNodes = {};

function getDriverColor(driver_id) {
    const d = DRIVERS[driver_id];
    if (!d) return "#FFFFFF";
    return TEAMS[d.team]?.color || "#FFFFFF";
}

function getDriverAbbr(driver_id) {
    return DRIVERS[driver_id]?.abbr || driver_id;
}

function renderFrame(positions) {
    positions.forEach(pos => {
        const color = getDriverColor(pos.driver_id);
        const abbr  = getDriverAbbr(pos.driver_id);
        let node = driverNodes[pos.driver_id];

        if (!node) {
            // Glow filter per driver
            const filterId = `glow-${pos.driver_id}`;
            const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute("id", filterId);
            filter.setAttribute("x", "-50%"); filter.setAttribute("y", "-50%");
            filter.setAttribute("width", "200%"); filter.setAttribute("height", "200%");
            const feGaussianBlur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
            feGaussianBlur.setAttribute("stdDeviation", "3");
            feGaussianBlur.setAttribute("result", "blur");
            const feMerge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
            ["blur", "SourceGraphic"].forEach(inp => {
                const n = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
                if (inp === "blur") n.setAttribute("in", "blur");
                feMerge.appendChild(n);
            });
            filter.appendChild(feGaussianBlur);
            filter.appendChild(feMerge);
            svg.appendChild(filter);

            // Circle
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("r", 12);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", "#000");
            circle.setAttribute("stroke-width", 1.5);
            circle.setAttribute("filter", `url(#${filterId})`);
            svg.appendChild(circle);

            // Label background rect
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("width", 30);
            rect.setAttribute("height", 14);
            rect.setAttribute("rx", 3);
            rect.setAttribute("fill", "#000000cc");
            svg.appendChild(rect);

            // Label text
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.textContent = abbr;
            text.setAttribute("fill", color);
            text.setAttribute("font-size", "10");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", "monospace");
            svg.appendChild(text);

            driverNodes[pos.driver_id] = { circle, rect, label: text };
        }

        const { circle, rect, label } = driverNodes[pos.driver_id];
        circle.setAttribute("cx", pos.x);
        circle.setAttribute("cy", pos.y);
        rect.setAttribute("x", pos.x + 14);
        rect.setAttribute("y", pos.y - 10);
        label.setAttribute("x", pos.x + 16);
        label.setAttribute("y", pos.y + 0);
    });

    updateStandingsTable(positions);
}

// ── Standings table ───────────────────────────────────────────────────────────
let standingsInitialized = false;

function buildStandingsTable() {
    const container = document.getElementById('standings-body');
    container.innerHTML = '';

    Object.entries(TEAMS).forEach(([teamId, team]) => {
        // Team header row
        const teamRow = document.createElement('div');
        teamRow.className = 'team-row';
        teamRow.innerHTML = `
            <div class="team-color-bar" style="background:${team.color}"></div>
            <span class="team-name">${team.name}</span>
        `;
        container.appendChild(teamRow);

        // Driver rows for this team
        Object.entries(DRIVERS)
            .filter(([, d]) => d.team === teamId)
            .forEach(([num, d]) => {
                const driverRow = document.createElement('div');
                driverRow.className = 'driver-row';
                driverRow.id = `standing-${num}`;
                driverRow.innerHTML = `
                    <span class="driver-num" style="color:${team.color}">${num}</span>
                    <span class="driver-abbr" style="color:${team.color}">${d.abbr}</span>
                    <span class="driver-name">${d.name}</span>
                    <span class="driver-pos" id="pos-${num}">—</span>
                `;
                container.appendChild(driverRow);
            });
    });

    standingsInitialized = true;
}

function updateStandingsTable(positions) {
    if (!standingsInitialized) buildStandingsTable();
    positions.forEach(pos => {
        const el = document.getElementById(`pos-${pos.driver_id}`);
        if (el) {
            el.textContent = `${pos.x.toFixed(0)},${pos.y.toFixed(0)}`;
        }
    });
}

// ── Time display ──────────────────────────────────────────────────────────────
function updateTimeDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    document.getElementById('time-display').innerText =
        `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

// Build table immediately on page load
buildStandingsTable();