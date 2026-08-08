# ChatBot Creator

Plataforma **propia** (tipo Botpress, no Botpress) para **diseñar y simular** flujos
conversacionales: un lienzo de nodos/tarjetas conectados por flechas, que puedes
**crear, mover, conectar, editar y borrar**, y un **simulador de chat** que ejecuta el
flujo que diseñaste.

Stack: **React + React Flow** (Vite). **Todo corre en Docker** — no se instala nada
(Node, npm, dependencias) en tu Mac.

> La plataforma es **genérica**: sirve para cualquier bot. Trae un flujo de ejemplo
> (`src/flow/seedFlow.js`) para que el lienzo no arranque vacío; puedes borrarlo o
> reemplazarlo por el tuyo.

## Cómo correrlo (localhost)

Necesitas solo **Docker**.

```bash
docker compose up --build      # la 1ª vez (instala deps dentro del contenedor)
# luego abre  http://localhost:5174
```

Para apagarlo: `Ctrl+C`, y opcionalmente `docker compose down`.
Siguientes veces basta `docker compose up` (sin `--build`).
Si cambias `package.json` (nuevas dependencias): `docker compose up --build`.

## Qué puedes hacer

**Editor**
- **Arrastrar** un tipo de nodo desde la paleta izquierda al lienzo → crea un paso.
- **Conectar** pasos: arrastra desde el punto inferior de un nodo al superior de otro.
- **Editar** un paso o conexión: selecciónalo → panel derecho (título, texto,
  color/grupo, etiqueta de la conexión).
- **Borrar**: selecciona y pulsa `Supr`/`Backspace`, o el botón del inspector.
- **Auto-organizar** (layout jerárquico automático), **Ajustar**, minimapa + zoom.
- **Exportar / Importar** el flujo como JSON. Además se **autoguarda** en el navegador.

**Simulador** (botón **▶ Probar**)
- Ejecuta el flujo como un chat: escribe o toca opciones y el bot avanza por el grafo.
- El **nodo activo se resalta** (pulso verde) en el lienzo y la vista se centra en él.
- Reglas: nodo sin salidas = fin; 1 salida sin etiqueta = espera texto libre;
  1 con etiqueta o varias = opciones (botones), con match por texto sin tildes.

## Estructura

| Archivo | Qué es |
|---|---|
| `docker-compose.yml`, `Dockerfile` | Entorno Docker (Node vive aquí, no en tu Mac). |
| `src/App.jsx` | App principal: lienzo, drag&drop, edición, guardar/cargar, simulador. |
| `src/components/FlowNode.jsx` | La tarjeta de nodo (look tipo Botpress). |
| `src/components/{Sidebar,Inspector,Toolbar}.jsx` | Paleta, editor de selección, barra. |
| `src/components/Simulator.jsx` | Panel de chat que ejecuta el flujo. |
| `src/sim/runtime.js` | Motor que interpreta el grafo como máquina de estados. |
| `src/flow/seedFlow.js` | Flujo **semilla** de ejemplo + tipos de paso (`GRUPOS`). |
| `src/flow/transform.js` | Conversión a React Flow + auto-layout (dagre). |

## Roadmap

- ✅ **Fase 1** — Editor visual de flujos.
- ✅ **Fase 2** — Runtime + simulador de chat.
- ⏳ **Fase 3** — Conectar el runtime a un canal real (WhatsApp).

## Licencia

**Software propietario. Copyright © 2026 Johan Sebastián Gómez Rubio. Todos los derechos reservados.**

Este repositorio **no es open source**. Que el código esté visible en GitHub **no
otorga ningún derecho de uso**. Queda prohibido usar, ejecutar, desplegar, copiar,
modificar, redistribuir o integrar este código —total o parcialmente— sin una
**licencia comercial previa, por escrito y pagada** al titular.

Única excepción: leer el código para evaluación personal y no comercial, sin
ejecutarlo ni reutilizar ninguna parte de él.

¿Quieres usarlo? Escribe para cotizar una licencia: **gomezrubiosebas@gmail.com**

Detalle completo de las condiciones en [`LICENSE`](./LICENSE).
