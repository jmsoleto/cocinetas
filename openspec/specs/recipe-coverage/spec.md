## Purpose

Define el cruce entre lo que una persona tiene en casa y lo que sabe cocinar:
qué ingredientes necesita de verdad cada receta, cuántos de ellos están en la
despensa, cómo se cuenta en la lista y en el detalle, y cómo se ven solo las
recetas que se pueden hacer ya. Es lo que hace que Cocinetas no sea otro
recetario.

## Requirements

### Requirement: Qué ingredientes necesita de verdad una receta

Los ingredientes necesarios de una receta SHALL ser los ingredientes distintos a
los que apuntan sus líneas, quitando dos casos:

- los ingredientes que la persona da por supuestos (véase `ingredients`);
- los que solo aparecen en líneas opcionales (véase `recipes`).

Cada ingrediente SHALL contar una sola vez aunque la receta lo lleve en varias
líneas. Si un ingrediente aparece en una línea opcional y también en otra que no
lo es, SHALL contar como necesario.

Un ingrediente necesario SHALL contar como «lo tienes» si está en la despensa de
la persona, y como «falta» si no está. No hay término medio: la despensa no
guarda cantidades (véase `pantry`).

La cobertura SHALL calcularse siempre con la despensa y el catálogo de ese
momento. Añadir o quitar algo de la despensa, o poner o quitar la marca de «se
da por supuesto», SHALL reflejarse la próxima vez que se muestre la receta, sin
que la persona tenga que hacer nada más.

#### Scenario: Una receta con lo de siempre

- **WHEN** una receta lleva cebolla, huevo, patata y sal, la sal se da por supuesta, y la despensa tiene cebolla y patata
- **THEN** la receta necesita 3 ingredientes y tienes 2; falta el huevo

#### Scenario: Dos líneas del mismo ingrediente

- **WHEN** una receta lleva «100 ml de aceite» y «50 ml de aceite», el aceite no se da por supuesto y no está en la despensa
- **THEN** el aceite cuenta como un ingrediente que falta, no como dos

#### Scenario: Una línea opcional

- **WHEN** una receta lleva tomate y «perejil para decorar» marcado como opcional, y la despensa tiene tomate pero no perejil
- **THEN** la receta necesita 1 ingrediente y lo tienes

#### Scenario: Opcional en una línea, necesario en otra

- **WHEN** una receta lleva perejil en una línea opcional y otra vez en una línea que no lo es, y el perejil no está en la despensa
- **THEN** el perejil cuenta como un ingrediente que falta

#### Scenario: La despensa cambia

- **WHEN** a una receta solo le falta nata y la persona añade nata a su despensa
- **THEN** la próxima vez que vea la receta ya no le falta nada

#### Scenario: Se quita la marca de un básico

- **WHEN** una receta lleva sal, la persona quita la marca de «se da por supuesto» de la sal y no tiene sal en la despensa
- **THEN** la sal pasa a contar como un ingrediente que falta en esa receta

### Requirement: Solo las recetas terminadas tienen cobertura a la vista

La cobertura SHALL mostrarse en las recetas terminadas. Los borradores NO SHALL
mostrarla: un borrador no se puede cocinar y sus líneas pueden estar a medias,
así que un «Tienes todo» en un borrador prometería algo que no existe.

#### Scenario: Un borrador en la lista

- **WHEN** una persona tiene un borrador cuyos ingredientes están todos en su despensa
- **THEN** en la lista el borrador aparece entre los borradores, sin cobertura y sin «Tienes todo»

### Requirement: La lista muestra cuánto tienes de cada receta

En la lista de recetas, cada receta terminada SHALL mostrar su cobertura:

- si falta algún ingrediente necesario, cuántos tienes del total de necesarios,
  en la forma «4/7»;
- si no falta ninguno, «Tienes todo», sin número.

Cuando falten uno o dos ingredientes, la lista SHALL nombrarlos junto a la
receta («Falta: nata», «Faltan: nata y puerro»). Cuando falten más, SHALL bastar
con el número.

Una receta sin ningún ingrediente necesario, porque todos se dan por supuestos o
son opcionales, SHALL mostrarse como «Tienes todo». NO SHALL mostrar «0/0» ni
ninguna otra fracción con denominador cero.

#### Scenario: Faltan varios

- **WHEN** una receta terminada necesita 7 ingredientes y tienes 4
- **THEN** la lista muestra «4/7» junto a la receta, sin nombrar los que faltan

#### Scenario: Falta uno

- **WHEN** a una receta terminada solo le falta la nata
- **THEN** la lista muestra la cobertura y «Falta: nata»

#### Scenario: No falta nada

