# F1 Visualizer

Visualizador de telemetria de Formula 1. Permite seleccionar cualquier carrera entre las temporadas 2020 y 2025, cargar los datos historicos usando FastF1, y reproducir la carrera con posiciones de pilotos, trazado del circuito, clasificacion en tiempo real y notificaciones de eventos (pit stops, DNF, safety car).

---

## Arquitectura

```
Browser (localhost:3000)
  |
  |-- GET  /races             --> Consumer API  (puerto 8000)
  |-- WS   /websocket/{id}   --> Consumer API  (puerto 8000)
  |
  |-- POST /load-race        --> Producer API  (puerto 8001)
  |-- GET  /status/{race_id} --> Producer API  (puerto 8001)
  |
  |-- Archivos estaticos     --> Nginx          (puerto 3000)
```

### Servicios

| Servicio  | Imagen          | Puerto | Descripcion                                               |
|-----------|-----------------|--------|-----------------------------------------------------------|
| redis     | redis:7-alpine  | 6379   | Almacena frames de telemetria, snapshots y eventos        |
| producer  | Python 3.11     | 8001   | Descarga datos con FastF1 y los carga en Redis            |
| consumer  | Python 3.11     | 8000   | Emite frames por WebSocket a los clientes conectados      |
| frontend  | nginx:alpine    | 3000   | Sirve la aplicacion web estatica                          |

### Flujo de datos

```
FastF1 (datos historicos)
  |
  v
producer/app/pipeline
  |-- f1_client.py     Carga la sesion de FastF1
  |-- transform.py     Normaliza coordenadas, extrae trazado del circuito
  |-- events.py        Extrae pit stops, DNF y estados de pista
  |-- datastore.py     Persiste todo en Redis
  |
  v
Redis
  race:{id}:meta              Metadatos (inicio de carrera, vueltas, trazado)
  race:{id}:index             Sorted set con timestamps de frames
  race:{id}:frame={ms}        Frame de telemetria por timestamp
  race:{id}:events            Sorted set de eventos (pit, dnf, safety car)
  race:{id}:snap:index        Sorted set con timestamps de snapshots
  race:{id}:snap:{ms}         Snapshot de posiciones por vuelta completada
  |
  v
consumer/app/simulation.py
  Emite frames por WebSocket cada 10ms (velocidad configurable)
  Incluye en cada frame: posiciones, clasificacion y eventos
  |
  v
Frontend (HTML + CSS + JS)
  selector.js    Pantalla de seleccion de carrera
  renderer.js    Dibuja el SVG del circuito y los puntos de pilotos
  websocket.js   Maneja la conexion WebSocket y actualiza la UI
```

---

## Requisitos

- Docker Desktop (con Docker Compose V2)
- Conexion a internet para la descarga inicial de datos de FastF1

---

## Instalacion y arranque

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd F1_Visualizer
```

### 2. Construir las imagenes

```bash
docker compose build
```

### 3. Levantar los servicios

```bash
docker compose up -d redis consumer frontend producer
```

### 4. Abrir la aplicacion

Abrir en el navegador: http://localhost:3000

---

## Uso

### Cargar una carrera

1. En la pantalla de seleccion, elige el ano con los botones superiores (2020-2025).
2. Haz clic en la carrera que quieras visualizar.
3. Haz clic en **Cargar en Redis**.
   - El producer descargara los datos de FastF1 y los procesara (3-5 minutos la primera vez).
   - La pantalla muestra el progreso y se actualiza automaticamente al terminar.
   - Las carreras ya cargadas aparecen marcadas como **En Redis**.
4. Haz clic en **Visualizar** cuando el estado muestre que los datos estan disponibles.

### Controles del visualizador

| Control         | Descripcion                                      |
|-----------------|--------------------------------------------------|
| Play / Pause    | Inicia o pausa la reproduccion                   |
| Velocidad       | Multiplica la velocidad de reproduccion (1x-60x) |
| Barra de tiempo | Permite saltar a cualquier punto de la carrera   |
| Cambiar carrera | Vuelve a la pantalla de seleccion                |

### Panel derecho

Muestra la clasificacion en tiempo real ordenada por posicion de carrera, con el color del equipo de cada piloto y el numero de vuelta actual.

### Notificaciones de eventos

Aparecen en la esquina inferior derecha durante la reproduccion:

- **PIT IN / PIT OUT**: entrada y salida de boxes
- **ABANDONA**: retiro del piloto y motivo
- **SAFETY CAR / BANDERA ROJA**: estados de pista

---

## Estructura del proyecto

```
F1_Visualizer/
  docker-compose.yml
  producer/
    Dockerfile
    requirements.txt
    app/
      api.py          API HTTP (FastAPI) para cargar carreras
      main.py         Orquestador del pipeline de datos
      f1_client.py    Carga de sesion con FastF1
      transform.py    Normalizacion y extraccion del circuito
      events.py       Extraccion de eventos de carrera
      datastore.py    Persistencia en Redis
  consumer/
    Dockerfile
    requirements.txt
    app/
      main.py         API WebSocket (FastAPI)
      simulation.py   Bucle de emision de frames
      connection.py   Gestor de conexiones WebSocket
      schemas.py      Modelos Pydantic
  frontend/
    index.html
    css/
      styles.css
    js/
      races.js        Calendario F1 2020-2025 y plantillas de pilotos/equipos
      selector.js     Logica de la pantalla de seleccion
      renderer.js     Renderizado SVG y tabla de clasificacion
      websocket.js    Cliente WebSocket
```

---

## Cache de FastF1

Los datos descargados por FastF1 se guardan en `./fastf1_cache/` (montado como volumen en el producer). Esto evita volver a descargar los datos de una carrera ya cargada anteriormente si se reinicia el producer.

Si quieres borrar el cache de FastF1:

```bash
Remove-Item -Recurse -Force .\fastf1_cache
```

Si quieres limpiar Redis (borrar todas las carreras cargadas):

```bash
docker exec f1_visualizer-redis-1 redis-cli FLUSHALL
```

---

## Temporadas y datos disponibles

Los datos provienen de la API oficial de Formula 1 a traves de la libreria FastF1. La disponibilidad depende de que FastF1 tenga datos para esa sesion.

| Temporada | Carreras |
|-----------|----------|
| 2020      | 17       |
| 2021      | 21       |
| 2022      | 22       |
| 2023      | 22       |
| 2024      | 24       |
| 2025      | 24       |

---

## Tecnologias

| Area        | Tecnologia                  |
|-------------|-----------------------------|
| Backend     | Python 3.11, FastAPI, Redis |
| Datos F1    | FastF1 3.3                  |
| WebSocket   | FastAPI WebSocket, asyncio  |
| Frontend    | HTML, CSS, JavaScript (vanilla) |
| Contenedores| Docker, Docker Compose      |
