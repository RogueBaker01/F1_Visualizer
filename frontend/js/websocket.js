const clientId = "client_" + Math.random().toString(36).substring(2, 9);
const WS_URL = `ws://localhost:8000/websocket/${clientId}`;
let ws;
let raceMinMs = 0;
let raceMaxMs = 0;

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log(`Conectado con ID: ${clientId}`);
        send({ action: "load_race", race_id: "2023_bahrain" });
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
            console.error("Error del servidor:", data.error, data.details);
            return;
        }

        if (data.type === "race_info") {
            raceMinMs = data.min_ms;
            raceMaxMs = data.max_ms;
            const slider = document.getElementById('seek-slider');
            slider.min = raceMinMs;
            slider.max = raceMaxMs;
            slider.value = raceMinMs;
            console.log(`Carrera lista: ${raceMinMs}ms → ${raceMaxMs}ms`);
        }

        if (data.type === "telemetry") {
            updateTimeDisplay(data.time_ms);
            renderFrame(data.positions);
            const slider = document.getElementById('seek-slider');
            if (!slider.matches(':active')) {
                slider.value = data.time_ms;
            }
        }
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
        console.log("Desconectado del servidor");
    };
}

function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    } else {
        console.warn("WebSocket no está listo, comando ignorado:", payload);
    }
}

connect();

document.getElementById('btn-load').onclick = () => {
    send({ action: "load_race", race_id: "2023_bahrain" });
};

document.getElementById('btn-play').onclick = () => {
    send({ action: "play" });
};

document.getElementById('btn-pause').onclick = () => {
    send({ action: "pause" });
};

document.getElementById('sel-speed').onchange = (e) => {
    send({ action: "speed", value: parseFloat(e.target.value) });
};

document.getElementById('seek-slider').onchange = (e) => {
    send({ action: "seek", time_ms: parseInt(e.target.value) });
};