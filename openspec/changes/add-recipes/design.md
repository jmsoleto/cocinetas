## Context

Ver `proposal.md` para la motivación. Lo que hace falta saber aquí es de qué se
parte y qué está ya decidido en otro sitio.

**El modelo de datos no se decide aquí.** Se decidió entero el 2026-08-26 y vive
en `openspec/changes/archive/2026-08-29-add-pantry/design.md`, incluidas las
cuatro tablas de esta fase. La regla acordada es que las fases lo construyen y
no lo renegocian. Este documento decide **la pantalla**, que es lo que aquel
deliberadamente no tocó.

Dos hechos del repositorio que condicionan todo lo de abajo:

- **No hay una sola línea de estado en cliente.** Ni un `useState`, ni un
  `useEffect`, ni un `onClick` en las cuatro pantallas que existen. La
  aplicación hidrata, pero el árbol hidratado está inerte. No es una doctrina:
  es que un formulario no necesita estado, y hasta hoy todo eran formularios.
- **La spec de `app-shell` promete menos de lo que parece.** Su escenario sin
  JavaScript exige que la página sea *legible* y que **los formularios de
  autenticación** sigan siendo enviables. Eso es todo. Que la despensa funcione
  sin JavaScript es cortesía, no contrato, y el editor no está atado por nada
  que no escribamos nosotros ahora.

Hay un tercer hecho, escrito en la D1 del change del esqueleto al descartar
Astro: «el modo cocina y el importador son pantallas con estado, y el modelo de
islas estorba ahí». El framework se eligió contando con estado en cliente. El
editor no figuraba en esa lista, y sin embargo llega antes que los dos.

## Goals / Non-Goals

**Goals:**

- Que escribir una receta no tenga un estado «sin guardar»: lo que se ve en
  pantalla y lo que hay en la base de datos son lo mismo.
- Que el editor no invente una segunda forma de estar sin terminar, cuando el
  modelo ya tiene una —el borrador— y la tiene a propósito.
- Dejar el modo cocina de la fase 4 en el mejor sitio posible para funcionar sin
  red, sin construir nada de eso aquí.
- Que reordenar no pueda dejar la receta en un estado imposible ni a mitad de
  sentencia.

**Non-Goals:**

- Que el editor sea usable sin JavaScript. Legible sí —lo exige `app-shell`—,
  usable no.
- Funcionamiento sin red, de escritura o de lectura. Ni siquiera parcial.
- Historial de versiones, deshacer, o edición a varias manos.
- Cualquier cosa de las fases 3 a 6: cruce con la despensa, modo cocina, fotos,
  vídeo.

## Decisions

### D1 — Tablas en inglés, columnas en español: se confirma la D10 de la fase 1

`recipes`, `recipe_ingredients`, `steps`, `step_ingredients`, con `perfil_id`,
`titulo`, `comensales`, `finalizada_en`, `origen_tipo`, `orden`, `cantidad`,
`nota`, `texto`.

Se anota porque **había una contradicción escrita**. El `design.md` de la fase 1
nombra estas tablas en inglés en su diagrama del modelo completo; el
`ROADMAP.md`, redactado después, las nombra en castellano en las fases 2 y 6
(`recetas`, `pasos`, `recetas.origen_url`, `pasos.segundo_video`). Y la propia
D10 cierra con la frase «Si va a cambiar, que cambie antes de la primera
migración», que es exactamente ahora.

Gana D10: es una decisión razonada, y el ROADMAP era una descripción. Lo
contrario obligaría además a renombrar `profiles`, `ingredients` y `pantry` para
no dejar el esquema medio en cada idioma. **Se corrige el ROADMAP**, no el
esquema.

### D2 — El editor no promete nada sin JavaScript

La spec de `recipes` **no** escribirá ningún escenario de «el editor funciona
con JavaScript deshabilitado». Escribirlo ataría todas las decisiones de esta
fase y de las siguientes a cambio de proteger el caso menos probable.

