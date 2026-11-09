## MODIFIED Requirements

### Requirement: Fusionar dos ingredientes

Una persona SHALL poder declarar que dos de sus ingredientes son en realidad el
mismo. Tras la fusión SHALL quedar uno solo, y todo lo que apuntaba al
descartado SHALL apuntar al que queda: tanto su entrada en la despensa como
cualquier línea de receta que lo usara.

La fusión SHALL ser completa: no SHALL quedar rastro del ingrediente descartado
en el catálogo ni en las sugerencias.

La fusión NO SHALL unir líneas de receta entre sí. Dos líneas de la misma receta
que tras la fusión apunten al mismo ingrediente SHALL seguir siendo dos líneas,
porque la cantidad y la nota son de la línea y no del ingrediente.

#### Scenario: Fusión de dos entradas equivalentes

- **WHEN** una persona fusiona «cebolleta» dentro de «cebolla»
- **THEN** «cebolleta» desaparece de su catálogo y todo lo que la usaba pasa a usar «cebolla»

#### Scenario: Los dos estaban en uso

- **WHEN** una persona fusiona dos ingredientes y ambos aparecían en su despensa
- **THEN** queda una sola entrada en la despensa, la del ingrediente que sobrevive

#### Scenario: Los dos aparecían en la misma receta

- **WHEN** una persona fusiona «aceite de oliva» dentro de «aceite», y una receta suya tiene una línea de cada uno con cantidades distintas
- **THEN** la receta conserva sus dos líneas, ambas apuntando ya a «aceite», y cada una con su cantidad

### Requirement: Retirar ingredientes sin uso

Una persona SHALL poder eliminar de su catálogo los ingredientes que no esté
usando en ninguna parte. Un ingrediente SHALL considerarse en uso si está en la
despensa o si alguna receta —terminada o borrador— tiene una línea que apunte a
él. El sistema SHALL negarse a eliminar un ingrediente en uso, y SHALL decir
cuál de los dos motivos lo impide, no solo que está en uso.

Esto existe porque escribir una palabra la mete en el catálogo, así que las
erratas se quedan dentro y vuelven a aparecer en las sugerencias, invitando a
elegirlas otra vez.

#### Scenario: Errata que no usa nadie

- **WHEN** una persona elimina «cebolal», que no está en su despensa ni en ninguna receta
- **THEN** desaparece de su catálogo y deja de sugerirse

#### Scenario: Ingrediente todavía en uso

- **WHEN** una persona intenta eliminar un ingrediente que sigue en su despensa
- **THEN** no se elimina y se le explica que está en su despensa

#### Scenario: Ingrediente usado por una receta

- **WHEN** una persona intenta eliminar un ingrediente que no está en su despensa pero que usa una de sus recetas
- **THEN** no se elimina y se le explica que lo usa una receta
