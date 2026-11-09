## ADDED Requirements

### Requirement: Una línea de ingrediente puede ser opcional

Una línea de ingrediente SHALL poder marcarse como opcional: un ingrediente que
la receta admite pero sin el que se puede cocinar igualmente, como «perejil para
decorar». Una línea nueva SHALL nacer no opcional.

La marca SHALL ser de la línea y no del ingrediente. Marcar una línea como
opcional NO SHALL cambiar nada en otras recetas ni en el catálogo, ni en otras
líneas del mismo ingrediente dentro de la misma receta.

La marca SHALL ser distinta de «se da por supuesto» (véase `ingredients`).
Aquello es una propiedad del ingrediente que vale para todo el recetario; esto
es una propiedad de una línea de una receta concreta. Las dos SHALL poder
coexistir sin que una cambie la otra.

Poner o quitar la marca SHALL guardarse sin pedirlo, igual que la cantidad y la
nota. Como el resto de la receta, solo SHALL poder cambiarse mientras la receta
es un borrador.

Que todas las líneas de una receta sean opcionales NO SHALL impedir terminarla:
la condición de tener al menos una línea de ingrediente se cumple igual.

#### Scenario: Marcar una línea como opcional

- **WHEN** una persona marca como opcional la línea «perejil» de un borrador y cierra el editor
- **THEN** al volver a abrirlo la línea sigue marcada como opcional

#### Scenario: Línea nueva

- **WHEN** una persona añade una línea a un borrador
- **THEN** la línea no está marcada como opcional

#### Scenario: La marca no sale de su línea

- **WHEN** una persona marca como opcional el «perejil» de una receta y otra receta suya también lleva perejil
- **THEN** en la otra receta el perejil sigue sin ser opcional, y el ingrediente no cambia en el catálogo

#### Scenario: Opcional y supuesto a la vez

- **WHEN** una persona marca como opcional una línea de «sal», que ya se da por supuesta
- **THEN** la línea queda opcional y la sal se sigue dando por supuesta en todas sus recetas

#### Scenario: Receta terminada

- **WHEN** una persona abre una receta terminada
- **THEN** no puede cambiar qué líneas son opcionales sin devolverla antes a borrador