Lo que sí sigue vigente, porque es de `app-shell` y no de esta spec: el editor se
renderiza en servidor y es legible sin JavaScript. En la práctica sale gratis
—React Router lo hace por defecto—, pero tiene una consecuencia real: **el editor
no puede ser una ruta solo-cliente**.

**El razonamiento, que es de producto y no técnico.** El presupuesto de «esto
tiene que aguantar sin red» existe y es limitado, así que hay que elegir dónde
gastarlo:

```
   escribir una receta          cocinar una receta
   ───────────────────          ──────────────────
   en el sofá                   en la encimera
   con wifi                     con el móvil pringado
   una vez por receta           veinte minutos seguidos
   fase 2                       fase 4
```

Se gasta en la fase 4. Seguir una receta sin conexión es un objetivo declarado
del proyecto; crearla o modificarla sin conexión, explícitamente no.

**Consecuencia para la fase 4, anotada aquí para que no se pierda.** Esta fase no
construye nada de red, pero tampoco debe encarecerlo: la receta se lee en **una
sola consulta** —receta, líneas, pasos y enlaces—, no repartida en varias, que es
lo que permitiría cachearla como un documento. Queda además un problema que la
fase 4 tendrá que resolver y esta no: cachear una receta es cachear HTML
personalizado, y eso en un móvil compartido o después de cerrar sesión es una
fuga. Hoy el service worker no cachea navegaciones, y está escrito dos veces a
propósito (`navigateFallback: null`).

### D3 — El borrador vive en el servidor y se guarda al vuelo

No hay botón de guardar. Cada cambio —un campo, una línea, un paso— es una
escritura contra la fila del borrador, enviada con `fetcher.Form`.

**Por qué, y no un buffer en el cliente con un botón:** porque el modelo ya
decidió que toda receta nace borrador y que un borrador puede existir vacío. Eso
significa que la fila existe desde el primer instante y siempre hay dónde
escribir. Un buffer en el cliente reintroduce un segundo «sin terminar»
invisible, justo el que el modelo se había quitado de encima:

```
  Borrador en el servidor                Buffer en el cliente
  ───────────────────────                ────────────────────
  UN estado de "sin terminar":           DOS: el borrador guardado, y lo
  el borrador, y está en la base         que escribiste y no has enviado
  cerrar la pestaña no pierde nada       cerrar la pestaña pierde trabajo
```

La duda de si esto guarda pasos a medio escribir se responde con la misma frase
del diseño de la fase 1: **un borrador admite huecos por definición**. Guardar
«Sofríe la ce» no es un fallo, es un borrador.

**`fetcher.Form` no es un compromiso**: renderiza un `<form>` de verdad y sin
JavaScript hace un envío normal del navegador. La diferencia con `<Form>` es que
no navega, así que dos campos distintos pueden volar a la vez en lugar de
serializarse y revalidar la ruta entera cada uno.

**Un `fetcher` por campo o por fila, no uno por editor.** Un fetcher solo tiene
un envío en vuelo: el nuevo sustituye al anterior. Con una clave por campo, eso
da gratis lo que hace falta —dos ediciones del mismo campo se ordenan solas, y
dos campos distintos no se pisan—. Con un fetcher único, editar el paso 3 y
luego el 7 cancelaría el primero.

**Qué dispara el guardado:** `blur`, más un temporizador, más
`visibilitychange`. Solo `blur` tiene un agujero conocido: escribir el último
paso y cerrar la pestaña sin salir del campo. Y en un móvil «cerrar la pestaña»
es cambiar de aplicación, que es lo que `visibilitychange` detecta.

**Los errores dejan de ser síncronos, y eso es lo caro.** Con un botón, el fallo
aparece cuando pulsas. Al vuelo, el guardado del paso 7 puede fallar cuando ya
estás en el 9. Un aviso que se desvanece no vale: el error se queda pegado a la
fila que no se guardó, y el indicador global no puede decir «Guardado» mientras
haya una fila en rojo. Es material de spec: guardar al vuelo es una promesa a la
persona, y hay que escribir también qué pasa cuando no se cumple.

