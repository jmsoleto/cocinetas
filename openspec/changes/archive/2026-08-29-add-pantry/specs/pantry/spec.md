## Purpose

Define qué tiene una persona en casa: la lista de ingredientes disponibles con
la que la aplicación podrá decidir, más adelante, qué recetas se pueden cocinar
ahora mismo. Es la primera pantalla de contenido real de Cocinetas.

## ADDED Requirements

### Requirement: La despensa es una marca, no un inventario

La despensa SHALL registrar únicamente si una persona tiene o no tiene un
ingrediente. NO SHALL guardar cantidades, unidades ni fechas de caducidad.

La razón es que la promesa del producto —«¿qué puedo cocinar ahora?»— solo
necesita presencia, mientras que un inventario obligaría a descontar cantidades
al cocinar. Nadie lo hace, y una despensa que se desactualiza sin avisar produce
respuestas peores que una que solo dice sí o no.

#### Scenario: Marcar que se tiene un ingrediente

- **WHEN** una persona indica que tiene tomates
- **THEN** queda registrado que los tiene, sin preguntarle cuántos

#### Scenario: Marcar dos veces el mismo ingrediente

- **WHEN** una persona indica que tiene un ingrediente que ya estaba en su despensa
- **THEN** su despensa no cambia y no aparece la entrada duplicada

### Requirement: Despensa propia de cada persona

Cada cuenta SHALL tener su propia despensa. El sistema SHALL impedir en la
propia capa de datos que una persona lea o modifique la despensa de otra, con
independencia de lo que solicite la aplicación.

#### Scenario: Intento de leer la despensa ajena

- **WHEN** una persona con sesión iniciada solicita la despensa de otra cuenta
- **THEN** la capa de datos no la devuelve

#### Scenario: Acceso sin sesión

- **WHEN** alguien sin sesión iniciada solicita la pantalla de la despensa
- **THEN** se le redirige al inicio de sesión y en ningún momento se envía contenido de ninguna despensa

### Requirement: Añadir a la despensa escribiendo

Una persona SHALL poder añadir un ingrediente a su despensa escribiéndolo,
tanto si ya está en su catálogo como si no. Cuando no lo esté, SHALL crearse en
ese momento y quedar añadido, en un solo gesto y sin un paso previo de «crear el
ingrediente».

Mientras escribe, SHALL ver sugerencias de su propio catálogo, de forma que
elegir uno que ya tiene sea más fácil que crear uno nuevo parecido.

#### Scenario: Ingrediente que ya está en el catálogo

- **WHEN** una persona teclea «ceb», elige «cebolla» de las sugerencias y confirma
- **THEN** «cebolla» queda en su despensa, y su catálogo no gana ningún ingrediente

#### Scenario: Ingrediente nuevo

- **WHEN** una persona escribe «pak choi», que no tenía, y confirma
- **THEN** «pak choi» queda creado en su catálogo y añadido a su despensa a la vez

### Requirement: Quitar de la despensa

Una persona SHALL poder indicar que ya no tiene un ingrediente. Al hacerlo, el
ingrediente SHALL salir de la despensa pero SHALL permanecer en su catálogo,
disponible para volver a añadirlo o para usarlo en una receta.

#### Scenario: Se acaba un ingrediente

- **WHEN** una persona quita «tomates» de su despensa
- **THEN** deja de constar que los tiene, y «tomates» sigue existiendo en su catálogo

#### Scenario: Volver a comprarlo

- **WHEN** esa misma persona vuelve a añadir «tomates» más tarde
- **THEN** se reutiliza el ingrediente que ya tenía, sin crear uno nuevo

### Requirement: Los ingredientes que se dan por supuestos no aparecen

Los ingredientes marcados como que se dan por supuestos NO SHALL mostrarse en la
despensa, ni SHALL ofrecerse entre las sugerencias al añadir. Nadie debería tener
que declarar que tiene sal.

Si una persona le quita esa marca a un ingrediente, SHALL pasar a comportarse
como cualquier otro y poder añadirse a la despensa.

#### Scenario: Intentar añadir sal

- **WHEN** una persona teclea «sal» en su despensa
- **THEN** no se le ofrece como sugerencia y se le explica que la sal ya se da por supuesta

#### Scenario: Ingrediente al que se le ha quitado la marca

- **WHEN** una persona quita la marca a «aceite» y luego lo busca en su despensa
- **THEN** puede añadirlo como cualquier otro ingrediente

### Requirement: Pantalla de la despensa

La aplicación SHALL ofrecer una pantalla que muestre todo lo que la persona tiene
en casa, en un orden estable y predecible, desde la que se pueda añadir y quitar
sin cambiar de pantalla.

Cuando la despensa esté vacía, SHALL explicar para qué sirve y cómo empezar, en
lugar de mostrar una lista en blanco.

#### Scenario: Despensa con contenido

- **WHEN** una persona con ingredientes en su despensa abre la pantalla
- **THEN** los ve todos, en un orden que no cambia entre una visita y la siguiente

#### Scenario: Primera visita

- **WHEN** una persona que acaba de registrarse abre la pantalla de la despensa
- **THEN** ve una explicación de para qué sirve y una forma clara de añadir el primer ingrediente
