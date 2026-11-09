El orden va de lo que funciona sin JavaScript a lo que lo necesita. Primero la
ruta y sus pantallas con enlaces de verdad, que ya cumplen casi toda la spec.
Después lo que vuelve instantáneo el cambio de paso. Al final, las dos piezas
de cliente (deslizar y pantalla mantenida), que son mejoras sobre algo que ya
funciona.

Hitos: al acabar el grupo 1 se puede cocinar una receta entera sin JavaScript;
al acabar el 2, con JavaScript y sin esperas; al acabar el 4, la fase está
entregada.

## 1. La ruta y sus pantallas

- [x] 1.1 Registrar `recetas/:id/cocinar` en `app/routes.ts` y añadir `rutaCocinar(id, paso?)` en `app/rutas.ts`. Verificar que `npm run typecheck` genera los tipos de la ruta nueva
- [x] 1.2 `loader` con `exigirUsuario` y `leerReceta`, sin ninguna lectura más. Una receta que no existe o es ajena da 404, como el detalle. Un borrador redirige a su editor. Un `?paso=` que no sea un número entre 1 y el número de pasos redirige a `/recetas/:id/cocinar` (D1). Verificar los cuatro casos a mano en la URL, incluido el de una receta de otra cuenta
- [x] 1.3 Pantalla «Antes de empezar»: todas las líneas en el orden de la receta, con cantidad, nota y la etiqueta «opcional» en texto. Verificar con una receta que tenga una línea opcional y otra sin cantidad
- [x] 1.4 Pantalla de un paso: «Paso N de M», el texto con `white-space: pre-wrap`, y las líneas que usa ese paso cruzando `paso.lineas` con `receta.lineas`. Si no usa ninguna, sin lista ni aviso. Verificar un paso con dos líneas, uno sin ninguna, y una receta con dos líneas del mismo ingrediente en pasos distintos (cada paso muestra la suya)
- [x] 1.5 Controles como `<Link>`: «Empezar» en antes de empezar; «Anterior» y «Siguiente» en cada paso, donde «Anterior» del paso 1 lleva a antes de empezar; «Terminar» en el último, que lleva al detalle. Y «Salir» siempre visible. Verificar con JavaScript deshabilitado que se recorre una receta entera de principio a fin, y que recargar en el paso 3 sigue en el paso 3
- [x] 1.6 Botón «Cocinar» (`btn-primary`) en el detalle de las terminadas, arriba y antes de los ingredientes (D7). Verificar que lleva a antes de empezar, y que el editor de un borrador no lo muestra

## 2. Pasar de paso sin esperar

- [x] 2.1 `shouldRevalidate` que devuelva `false` cuando solo cambia el parámetro de búsqueda en la misma ruta y no hay `formData` (D1). Verificar en la pestaña de red que avanzar de paso no hace ninguna petición, y que la primera carga sí trae la receta
- [x] 2.2 Comprobar que el botón «atrás» del navegador deshace el último cambio de paso (D2), y en un iPhone que el gesto de deslizar desde el borde izquierdo lleva al paso anterior, no fuera del modo cocina
- [x] 2.3 Foco al encabezado de la pantalla nueva al cambiar, sin robarlo en la primera carga (D5). Verificar con VoiceOver que al pulsar «Siguiente» se anuncia «Paso N de M» y se lee el texto

## 3. Deslizar y pantalla mantenida

- [x] 3.1 Componente de deslizamiento con eventos de puntero y `touch-action: pan-y`, que cuente solo si `|dx|` supera el umbral y es más de 1,5 veces `|dy|` (D3). Navega a los mismos destinos que los controles, no vuelve desde antes de empezar y no termina desde el último paso. Verificar en un teléfono de verdad: deslizar cambia de paso, desplazarse por un paso largo no, y deslizar en el último paso no sale de la receta
- [x] 3.2 Ajustar el umbral en el teléfono si con 60 px salta de paso al leer o cuesta deslizar a propósito. Dejar el valor final en una constante con un comentario de cómo se eligió
- [x] 3.3 Hook `useMantenerPantalla` (D4): pide el bloqueo al montarse, lo vuelve a pedir al volver a `visible` y lo suelta al desmontarse. Traga en silencio cualquier fallo. Muestra «La pantalla no se apagará» solo mientras el bloqueo está activo. Verificar en el navegador del ordenador que el texto aparece, que desaparece al salir al detalle, y que en un navegador sin `navigator.wakeLock` no aparece nada ni da error
- [x] 3.4 Verificar en un iPhone, en Safari y en la aplicación instalada, que la pantalla no se bloquea en un paso más tiempo del habitual y que vuelve a mantenerse tras cambiar de aplicación. Si en la instalada no funciona, apuntarlo en `PENDIENTE.md` con lo observado, y no buscar remedios en esta fase (Riesgos del diseño)

## 4. Acabado y verificación

- [x] 4.1 Estilos en CSS Modules sobre los tokens, sin valores literales: texto del paso más grande que el cuerpo, y controles fijos abajo y grandes, sumando el área segura inferior (D6). Verificar `npm run lint`, y a ancho de teléfono que «Siguiente» no queda bajo el indicador de gestos ni tapa el final de un paso largo
- [x] 4.2 Actualizar `openspec/ROADMAP.md`: la fase 4 apunta al change y a la spec `cook-mode`, y se marca como hecha al archivar. Verificar que lo que dice coincide con lo construido
- [x] 4.3 Recorrer a mano todos los escenarios de `specs/cook-mode` contra la aplicación en marcha, con y sin JavaScript, y con una segunda cuenta para el de la receta ajena
- [x] 4.4 Cocinar una receta real de principio a fin con el móvil en la encimera. Es la única forma de saber si el deslizamiento, los controles y la pantalla mantenida aguantan el uso
- [x] 4.5 Pasar `npm run typecheck`, `npm run lint` y `npm run format:check` en limpio