### D4 — El borrador se crea al pulsar «Nueva receta», y los vacíos se barren

Para escribir al vuelo hace falta un `id`, así que «Nueva receta» inserta la fila
y redirige al editor. Consecuencia inmediata y no hipotética: quien se lo piense
mejor deja un borrador vacío, y el ROADMAP quiere los borradores en su propia
sección de la lista, donde se ven.

**Alternativa descartada: crear la fila al primer cambio real.** Parece más
limpia y no lo es. Devuelve el hueco entre lo que se ve y lo que hay guardado que
D3 elimina, obliga al editor a tener dos modos —con fila y sin ella—, y deja sin
respuesta qué pasa si el primer gesto no es escribir el título sino arrastrar un
paso que todavía no existe. Es la misma preferencia que ya tomó la fase 1 al
resolver las líneas desde el primer momento: **se prefiere el desorden reparable
al desorden estructural**.

Se asume la basura y se limpia: una acción de descartar borrador, y un barrido de
los borradores sin título, sin líneas y sin pasos, que no contienen información y
se pueden retirar sin preguntar. Las Open Questions de la fase 1 ya dejaron la
puerta abierta a exactamente esto.

### D5 — Reordenar es arrastrar, y se manda el orden entero

Arrastrar con un asa. No botones `↑↓`.

**Lo que cuesta, para que nadie se lo encuentre de sorpresa.** La API nativa
`draggable` es de ratón: en iOS no ocurre nada. Hay que ir por Pointer Events, a
mano o con dependencia, y sería la primera dependencia de cliente del proyecto.
Hace falta un asa y no arrastrar la fila entera, porque dentro de una lista que
se desplaza en vertical el gesto de arrastrar y el de desplazar son el mismo
gesto para un dedo, y el asa es lo que los desambigua.

**Lo que arregla, y es más de lo que parece.** Al soltar se manda la lista
completa de una vez, no un intercambio de dos filas:

```sql
  reordenar_pasos(receta_id uuid, ids uuid[])   -- renumera por posición
```

Un viaje, atómico, y **ningún `unique (receta_id, orden)`**. Esa restricción,
que es la que uno escribiría por instinto, hace que intercambiar dos filas
reviente a mitad de sentencia. Índice a secas y renumerado en bloque. Lo mismo
para las líneas de ingrediente.

**Queda una pregunta abierta que no es de respaldo sino de accesibilidad:**
arrastrar no lo puede hacer un teclado ni un lector de pantalla. Como D2 ya
decidió no prometer nada sin JavaScript, los `↑↓` no hacen falta *como
respaldo*; si hacen falta *como accesibilidad* es otra decisión, con otro
motivo, y conviene no confundir las dos.

### D6 — `step_ingredients` nace en esta fase

El editor deja marcar qué líneas usa cada paso, desde el primer día.

**Lo que decide.** El `design.md` de la fase 1 le asigna un significado al hueco:
«un paso que no usa ninguna línea es perfectamente normal (*precalienta el
horno*)». Eso solo se sostiene si la anotación está completa. Aplazarla haría
que el hueco tuviera que significar dos cosas a la vez —«este paso no lleva
ingredientes» y «esto todavía no se ha rellenado»— y no hay forma de
distinguirlas. La comprobación de calidad que la fase 6 hereda de esa asimetría
daría falso positivo sobre todas las recetas escritas entre medias.

**Alternativa descartada: crearla en la fase 4, que es su primer consumidor
real.** Lo pedía una regla propia del ROADMAP —«ninguna tabla nace antes de que
exista quien la use»— y era un argumento serio mientras la unión fuera la parte
cara de la interfaz. D3 y D5 lo han debilitado: sobre un editor que ya tiene
estado, arrastre y guardado al vuelo, unas casillas por paso ya no son caras. Y
enfrente había tres costes: el hueco ambiguo de arriba, tener que anotar
retroactivamente todo lo escrito entre las dos fases —que es mucho peor que
anotarlo al escribirlo, porque entonces acabas de decidirlo—, y que la forma de
las tablas de esta fase depende igualmente de ella (ver abajo).

