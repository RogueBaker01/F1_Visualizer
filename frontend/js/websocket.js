// ═══════════════════════════════════════════════════════════════════════════
// websocket.js — WebSocket client (called by selector.js)
// ═══════════════════════════════════════════════════════════════════════════

let ws = null;

function connectWebSocket(raceId) {
    const clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    const url = `ws://localhost:8000/websocket/${clientId}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log(`WS connected — loading race: ${raceId}`);
        setStatus('Conectado', '#4caf50');
        send({ action: 'load_race', race_id: raceId });
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
            console.error('Server error:', data.error, data.details);
            return;
        }

        // ── Meta: circuit + race bounds ────────────────────────────────────
        if (data.type === 'meta') {
            raceStartMs = data.race_start_ms;
            drawCircuit(data.circuit_path);

            const slider = document.getElementById('seek-slider');
            slider.min   = data.min_ms;
            slider.max   = data.max_ms;
            slider.value = data.race_start_ms;

            document.getElementById('total-laps').textContent = data.total_laps;
            // Build standings rows now that DRIVERS is known
            buildStandingsRows();
        }

        // ── Telemetry frame ───────────────────────────────────────────────
        if (data.type === 'telemetry') {
            updateTimeDisplay(data.time_ms);
            renderFrame(data.positions);

            if (data.race_positions && Object.keys(data.race_positions).length > 0) {
                updateStandingsTable(data.race_positions);

                // Update leader lap
                const p1 = Object.entries(data.race_positions)
                    .find(([, info]) => info.pos === 1);
                if (p1) {
                    document.getElementById('current-lap').textContent = p1[1].lap ?? 0;
                }
            }

            if (data.events && data.events.length > 0) {
                data.events.forEach(ev => showEvent(ev));
            }

            // Sync slider
            const slider = document.getElementById('seek-slider');
            if (!slider.matches(':active')) {
                slider.value = data.time_ms;
            }
        }
    };

    ws.onerror = () => setStatus('Error de conexión', '#f44336');
    ws.onclose = () => setStatus('Desconectado', '#ff9800');
}

function disconnectWebSocket() {
    if (ws) { ws.close(); ws = null; }
}

function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function setStatus(text, color) {
    const dot  = document.getElementById('status-dot');
    const span = document.getElementById('status-text');
    if (dot)  dot.style.background  = color;
    if (span) span.textContent = text;
}

// ── Control bindings (set up once, DOM is always present) ──────────────────
document.getElementById('btn-play').onclick   = () => send({ action: 'play' });
document.getElementById('btn-pause').onclick  = () => send({ action: 'pause' });

document.getElementById('sel-speed').onchange = e =>
    send({ action: 'speed', value: parseFloat(e.target.value) });

document.getElementById('seek-slider').onchange = e =>
    send({ action: 'seek', time_ms: parseInt(e.target.value) });