// ═══════════════════════════════════════════════════════════════════════════
// selector.js — Race selector screen logic
// Reads F1_CALENDAR from races.js, calls /races to check what's in Redis,
// and can trigger the producer via docker exec to load a new race.
// ═══════════════════════════════════════════════════════════════════════════

const API = "http://localhost:8000";

let selectedYear  = 2023;
let selectedRound = null;
let selectedRaceId = null;
let loadedRaces = new Set();   // race_ids already in Redis

// ── Fetch what's already loaded in Redis ────────────────────────────────────
async function fetchLoadedRaces() {
    try {
        const res = await fetch(`${API}/races`);
        const data = await res.json();
        loadedRaces = new Set(data.races.map(r => r.race_id));
    } catch {
        loadedRaces = new Set();
    }
}

// ── Build the race grid for a given year ────────────────────────────────────
function buildRaceGrid(year) {
    const grid = document.getElementById('race-grid');
    grid.innerHTML = '';
    const races = F1_CALENDAR[year] || [];

    races.forEach(race => {
        const raceId = `${year}_r${race.round}`;
        const isLoaded = loadedRaces.has(raceId);

        const card = document.createElement('div');
        card.className = `race-card ${isLoaded ? 'loaded' : ''}`;
        card.dataset.round = race.round;
        card.dataset.raceId = raceId;

        card.innerHTML = `
            <div class="rc-flag">${race.country}</div>
            <div class="rc-round">R${race.round}</div>
            <div class="rc-name">${race.name}</div>
            <div class="rc-circuit">${race.circuit}</div>
            ${isLoaded ? '<div class="rc-loaded-badge">✓ En Redis</div>' : ''}
        `;

        card.addEventListener('click', () => selectRace(year, race, raceId));
        grid.appendChild(card);
    });
}

// ── Select a race ───────────────────────────────────────────────────────────
function selectRace(year, race, raceId) {
    // Deselect previous
    document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
    // Select current
    const card = document.querySelector(`[data-race-id="${raceId}"]`);
    if (card) card.classList.add('selected');

    selectedYear   = year;
    selectedRound  = race.round;
    selectedRaceId = raceId;

    // Show load panel
    const panel = document.getElementById('load-panel');
    panel.classList.remove('hidden');
    document.getElementById('load-flag').textContent      = race.country;
    document.getElementById('load-race-name').textContent = race.name;
    document.getElementById('load-race-meta').textContent = `${year} · Temporada F1`;

    const btnVis  = document.getElementById('btn-visualize');
    const btnLoad = document.getElementById('btn-load-race');
    const status  = document.getElementById('load-status');

    if (loadedRaces.has(raceId)) {
        status.textContent = '✓ Datos disponibles en Redis';
        status.className   = 'load-status ok';
        btnVis.classList.remove('hidden');
        btnLoad.querySelector('#btn-launch-text').textContent = '⟳ Recargar en Redis';
    } else {
        status.textContent = '⚠ No cargado — selecciona "Cargar en Redis"';
        status.className   = 'load-status warn';
        btnVis.classList.add('hidden');
        btnLoad.querySelector('#btn-launch-text').textContent = '⬇ Cargar en Redis';
    }
}

// ── Load race into Redis (shows instructions since we can't exec docker) ────
document.getElementById('btn-load-race').addEventListener('click', async () => {
    if (!selectedRaceId) return;

    const status  = document.getElementById('load-status');
    const btnLoad = document.getElementById('btn-load-race');
    const btnVis  = document.getElementById('btn-visualize');
    const btnText = document.getElementById('btn-launch-text');

    // Check if already loaded
    await fetchLoadedRaces();
    if (loadedRaces.has(selectedRaceId)) {
        status.textContent = '✓ Ya disponible — abriendo visualizador…';
        status.className   = 'load-status ok';
        btnVis.classList.remove('hidden');
        return;
    }

    // Show docker command instructions
    status.innerHTML = `
        <div class="docker-hint">
            <b>Ejecuta este comando en tu terminal:</b><br>
            <code>docker compose run --rm -e RACE_YEAR=${selectedYear} -e RACE_ROUND=${selectedRound} -e RACE_ID=${selectedRaceId} producer</code>
            <br><small>Esto descargará los datos de F1 y los cargará en Redis (~2-5 min).</small>
        </div>
    `;
    status.className = 'load-status info';
    btnText.textContent = '⟳ Verificar si ya cargó';
    btnLoad.onclick = async () => {
        await fetchLoadedRaces();
        if (loadedRaces.has(selectedRaceId)) {
            status.textContent = '✓ Cargado correctamente';
            status.className   = 'load-status ok';
            btnVis.classList.remove('hidden');
            const card = document.querySelector(`[data-race-id="${selectedRaceId}"]`);
            if (card) { card.classList.add('loaded'); }
        } else {
            status.textContent = '⏳ Aún cargando… vuelve a verificar en unos minutos';
            status.className   = 'load-status warn';
        }
    };
});

// ── Launch visualizer ────────────────────────────────────────────────────────
document.getElementById('btn-visualize').addEventListener('click', () => {
    if (!selectedRaceId) return;
    launchVisualizer(selectedYear, selectedRound, selectedRaceId);
});

function launchVisualizer(year, round, raceId) {
    // Update visualizer header
    const race = (F1_CALENDAR[year] || []).find(r => r.round === round);
    document.getElementById('vis-race-name').textContent = race ? `${race.country} ${race.name}` : raceId;
    document.getElementById('vis-race-year').textContent = `${year} · Temporada F1`;
    document.getElementById('total-laps').textContent    = '…';

    // Initialize renderer with correct season data
    initSeasonData(year);

    // Switch screens
    document.getElementById('selector-screen').classList.add('hidden');
    document.getElementById('visualizer-screen').classList.remove('hidden');

    // Connect WebSocket and load race
    connectWebSocket(raceId);
}

// ── Back button ──────────────────────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
    disconnectWebSocket();
    document.getElementById('visualizer-screen').classList.add('hidden');
    document.getElementById('selector-screen').classList.remove('hidden');
    fetchLoadedRaces().then(() => buildRaceGrid(selectedYear));
});

// ── Year buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedYear = parseInt(btn.dataset.year);
        document.getElementById('load-panel').classList.add('hidden');
        buildRaceGrid(selectedYear);
    });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
    await fetchLoadedRaces();
    buildRaceGrid(selectedYear);
})();