**Que sea tuya no basta: tiene que ser de la misma receta.** La RLS con
`perfil_id = auth.uid()` deja pasar que el paso 3 de la receta A apunte a la
línea 2 de la receta B, porque las dos recetas son tuyas. Es la trampa que
`pantry` resolvió con la clave ajena compuesta contra `(id, perfil_id)`, un
nivel más adentro:

```
  step_ingredients lleva receta_id, y dos claves ajenas compuestas:
      (paso_id,  receta_id) ──▶ steps (id, receta_id)
      (linea_id, receta_id) ──▶ recipe_ingredients (id, receta_id)
```

Lo que obliga a un `unique (id, receta_id)` en `steps` y en
`recipe_ingredients` — el mismo truco que `ingredients_id_perfil_key`. Esas dos
restricciones van en las tablas de esta fase se decida lo que se decida sobre
`step_ingredients`: aplazarla solo habría dejado dos restricciones que en su
momento no servirían para nada.

**Sin `unique (receta_id, ingrediente_id)` en las líneas.** Una receta puede
llevar dos líneas del mismo ingrediente —«100 ml de aceite para el sofrito, 50
para terminar»—, que es la razón entera de que los pasos apunten a la línea y no
al ingrediente. Y una fusión de ingredientes puede producir ese caso sin previo
aviso.

### D7 — Borrar una línea que algún paso usa falla; borrar el paso se lleva sus enlaces

La relación es asimétrica a propósito, porque el paso es el dueño de la
anotación y la línea es lo referenciado:

```
   borrar un PASO      ──▶  cascade    sus enlaces dejan de significar nada
   borrar una LÍNEA    ──▶  no action  falla, y dice qué pasos la usan
```

Nadie espera que borrar un paso falle «porque menciona ingredientes». Y borrar
en silencio una línea que tres pasos citan sí que perdería información: el
enlace es la única constancia de que ese paso usaba ese ingrediente.

**`no action`, no `restrict`.** Es la lección literal de `pantry`, un nivel más
adentro. Con `restrict` la comprobación es inmediata y **borrar una receta
entera fallaría**: la cascada desde `recipes` intentaría vaciar
`recipe_ingredients` y saltaría antes de que `step_ingredients` estuviese
limpio. Con `no action` la comprobación es al final de la sentencia y la cascada
ordena el destrozo sola.

**El mensaje tiene que decir cuáles.** «No se puede borrar: la usan los pasos 3
y 7». Sin eso, fallar es un muro en vez de una barandilla — que es exactamente
la forma que ya tiene el mensaje de la despensa en `cocina.server.ts`.

**Consecuencia sobre código existente:** `eliminarIngrediente` responde hoy al
código `23503` con «Ese ingrediente está en tu despensa». A partir de esta fase
el motivo puede ser una receta, y el mensaje miente. Entra en la capability
`ingredients` modificada del proposal.

### D8 — Una receta terminada es inmutable; editarla es devolverla a borrador

**Qué hace falta para finalizar:** `titulo` no vacío, al menos una línea de
ingrediente, y al menos un paso. `comensales` queda **opcional**: ninguna fase
calcula nada con él, así que exigirlo es fricción sin premio.

Lo de la línea y el paso no es simetría: una receta sin ingredientes saldría
siempre en el «qué puedo hacer» de la fase 3, y una sin pasos no es una receta
sino una lista de la compra —y deja al modo cocina de la fase 4 sin nada que
recorrer—. **Aviso para la fase 3:** exigir ≥1 línea no le resuelve el
denominador a cero. Una receta cuyas líneas sean todas `se_asume` lo tiene
igual, así que el «0 de 0» hay que responderlo allí de todas formas.

