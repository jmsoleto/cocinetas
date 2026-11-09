## Why

Cocinetas ya sabe guardar recetas y decirte cuáles puedes hacer con lo que hay
en casa, pero no te ayuda en el momento en que más falta hace: con el móvil en
la encimera y las manos sucias. Hoy, cocinar una receta es leer su detalle de
arriba abajo, buscar con la vista por qué paso ibas y desbloquear el teléfono
cada vez que se apaga. Es la fase 4 del roadmap. Solo depende de que existan
recetas terminadas, y existen desde la fase 2.

## What Changes

- **Un botón «Cocinar» en el detalle de cada receta terminada.** Lleva al modo
  cocina. Los borradores no lo tienen: un borrador no se cocina.
- **«Antes de empezar».** Es la primera pantalla del modo cocina: todos los
  ingredientes de la receta, con su cantidad y su nota, y las líneas opcionales
  señaladas como tales. Sirve para sacarlo todo antes de encender el fuego.
- **Un paso por pantalla.** El texto del paso en grande, «Paso 3 de 7», y al
  lado los ingredientes que usa ese paso, con su cantidad y su nota. Es el dato
  que la fase 2 guardó a propósito (`step_ingredients`) y que hasta ahora solo se
  veía en letra pequeña en el detalle.
- **Adelante y atrás**, con botones grandes y deslizando el dedo. Desde el primer
  paso se vuelve a «Antes de empezar», y el último paso termina y devuelve al
  detalle de la receta.
- **La posición va en la URL.** Recargar no te devuelve al principio, el botón
  «atrás» del navegador funciona, y los botones son enlaces que funcionan sin
  JavaScript.
- **La pantalla no se apaga** mientras estás en el modo cocina, en los
  dispositivos que lo permiten (Wake Lock API). Donde no se puede, el modo cocina
  funciona igual.
- **Sin escrituras.** El modo cocina solo lee, como pedía el roadmap: ni
  cronómetro, ni marcar pasos como hechos, ni recordar por dónde ibas entre
  sesiones.

## Capabilities

### New Capabilities

- `cook-mode`: cocinar una receta terminada paso a paso: la pantalla de antes de
  empezar, un paso por pantalla con sus ingredientes, la navegación con botones y
  deslizando, la posición en la URL y la pantalla que no se apaga.

### Modified Capabilities

Ninguna. El botón de entrada vive en el detalle de la receta, pero lo que
promete forma parte de `cook-mode`. La spec de `recipes` no cambia.

## Impact

- **Base de datos**: nada. Ni tablas, ni columnas, ni vistas, ni migraciones.
- **Código**: una ruta nueva, `app/routes/receta.cocinar.tsx`, registrada en
  `app/routes.ts` y con su URL en `app/rutas.ts`. Reutiliza `leerReceta` tal
  cual. Lleva dos piezas de cliente propias: el deslizamiento y la pantalla
  mantenida. En `app/routes/receta.tsx` se añade el botón «Cocinar».
- **Dependencias**: ninguna nueva. Wake Lock y los eventos de puntero son APIs
  del navegador.
- **Fuera de esta fase**: el modo sin conexión (se decidió no darle soporte,
  entrada 4 de `PENDIENTE.md`), el fallo de red del editor (entrada 6, aplazada
  a propósito), atajos de teclado, cronómetros, marcar pasos y ver en el modo
  cocina qué te falta de la despensa. Eso último ya lo dice el detalle antes de
  pulsar «Cocinar».
