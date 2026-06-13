const clientId = "client_" + Math.random().toString(36).substring(2, 9);
const WS_URL = `ws://localhost:8000/websocket/${clientId}`;
let ws;

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log(`WS connected: ${clientId}`);
        send({ action: "load_race", race_id: "2023_bahrain" });
        document.getElementById('status-dot').style.background = '#4caf50';
        document.getElementById('status-text').textContent = 'Conectado';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
            console.error("Server error:", data.error, data.details);
            return;
        }

        if (data.type === "meta") {
            // Draw circuit and configure slider
            raceStartMs = data.race_start_ms;
            drawCircuit(data.circuit_path);

            const slider = document.getElementById('seek-slider');
            slider.min  = data.min_ms;
            slider.max  = data.max_ms;
            slider.value = data.race_start_ms;

            document.getElementById('total-laps').textContent = data.total_laps;
            console.log(`Race ready: start=${data.race_start_ms}ms, laps=${data.total_laps}`);
        }

        if (data.type === "telemetry") {
            updateTimeDisplay(data.time_ms);
            renderFrame(data.positions);

            if (data.race_positions) {
                updateStandingsTable(data.race_positions);
            }

            if (data.events && data.events.length > 0) {
                data.events.forEach(ev => showEvent(ev));
            }

            // Update slider position (don't move if user is dragging)
            const slider = document.getElementById('seek-slider');
            if (!slider.matches(':active')) {
                slider.value = data.time_ms;
            }

            // Update current lap display
            if (data.race_positions) {
                const p1Entry = Object.entries(data.race_positions)
                    .find(([, info]) => info.pos === 1);
                if (p1Entry) {
                    const lap = p1Entry[1].lap || 0;
                    const total = document.getElementById('total-laps').textContent;
                    document.getElementById('current-lap').textContent = lap;
                }
            }
        }
    };

    ws.onerror = (err) => {
        console.error("WS error:", err);
        document.getElementById('status-dot').style.background = '#f44336';
        document.getElementById('status-text').textContent = 'Error';
    };

    ws.onclose = () => {
        console.log("WS closed");
        document.getElementById('status-dot').style.background = '#ff9800';
        document.getElementById('status-text').textContent = 'Desconectado';
    };
}

function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    } else {
        console.warn("WS not ready:", payload);
    }
}

connect();

document.getElementById('btn-load').onclick  = () => send({ action: "load_race", race_id: "2023_bahrain" });
document.getElementById('btn-play').onclick  = () => send({ action: "play" });
document.getElementById('btn-pause').onclick = () => send({ action: "pause" });

document.getElementById('sel-speed').onchange = (e) =>
    send({ action: "speed", value: parseFloat(e.target.value) });

document.getElementById('seek-slider').onchange = (e) =>
    send({ action: "seek", time_ms: parseInt(e.target.value) });