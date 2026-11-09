## Context

La motivación está en `proposal.md`, y lo que debe hacer, en
`specs/cook-mode/spec.md`. Aquí van el punto de partida y las restricciones que
deciden el cómo.

- **Los datos ya están.** `leerReceta` (`app/lib/recetario.server.ts`) trae en
  una sola consulta la receta, sus líneas con cantidad, nota y `opcional`, y sus
  pasos con las líneas que usa cada uno (`PasoReceta.lineas`, ids de línea). El
  modo cocina no necesita nada más, y no añade nada a la base de datos.
- **Sin modo sin conexión, por decisión** (entrada 4 de `PENDIENTE.md`). Esta
  fase no guarda nada en el dispositivo ni toca el service worker, que sigue sin
  cachear navegaciones.
- **Cada carga va al servidor.** La sesión viaja en cookies que solo lee el
  servidor, y cada `loader` consulta Supabase. Si cada cambio de paso fuera una
  navegación con `loader`, cada «Siguiente» costaría un viaje a Supabase, y se
  notaría justo en el gesto que más se repite.
- **`app-shell` exige que lo que se lee no dependa de JavaScript.** El editor
  quedó exento por decisión (D2 de la fase 2), pero esta es una pantalla de
  lectura.
- **El detalle (`app/routes/receta.tsx`) ya redirige los borradores al editor.**
  El modo cocina hace lo mismo, por simetría.

## Goals / Non-Goals

**Goals:**

- Que pasar de paso sea instantáneo: sin consulta a la base de datos por paso.
- Que la misma ruta funcione sin JavaScript, sin tener que mantener un segundo
  camino aparte.
- Que el deslizamiento no se pelee con el desplazamiento vertical ni con el
  gesto de «atrás» del sistema.

**Non-Goals:**

- Mostrar en el modo cocina la cobertura de la despensa. El detalle ya la
  enseña, justo antes de pulsar «Cocinar».
- Animaciones de transición entre pasos. Se pueden añadir después sin tocar
  nada de lo de aquí.
- Recordar por dónde ibas entre sesiones. Eso sería una escritura, y el modo
  cocina no escribe nada. La URL ya lo recuerda dentro de la misma pestaña.

## Decisions

### D1 — Una ruta, y el paso en un parámetro de búsqueda

```
  /recetas/:id/cocinar           antes de empezar
  /recetas/:id/cocinar?paso=3    paso 3 (empieza en 1, como lo lee una persona)
```

Una sola ruta, `app/routes/receta.cocinar.tsx`, con un `loader` que llama a
`leerReceta` y nada más. La pantalla que se ve sale de `?paso=` en el
componente.

La clave es `shouldRevalidate`. Devuelve `false` cuando la navegación es a la
misma ruta y solo cambia el parámetro de búsqueda, y no hay formulario de por
medio, porque el modo cocina no tiene ninguno:

```
  primera carga        loader → leerReceta → HTML con todo   (un viaje)
  «Siguiente» con JS   cambia ?paso, sin loader               (cero viajes)
  «Siguiente» sin JS   <a href="?paso=4"> → carga completa    (un viaje)
```

Así los controles son enlaces de verdad (`<Link to="?paso=4">`), que funcionan
sin JavaScript porque el navegador los sigue y el servidor pinta el paso. Con
JavaScript se quedan en el cliente y cambian de paso al instante. Como el
cambio de paso no hace ningún viaje, si la red se cae a mitad de la receta se
puede seguir avanzando por la que ya está cargada. No es una promesa de modo
sin conexión, y la spec no la hace: recargar sin red falla, igual que en el
resto de la aplicación.

**Alternativa descartada: un segmento por paso, `/recetas/:id/cocinar/3`.** Es
igual de enlazable, pero cada paso es otra ruta, y evitar la consulta exigiría
una ruta padre con `<Outlet>` y la receta en el padre. Es más estructura para
conseguir lo mismo que un parámetro de búsqueda.