- **WHEN** todos los ingredientes necesarios de una receta terminada están en la despensa
- **THEN** la lista muestra «Tienes todo» y ningún número

#### Scenario: Solo básicos

- **WHEN** una receta terminada solo lleva sal, aceite y agua, y los tres se dan por supuestos
- **THEN** la lista muestra «Tienes todo», no «0/0»

### Requirement: Las recetas terminadas se ordenan por lo que les falta

En la lista, las recetas terminadas SHALL aparecer ordenadas de menos a más
ingredientes que faltan: primero las que no les falta nada, después las que les
falta uno, y así. Entre recetas a las que les falta lo mismo, el orden SHALL ser
estable y predecible.

El orden de los borradores NO SHALL depender de la cobertura.

#### Scenario: Tres recetas

- **WHEN** a una receta le faltan 3 ingredientes, a otra ninguno y a otra uno
- **THEN** la lista las muestra en este orden: la que no le falta nada, la que le falta uno, la que le faltan tres

### Requirement: Filtrar por lo que se puede cocinar ya

La lista de recetas SHALL ofrecer ver solo las recetas terminadas a las que no
les falta ningún ingrediente necesario. El filtro SHALL poder quitarse para
volver a la lista entera.

Mientras el filtro esté puesto, SHALL notarse que lo está: lo que la persona ve
no es todo su recetario. Si ninguna receta cumple el filtro, SHALL decirse así
en vez de mostrar una lista vacía sin explicación.

El filtro SHALL funcionar sin JavaScript, y SHALL poder enlazarse y recargarse
sin perderse, porque la lista es de lectura y la aplicación exige que lo que se
lee no dependa de JavaScript (véase `app-shell`).

#### Scenario: Poner el filtro

- **WHEN** una persona con cinco recetas terminadas, dos de ellas sin ningún ingrediente que falte, pone el filtro
- **THEN** ve solo esas dos, y ve que el filtro está puesto

#### Scenario: Nada que cocinar

- **WHEN** una persona pone el filtro y a todas sus recetas terminadas les falta algo
- **THEN** ve un mensaje que dice que con lo que tiene en casa no llega a ninguna, y cómo volver a la lista entera

#### Scenario: Recargar con el filtro puesto

- **WHEN** una persona pone el filtro y recarga la página
- **THEN** el filtro sigue puesto

#### Scenario: Sin JavaScript

- **WHEN** una persona sin JavaScript pone el filtro
- **THEN** ve solo las recetas a las que no les falta nada

### Requirement: El detalle dice qué tienes y qué falta

En la pantalla de una receta terminada, cada línea de ingrediente SHALL mostrar
uno de cuatro estados, distinguibles sin depender solo del color:

- **lo tienes**: es necesario y está en la despensa;
- **falta**: es necesario y no está en la despensa;
- **se da por supuesto**: el ingrediente se da por supuesto, y no se ha
  comprobado si está en la despensa;
- **opcional**: la línea es opcional y no cuenta para la cobertura.

Si una línea es opcional y además su ingrediente se da por supuesto, SHALL
mostrarse como opcional.

El detalle SHALL mostrar la misma cobertura que la lista para la misma receta.

Un «Tienes todo» NO SHALL presentar como comprobado lo que solo se supone: lo que
se da por supuesto SHALL verse como supuesto, para que la persona pueda
descubrir que se le acabó el aceite antes de empezar a cocinar.

#### Scenario: Una receta con de todo

- **WHEN** una persona abre una receta con cebolla (en la despensa), huevo (no está), sal (se da por supuesta) y perejil (opcional)
- **THEN** la cebolla aparece como que la tiene, el huevo como que falta, la sal como supuesta y el perejil como opcional

#### Scenario: Lista y detalle coinciden

- **WHEN** la lista muestra «4/7» para una receta
- **THEN** al abrirla, el detalle también muestra «4/7», y los ingredientes marcados como que faltan son 3 distintos

#### Scenario: Leer sin color

- **WHEN** una persona que no distingue colores, o que usa un lector de pantalla, recorre los ingredientes de la receta
- **THEN** puede saber el estado de cada uno por su texto o su etiqueta

### Requirement: La cobertura es privada

La cobertura de una receta SHALL calcularse solo con la despensa y el catálogo
de la misma persona dueña de la receta. Nadie SHALL poder ver la cobertura de
recetas ajenas, ni deducir nada de la despensa de otra persona a través de ella.
Sin sesión NO SHALL poder consultarse nada.

#### Scenario: Dos cuentas

- **WHEN** dos personas tienen recetas y despensas distintas
- **THEN** cada una ve solo la cobertura de sus recetas, calculada con su despensa

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión intenta consultar la cobertura
- **THEN** se le niega, sin devolver ninguna fila