**El problema no es finalizar, es lo que pasa después.** Un `CHECK` cubre el
título, que vive en la propia fila. «Al menos un paso» está en otra tabla y un
`CHECK` no lo ve, así que una comprobación en el momento de finalizar no impide
borrar el último paso al día siguiente. Y con guardado al vuelo no hay un
momento de «guardar» donde volver a comprobar: cada tecleo es una escritura.

Por eso **una receta terminada no se edita**. El editor solo trabaja sobre
borradores; para tocar una receta terminada hay que devolverla a borrador
primero, y eso es un gesto explícito.

**Alternativas descartadas:**

- *Editar en sitio con triggers que vigilen las invariantes.* Airtight, pero son
  triggers en dos tablas y choca de frente con D3: no está claro qué debe pasar
  cuando la comprobación salta a media tecleada.
- *Editar en sitio y devolver la receta a borrador sola cuando deja de cumplir.*
  Nunca bloquea, pero «se me ha desfinalizado sola» es magia, y la magia en una
  aplicación que guarda al vuelo es indistinguible de un fallo.

**Lo decisivo es que D3 ya había elegido esta.** El editor entero está
construido sobre «el borrador es la fila». Si además editara recetas terminadas,
o tendría dos modos o rompería la invariante. Con esta decisión, «volver a
borrador» deja de ser una funcionalidad rara y pasa a ser **la puerta de entrada
al editor**, y de paso responde a algo que no estaba decidido en ningún
documento —si se puede desfinalizar— con un sí que además tiene un motivo.

**Coste asumido:** corregir una errata saca la receta de la lista principal
hasta que se vuelve a finalizar. Se puede maquillar en la lista («en edición»)
sin tocar el modelo.

**Consecuencias concretas:**

- `/recetas/:id/editar` sobre una receta terminada no edita: redirige al
  detalle, que es donde está el botón de devolverla a borrador.
- Devolver a borrador es un `update` que pone `finalizada_en` a nulo. **Pierde
  la fecha original**, y se acepta: nadie la lee. Lo que sí se conserva para
  siempre es `origen_tipo`, que es una procedencia y no un estado — que es la
  razón de que sean dos columnas.
- El barrido de borradores vacíos de D4 no puede tocar una receta que volvió a
  borrador: tiene título, líneas y pasos, así que queda fuera por construcción.
  El **botón** de descartar borrador sí la alcanza, y ahí no está descartando un
  borrador vacío sino borrando una receta hecha. Necesita otra confirmación.

### D9 — La comprobación vive en una función, pero la puerta no está cerrada

`finalizar_receta(id)` comprueba y sella en una sola sentencia. **Y la
aplicación conserva `update` sobre `finalizada_en`**, así que la función es
donde vive la regla, no lo que la impone.

Se justifica igual que la D5 de la fase 1, pero por atomicidad y no por
privilegio: comprobar desde la aplicación y escribir después son dos viajes con
una ventana en medio.

**Alternativa descartada, y merece quedar escrita porque es la única forma de
cerrar la puerta de verdad:** privilegios por columna
—`grant update (titulo, comensales)`, dejando `finalizada_en` fuera—, lo que
obligaría a que la función fuese `security definer`. La D5 rechazó
`security definer` con la frase «elevar privilegios sin necesitarlo es regalar
superficie», y este sería el primer sitio del proyecto donde se necesitaría de
verdad. Se descarta de todas formas: para el tamaño de esto es rigor de más.

**Lo que eso deja, dicho sin adornos:**

```
  garantiza la base de datos          promete la aplicación
  ──────────────────────────          ─────────────────────
  título presente si está             ≥1 línea y ≥1 paso
  finalizada (CHECK en la fila)       si está finalizada
  el aislamiento por perfil (RLS)     que nadie escriba en una
  la integridad referencial            receta terminada (D8)
```

La columna derecha es una **convención, no una garantía**. Si un día un `action`
se equivoca, la base de datos no lo va a parar. Es una decisión consciente, y el
sitio donde mirar si alguna vez aparece una receta terminada sin pasos.

### D10 — `cantidad` es texto libre