**Alternativa descartada: el paso solo en el estado de React.** Es lo más
sencillo, pero recargar volvería al principio, el botón atrás saldría del modo
cocina y sin JavaScript no habría manera de avanzar. Incumple tres escenarios de
la spec.

**Paso fuera de rango.** Si `?paso=` no es un número entre 1 y el número de
pasos, el `loader` redirige a `/recetas/:id/cocinar`. Así la URL no miente sobre
lo que se ve. Con JavaScript eso solo puede llegar tecleando la dirección, que
es una carga completa y pasa por el `loader`, así que no hace falta repetir la
comprobación en el cliente.

### D2 — Cada cambio de paso es una entrada del historial

Los enlaces y el deslizamiento hacen una navegación normal, que se apila, y no
`replace`. Así el botón «atrás» del navegador deshace el último cambio, como
pide la spec. Como consecuencia buena, en iOS el gesto de deslizar desde el
borde izquierdo, que es el «atrás» del sistema, lleva al paso anterior en lugar
de sacar a la persona del modo cocina.

Para salir sin recorrer los pasos hacia atrás hay un enlace «Salir», siempre
visible, que lleva al detalle. «Terminar», en el último paso, va al mismo sitio.

### D3 — Deslizar: eventos de puntero, y el desplazamiento vertical se lo queda el navegador

Un componente de cliente envuelve la pantalla y escucha `pointerdown`,
`pointermove` y `pointerup`. Ese contenedor lleva `touch-action: pan-y`: el
navegador se queda con el desplazamiento vertical, nativo y con su inercia, y
entrega al código los gestos horizontales. Cuenta como deslizamiento solo si se
cumplen las dos condiciones:

```
  |dx| ≥ umbral (en torno a 60 px)   y   |dx| > 1,5 · |dy|
```

Lo segundo es lo que impide que leer un paso largo salte de paso: un gesto que
es sobre todo vertical no cuenta aunque se tuerza un poco. El deslizamiento
navega a los mismos destinos que los controles (D2), con los límites de la spec:
no vuelve desde «Antes de empezar» ni termina desde el último paso. Terminar
necesita el control explícito para que un roce no saque a nadie de la receta.

Sin JavaScript el componente no hace nada, y los controles de D1 bastan.

**Alternativa descartada: una librería de gestos.** Esto son tres oyentes y dos
comparaciones. La fase 2 ya metió la única dependencia de cliente del proyecto,
para el arrastre táctil, y esto no la justifica.

**Alternativa descartada: un carrusel con `scroll-snap`.** Deslizar sería nativo
y con su animación, pero obligaría a pintar todos los pasos a la vez en una
tira horizontal. Eso choca con D1, donde cada paso es una URL, y con D5, donde
el foco va a la pantalla nueva.

### D4 — La pantalla mantenida: Wake Lock, pedido al entrar y otra vez al volver

Un hook de cliente, `useMantenerPantalla`, que al montarse:

1. Si existe `navigator.wakeLock`, pide `request("screen")`.
2. Escucha `visibilitychange`, y al volver a `visible` lo pide otra vez. El
   navegador lo suelta solo al ocultarse la página, y la spec exige recuperarlo.
3. Al desmontarse, lo suelta con `release()` y quita el oyente. Desmontarse es
   salir del modo cocina, hacia el detalle o hacia cualquier otra pantalla.

El hook vive en la ruta del modo cocina, no en cada paso, así que cambiar de
paso no lo suelta ni lo vuelve a pedir.

Cualquier fallo se traga en silencio: que no exista la API, que el navegador lo
deniegue o que la batería esté baja. El modo cocina sigue igual. Para cumplir
«la persona puede saber si se mantiene», hay un texto discreto («La pantalla no
se apagará») que solo aparece mientras el bloqueo está activo de verdad, según
el evento `release` del propio bloqueo. Sin bloqueo no se dice nada, y en
particular nada de «no se ha podido», que solo estorbaría.

### D5 — Al cambiar de pantalla, el foco va a su encabezado

