## Why

Cocinetas no tiene todavía ni una receta. La fase 1 construyó el vocabulario
—el catálogo de ingredientes y la despensa— y lo dejó sembrándose con lo que la
persona escribe, pero un recetario sin recetas no es nada: es una lista de la
compra con pretensiones.

Esta fase escribe la primera. Y va ahora, y no después del cruce o del modo
cocina, porque **todo lo que viene detrás la necesita**: el «4/7 ingredientes»
de la fase 3 cruza contra líneas de receta que aún no existen, el modo cocina de
la fase 4 recorre pasos que aún no existen, y la importación desde vídeo de la
fase 6 produce un borrador que sin editor no se puede terminar.

Es también la fase más incierta del reparto, y por un motivo concreto: el editor
es la interfaz más difícil de la aplicación. Líneas de ingrediente con
autocompletado, pasos que se reordenan, y la unión entre ambos. Llega en segundo
lugar apoyándose en un catálogo que ya funciona y que ya tiene vocabulario real
dentro, que era justamente el motivo de haber empezado por la despensa.

## What Changes

- **Una receta es un borrador hasta que se declara terminada.** `finalizada_en`
  nulo significa borrador, y toda receta nace así venga de donde venga. «Crear
  desde cero» es un borrador vacío. El esquema no se parte en dos tablas: se
  aprieta al finalizar, con las exigencias de una receta terminada expresadas
  como comprobaciones condicionadas a esa fecha.
- **Líneas de ingrediente que resuelven contra el catálogo desde el primer
  momento**, ya en borrador, con `ingrediente_id` obligatorio. Escribir una
  línea usa la misma puerta que la despensa —`resolver_ingrediente`—, así que
  una palabra nueva entra en el catálogo sin que el editor tenga que
  preguntarlo. Cada línea lleva su cantidad y su nota, opcionales.
- **Pasos ordenados**, con su texto. Sin duración y sin marcar como hechos: el
  modo cocina de la fase 4 solo lee, y «sofríe 10 minutos» ya está escrito
  dentro del paso.
- **La unión entre pasos y líneas.** Un paso declara qué líneas usa, apuntando a
  la línea y no al ingrediente, porque una receta puede llevar dos líneas del
  mismo ingrediente («100 ml de aceite para el sofrito, 50 para terminar») y
  apuntando al ingrediente el paso no sabría a cuál se refiere.
- **El editor.** La pantalla más cara de la aplicación. Guarda al vuelo contra
  el borrador —no hay botón de guardar y no hay nada sin guardar—, autocompleta
  las líneas contra el catálogo propio, y reordena arrastrando.
- **La lista de recetas, con los borradores aparte**, y la pantalla de detalle
  de una receta terminada.
- **La procedencia se separa del estado.** `origen_tipo` nace valiendo `manual`
  y es una columna distinta de `finalizada_en`: una receta de vídeo ya terminada
  sigue siendo de origen vídeo para siempre. Las columnas del vídeo no se crean
  hasta la fase 6.

Sin cambios que rompan nada: no hay recetas previas. Sí hay una **corrección de
documentación**: `openspec/ROADMAP.md` nombra estas tablas en castellano
(`recetas`, `pasos`), contradiciendo la decisión D10 de la fase 1, que fija
tablas en inglés y columnas en español. Gana D10, que es la decisión razonada; el
ROADMAP se corrige.

## Capabilities

### New Capabilities

- `recipes`: qué es una receta en Cocinetas. Cómo nace, qué la distingue de un
  borrador, qué hace falta para darla por terminada, cómo se escriben sus líneas
  de ingrediente y sus pasos, qué relación tienen entre sí, y qué garantiza el
  editor sobre lo que la persona escribe.

### Modified Capabilities

- `ingredients`: hasta ahora el catálogo solo lo consumía la despensa. Con
  recetas dentro, un ingrediente deja de poder borrarse libremente —está en uso
  en algún sitio más— y fusionar dos ingredientes tiene que reasignar también
  las líneas de receta que los usaban, no solo las entradas de despensa. Son
  requisitos existentes cuyo alcance cambia, no implementación.

`app-shell` y `user-auth` no cambian. En particular, el requisito de que toda
ruta sea legible sin JavaScript sigue vigente y esta fase lo respeta: el editor
se renderiza en servidor y se lee, aunque no se pueda usar sin JavaScript.

## Impact

**Base de datos.** Cuatro tablas nuevas en `public` —`recipes`,
`recipe_ingredients`, `steps`, `step_ingredients`—, todas con RLS y con la misma
frase de aislamiento que ya usan `profiles`, `ingredients` y `pantry`:
`perfil_id = auth.uid()`. Los privilegios se revocan antes de concederse, por la
misma razón que en la fase 1 (D8): sin eso, el privilegio concedido y el
pretendido no coinciden desde la primera migración.

`fusionar_ingredientes` hay que ampliarla. Hoy traslada entradas de despensa y
borra; cuando existan líneas de receta tiene que reasignarlas también, y la
propia migración de la fase 1 dejó anotado ese sitio: «cuando existan recetas,
este es el sitio donde también se reasignarán sus líneas».

**Interfaz.** Tres rutas protegidas nuevas —lista, detalle y editor— y **la
primera pantalla con estado en cliente del proyecto**. Hasta hoy no hay un solo
`useState` ni un solo manejador de eventos en toda la aplicación: las cuatro
pantallas existentes son formularios y listas que no lo necesitan. El editor sí,
y lo que se decida aquí será el estilo de la casa para el modo cocina y el
importador.

**Dependencias.** Probablemente una: una librería de arrastrar y soltar que
funcione con el dedo. La API nativa `draggable` es de ratón y en iOS no hace
nada, así que hay que ir por Pointer Events, a mano o con dependencia. Es la
primera dependencia de cliente del proyecto y merece pensarse como tal.

**Lo que esta fase NO hace.** El cruce contra la despensa (fase 3), el modo
cocina (fase 4), las fotos (fase 5) y la importación desde vídeo (fase 6). Ni
funcionar sin red: seguir una receta sin conexión es un objetivo declarado, pero
del modo cocina, no del editor. El reparto completo está en
`openspec/ROADMAP.md` y el modelo de datos entero en el `design.md` de
`add-pantry`, archivado.