«2 dientes», «un chorro», «al gusto». Número más unidad exigiría una tabla de
unidades y sus conversiones, y obligaría a inventar una cifra donde la receta no
la tiene. Ninguna fase calcula nada con este valor: la cobertura de la fase 3
cruza ingredientes, no cantidades.

## Risks / Trade-offs

**El editor es la primera pantalla con estado del proyecto** → Lo que se invente
aquí será el estilo de la casa para el modo cocina y el importador por omisión,
sin que nadie lo decida. Mitigación: que el estado que se introduzca sea el
mínimo —el de los `fetcher`, que es de React Router y no propio— y que arrastrar
quede acotado a un componente.

**Guardar al vuelo esconde los fallos** → Un error asíncrono es fácil de no ver,
y la promesa «no perderás lo que escribas» se rompe en silencio. Mitigación en
D3: error pegado a la fila, e indicador global que no miente. Es lo primero que
hay que probar, no lo último.

**Arrastrar en un móvil dentro de una lista que hace scroll sale mal a menudo**
→ Es la interacción más arriesgada de la fase. Mitigación: asa obligatoria y
`touch-action` en ella. Riesgo residual aceptado: si en pruebas reales resulta
insufrible, la salida es un «mover a la posición N», que es feo y funciona
siempre.

**Los borradores vacíos ensucian la lista** → Aceptado en D4 a cambio de no
tener dos modos de editor. Mitigación: el barrido.

**Ampliar `fusionar_ingredientes` toca una función ya probada** → Hoy traslada
despensa y borra; con recetas dentro tiene que reasignar también líneas, y una
fusión mal hecha se lleva por delante datos de recetas sin deshacer posible.
Mitigación: la propia migración de la fase 1 dejó señalado el sitio, y la
operación ya es transaccional.

## Migration Plan

Una migración con las cuatro tablas, sus políticas, sus privilegios explícitos y
las funciones de reordenado; y una segunda que amplía
`fusionar_ingredientes`. No hay datos previos de recetas, así que no hay
migración de datos: la vuelta atrás es tirar las cuatro tablas y restaurar la
versión anterior de la función.

Se aplica primero en local con `supabase db reset` y se comprueba con
`supabase db diff --linked` antes de subirla, que es como se descubrió el
problema de privilegios de `profiles`: leyendo el diff, no el SQL.

## Open Questions

- **Qué forma toma el camino de teclado para reordenar.** Que tiene que
  haberlo está decidido —arrastrar no lo puede hacer un lector de pantalla, y
  eso es accesibilidad, no respaldo sin JavaScript, que D2 ya descartó—. Si son
  `↑↓`, un «mover a la posición N» o atajos sobre el elemento enfocado no cambia
  el modelo ni las tablas: es un control más sobre la misma llamada de
  reordenado.
- **El orden de la lista de recetas.** Alfabético o por edición más reciente. No
  toca el modelo.
- **Preseleccionar las líneas de un paso a partir de su texto.** Cuando el texto
  del paso contiene el nombre de una línea («Sofríe la **cebolla**»), esa casilla
  podría venir ya marcada, convirtiendo la anotación de D6 en confirmar o
  desmarcar en vez de en una tarea. La coincidencia sale gratis: `normalizado`
  existe desde la fase 1. **Queda fuera de esta fase por decisión expresa.** Se
  anota porque converge con la fase 6 —el modelo que extrae del vídeo produce
  esos enlaces directamente— y porque es una sugerencia, no una regla: añadirla
  después no cambia el modelo, las specs ni ningún dato ya escrito.

## Reparto del trabajo

Decidido al escribir `tasks.md`, y en contra de lo que proponía el ROADMAP. Este
sugería modelo, lista y detalle primero y el editor después; su propia pega era
que ese entregable intermedio no lo puede usar nadie sin acceso a la base de
datos. El orden elegido entrega **un editor de borradores usable a mitad de
camino**: la lista llega antes que el editor, pero mínima, para poder alcanzar
un borrador y no como entregable en sí.
