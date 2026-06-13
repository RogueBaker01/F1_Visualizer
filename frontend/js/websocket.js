// Generar un ID de cliente único para el ConnectionManager del backend
const clientId = "client_" + Math.random().toString(36).substring(2, 9);
const ws = new WebSocket(`ws://localhost:8000/websocket/${clientId}`);

ws.onopen = () => {
    console.log(`Conectado al servidor WebSocket con ID: ${clientId}`);
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.error) {
        console.error("Error desde el servidor:", data.error, data.details);
        return;
    }

    if (data.type === "telemetry") {
        updateTimeDisplay(data.time_ms);
        renderFrame(data.positions);
    }
};

ws.onclose = () => {
    console.log("Desconectado del servidor");
};

document.getElementById('btn-load').onclick = () => {
    ws.send(JSON.stringify({ action: "load_race", race_id: "2023_bahrain" }));
};

document.getElementById('btn-play').onclick = () => {
    ws.send(JSON.stringify({ action: "play" }));
};

document.getElementById('btn-pause').onclick = () => {
    ws.send(JSON.stringify({ action: "pause" }));
};

document.getElementById('sel-speed').onchange = (e) => {
    ws.send(JSON.stringify({ action: "speed", value: parseFloat(e.target.value) }));
};