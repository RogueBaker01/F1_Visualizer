const svg = document.getElementById('track-svg');
const driverNodes = {};

const teamColors = {
    "VER": "#3671C6", "HAM": "#6CD3BF",
    "driver1": "#FF0000", "driver2": "#00FF00"
};

function renderFrame(positions) {
    positions.forEach(pos => {
        let node = driverNodes[pos.driver_id];

        if (!node) {
            node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            node.setAttribute("r", 10);
            node.setAttribute("fill", teamColors[pos.driver_id] || "#FFFFFF");
            node.setAttribute("stroke", "#000000");
            node.setAttribute("stroke-width", 2);
            svg.appendChild(node);

            let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.textContent = pos.driver_id;
            text.setAttribute("fill", "#FFFFFF");
            text.setAttribute("font-size", "12px");
            svg.appendChild(text);

            driverNodes[pos.driver_id] = { circle: node, label: text };
        }

        driverNodes[pos.driver_id].circle.setAttribute("cx", pos.x);
        driverNodes[pos.driver_id].circle.setAttribute("cy", pos.y);

        driverNodes[pos.driver_id].label.setAttribute("x", pos.x + 12);
        driverNodes[pos.driver_id].label.setAttribute("y", pos.y + 4);
    });
}

function updateTimeDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    document.getElementById('time-display').innerText =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}