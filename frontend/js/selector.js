// ═══════════════════════════════════════════════════════════════════════════
// selector.js — Race selector screen logic
// ═══════════════════════════════════════════════════════════════════════════

const CONSUMER_API  = "http://localhost:8000";
const PRODUCER_API  = "http://localhost:8001";

let selectedYear   = 2023;
let selectedRound  = null;
let selectedRaceId = null;
let loadedRaces    = new Set();   // race_ids already in Redis
let pollingTimer   = null;        // setInterval for polling load status

// ── Fetch what's already loaded in Redis ────────────────────────────────────
async function fetchLoadedRaces() {
    try {
        const res  = await fetch(`${CONSUMER_API}/races`);
        const data = await res.json();
        loadedRaces = new Set(data.races.map(r => r.race_id));
    } catch {
        loadedRaces = new Set();
    }
}

// ── Build race grid ──────────────────────────────────────────────────────────
function buildRaceGrid(year) {
    const grid  = document.getElementById('race-grid');
    grid.innerHTML = '';
    const races = F1_CALENDAR[year] || [];

    races.forEach(race => {
        const raceId   = `${year}_r${race.round}`;
        const isLoaded = loadedRaces.has(raceId);

        const card = document.createElement('div');
        card.className       = `race-card ${isLoaded ? 'loaded' : ''}`;
        card.dataset.round   = race.round;
        card.dataset.raceId  = raceId;

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

// ── Select a race ────────────────────────────────────────────────────────────
function selectRace(year, race, raceId) {
    stopPolling();
    document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`[data-race-id="${raceId}"]`);
    if (card) card.classList.add('selected');

    selectedYear   = year;
    selectedRound  = race.round;
    selectedRaceId = raceId;

    const panel   = document.getElementById('load-panel');
    panel.classList.remove('hidden');
    document.getElementById('load-flag').textContent      = race.country;
    document.getElementById('load-race-name').textContent = race.name;
    document.getElementById('load-race-meta').textContent = `${year} · F1 World Championship`;

    refreshPanelState(raceId);
}

// ── Refresh load-panel buttons/status ────────────────────────────────────────
function refreshPanelState(raceId) {
    const btnVis   = document.getElementById('btn-visualize');
    const btnLoad  = document.getElementById('btn-load-race');
    const btnText  = document.getElementById('btn-launch-text');
    const status   = document.getElementById('load-status');

    if (loadedRaces.has(raceId)) {
        setStatus(status, 'ok', 'Datos disponibles en Redis');
        btnVis.classList.remove('hidden');
        btnText.textContent = 'Recargar datos';
    } else {
        setStatus(status, 'warn', 'No cargado aun');
        btnVis.classList.add('hidden');
        btnText.textContent = 'Cargar en Redis';
    }
}

function setStatus(el, cls, html) {
    el.className = `load-status ${cls}`;
    el.innerHTML = html;
}

// ── Trigger load via Producer API ────────────────────────────────────────────
document.getElementById('btn-load-race').addEventListener('click', async () => {
    if (!selectedRaceId) return;

    const status  = document.getElementById('load-status');
    const btnVis  = document.getElementById('btn-visualize');
    const btnText = document.getElementById('btn-launch-text');
    const btnLoad = document.getElementById('btn-load-race');

    btnLoad.disabled    = true;
    btnText.textContent = 'Iniciando...';
    setStatus(status, 'info', 'Conectando con el producer...');

    try {
        const res  = await fetch(
            `${PRODUCER_API}/load-race?year=${selectedYear}&round=${selectedRound}&race_id=${selectedRaceId}`,
            { method: 'POST' }
        );
        const data = await res.json();

        if (data.status === 'done') {
            // Already loaded
            loadedRaces.add(selectedRaceId);
            markCardLoaded(selectedRaceId);
            setStatus(status, 'ok', data.message);
            btnVis.classList.remove('hidden');
            btnLoad.disabled = false;
            btnText.textContent = 'Recargar datos';
        } else if (data.status === 'loading') {
            setStatus(status, 'info', 'Descargando datos de F1... esto puede tardar 3-5 min');
            btnText.textContent = 'Cargando...';
            startPolling(selectedRaceId);
        } else {
            setStatus(status, 'warn', 'Error: ' + data.message);
            btnLoad.disabled = false;
            btnText.textContent = 'Reintentar';
        }
    } catch (err) {
        setStatus(status, 'warn',
            `No se pudo conectar al producer (${PRODUCER_API}). El servicio no esta corriendo.`
        );
        btnLoad.disabled = false;
        btnText.textContent = 'Reintentar';
    }
});

// ── Poll for completion ───────────────────────────────────────────────────────
function startPolling(raceId) {
    stopPolling();
    pollingTimer = setInterval(() => pollStatus(raceId), 4000);
}

function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

async function pollStatus(raceId) {
    if (raceId !== selectedRaceId) { stopPolling(); return; }

    try {
        const res  = await fetch(`${PRODUCER_API}/status/${raceId}`);
        const data = await res.json();

        const status  = document.getElementById('load-status');
        const btnVis  = document.getElementById('btn-visualize');
        const btnLoad = document.getElementById('btn-load-race');
        const btnText = document.getElementById('btn-launch-text');

        if (data.status === 'done') {
            stopPolling();
            loadedRaces.add(raceId);
            markCardLoaded(raceId);
            setStatus(status, 'ok', data.message);
            btnVis.classList.remove('hidden');
            btnLoad.disabled = false;
            btnText.textContent = 'Recargar datos';
        } else if (data.status === 'error') {
            stopPolling();
            setStatus(status, 'warn', 'Error: ' + data.message);
            btnLoad.disabled = false;
            btnText.textContent = 'Reintentar';
        } else if (data.status === 'loading') {
            const dots = (Date.now() % 1200 < 400) ? '.' : (Date.now() % 1200 < 800) ? '..' : '...';
            setStatus(status, 'info', `Descargando... ${data.message}${dots}`);
        }
    } catch {
        // Network blip — keep polling
    }
}

function markCardLoaded(raceId) {
    const card = document.querySelector(`[data-race-id="${raceId}"]`);
    if (!card) return;
    card.classList.add('loaded');
    if (!card.querySelector('.rc-loaded-badge')) {
        const badge = document.createElement('div');
        badge.className   = 'rc-loaded-badge';
        badge.textContent = 'En Redis';
        card.appendChild(badge);
    }
}

// ── Launch visualizer ─────────────────────────────────────────────────────────
document.getElementById('btn-visualize').addEventListener('click', () => {
    if (!selectedRaceId) return;
    launchVisualizer(selectedYear, selectedRound, selectedRaceId);
});

function launchVisualizer(year, round, raceId) {
    const race = (F1_CALENDAR[year] || []).find(r => r.round === round);
    document.getElementById('vis-race-name').textContent = race
        ? `${race.country} ${race.name}` : raceId;
    document.getElementById('vis-race-year').textContent = `${year} · F1 World Championship`;
    document.getElementById('total-laps').textContent    = '…';

    initSeasonData(year);

    document.getElementById('selector-screen').classList.add('hidden');
    document.getElementById('visualizer-screen').classList.remove('hidden');

    connectWebSocket(raceId);
}

// ── Back button ──────────────────────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
    stopPolling();
    disconnectWebSocket();
    document.getElementById('visualizer-screen').classList.add('hidden');
    document.getElementById('selector-screen').classList.remove('hidden');
    fetchLoadedRaces().then(() => buildRaceGrid(selectedYear));
});

// ── Year buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        stopPolling();
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