Cada pantalla abre con un encabezado («Antes de empezar», «Paso 3 de 7») con
`tabIndex={-1}`. Un efecto, que depende de la pantalla actual y no se ejecuta en
la primera carga, le pasa el foco al cambiar. Así un lector de pantalla anuncia
el paso nuevo y sigue leyendo desde ahí, en vez de quedarse en el botón
«Siguiente», que ya no tiene contexto. En la primera carga no se roba el foco,
y la página se comporta como cualquier otra.

### D6 — Distribución de la pantalla: el texto arriba, los controles abajo y fijos

```
  ┌───────────────────────────────┐
  │ Salir            La pantalla… │  barra superior, pequeña
  │                               │
  │ Paso 3 de 7                   │  encabezado (D5)
  │ Sofríe la cebolla a fuego     │  texto en grande, pre-wrap,
  │ lento hasta que esté…         │  se desplaza si es largo
  │                               │
  │ · 1 cebolla — picada          │  las líneas de ESTE paso
  │ · 2 dientes de ajo            │
  │                               │
  │ [ Anterior ]  [ Siguiente  ]  │  fijos abajo, sobre el indicador
  └───────────────────────────────┘  de gestos (safe-area-inset-bottom)
```

Los controles quedan fijos abajo, al alcance del pulgar, para que «Siguiente»
esté siempre en el mismo sitio aunque el paso sea largo. Respetan el área segura
inferior, como exige `app-shell`; `app.css` ya resuelve las áreas seguras en el
contenedor principal, y la barra fija tiene que sumarse a eso, no ignorarlo. El
texto del paso va más grande que el cuerpo normal para leerse a distancia de
brazo, con los tokens del design system y sin valores literales.

Los ingredientes del paso salen de cruzar `paso.lineas` (ids) con
`receta.lineas`, en el orden de la receta. Es el mismo cruce que ya hace el
detalle.

### D7 — La entrada: un botón en el detalle

«Cocinar» es el botón principal (`btn-primary`) del detalle de una receta
terminada, arriba, antes de los ingredientes. Es lo que se hace con una receta
terminada. «Volver a borrador» sigue donde estaba, abajo y secundario.

## Risks / Trade-offs

**[Wake Lock en la aplicación instalada en iOS]** → La API existe en Safari, pero
su comportamiento en aplicaciones web instaladas en la pantalla de inicio ha
sido irregular según la versión de iOS. Mitigación: probarlo en un iPhone de
verdad, en Safari y en la aplicación instalada, antes de dar la tarea por hecha.
Si no funciona en la instalada, el diseño ya lo absorbe, porque el texto de D4
no aparece y no se promete nada. Se apunta en `PENDIENTE.md` en vez de buscar
remedios como el vídeo silencioso en bucle.

**[El umbral del deslizamiento es una estimación]** → 60 px y la proporción 1,5
son puntos de partida razonables, no medidas. Mitigación: ajustarlos en un
teléfono real con un paso largo. Son dos constantes y cambiarlas no toca nada
más.

**[Un deslizamiento sobre texto puede seleccionarlo]** → Mantener el dedo y
arrastrar selecciona palabras en algunos navegadores. Mitigación: no se quita
la selección de texto, que es útil para copiar un paso. Solo se ignoran los
gestos que empiezan con una pulsación larga, porque esos son de seleccionar.

**[La receta cargada puede quedarse vieja]** → Con `shouldRevalidate` en `false`
no se vuelve a leer mientras se cambia de paso. No es un problema real: una
receta terminada no se edita (D8 de la fase 2), así que no puede cambiar
mientras alguien la cocina.

## Migration Plan

No hay migración de base de datos. Basta con desplegar la aplicación, y la
vuelta atrás es desplegar la versión anterior. La ruta nueva no afecta a ninguna
de las existentes, salvo el botón añadido en el detalle.

## Open Questions

- **El umbral exacto del deslizamiento.** Se ajusta en un teléfono real (ver
  Riesgos) y no cambia ni la spec ni las tareas.
