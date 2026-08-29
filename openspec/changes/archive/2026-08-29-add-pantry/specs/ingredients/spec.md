## Purpose

Define el vocabulario de ingredientes de cada persona: cómo una palabra escrita
se convierte en un ingrediente, cuándo dos palabras son el mismo ingrediente, y
qué se puede hacer para arreglar el vocabulario cuando se ensucia. Es la pieza
de la que depende que *cebolla* en una receta y *cebolla* en la despensa sean la
misma cosa.

## ADDED Requirements

### Requirement: Vocabulario propio de cada persona

Cada cuenta SHALL tener su propio catálogo de ingredientes, independiente del de
las demás. Lo que una persona escriba no SHALL aparecer nunca en el catálogo, en
las sugerencias ni en los resultados de otra.

El sistema SHALL impedir en la propia capa de datos que una persona lea o
escriba un ingrediente de otra, con independencia de lo que solicite la
aplicación.

#### Scenario: Dos personas escriben la misma palabra

- **WHEN** dos personas distintas añaden cada una un ingrediente llamado «cebolla»
- **THEN** cada una tiene el suyo, y ninguna ve ni puede modificar el de la otra

#### Scenario: Intento de leer el catálogo ajeno

- **WHEN** una persona con sesión iniciada solicita un ingrediente que pertenece a otra cuenta
- **THEN** la capa de datos no lo devuelve

### Requirement: Escribir un ingrediente es añadirlo al catálogo

Cuando una persona escriba un texto donde se espera un ingrediente, el sistema
SHALL resolverlo siempre a un ingrediente de su catálogo: el que ya coincida, o
uno nuevo creado en ese momento. La operación no SHALL fallar por que el texto no
esté todavía en el catálogo.

El sistema SHALL rechazar únicamente el texto vacío o compuesto solo de espacios.

#### Scenario: Palabra que ya está en el catálogo

- **WHEN** una persona escribe «cebolla» y ya tiene un ingrediente «cebolla»
- **THEN** se usa el que ya existía y no se crea ninguno nuevo

#### Scenario: Palabra que no está en el catálogo

- **WHEN** una persona escribe «pak choi» por primera vez
- **THEN** el ingrediente queda creado y disponible para las siguientes veces, sin ningún paso adicional

#### Scenario: Texto vacío

- **WHEN** una persona intenta añadir un ingrediente sin escribir nada
- **THEN** se le indica en español que hace falta un nombre y no se crea nada

### Requirement: Cuándo dos textos son el mismo ingrediente

El sistema SHALL considerar el mismo ingrediente dos textos que solo difieran en
mayúsculas y minúsculas, en tildes, o en espacios sobrantes al principio, al
final o repetidos en medio.

El sistema NO SHALL intentar deducir equivalencias más allá de eso. En
particular, no SHALL tratar el singular y el plural como el mismo ingrediente:
no existe una forma segura de hacerlo en español —«arroz», «anís» y «cuscús» se
romperían—, y un falso positivo une dos ingredientes que no lo eran, que es peor
que dejar dos entradas separadas. Los casos que se escapen se arreglan
fusionando.

#### Scenario: Diferencia de mayúsculas y tildes

- **WHEN** una persona con un ingrediente «plátano» escribe «Platano»
- **THEN** se usa el ingrediente que ya tenía y no se crea uno nuevo

#### Scenario: Espacios sobrantes

- **WHEN** una persona escribe «  cebolla  »
- **THEN** se usa su ingrediente «cebolla»

#### Scenario: Singular y plural

- **WHEN** una persona con un ingrediente «cebolla» escribe «cebollas»
- **THEN** se crea un ingrediente distinto, que la persona puede fusionar con el anterior si quiere

### Requirement: Sugerencias al escribir

Al escribir un ingrediente, el sistema SHALL sugerir ingredientes del catálogo
de esa misma persona que casen con lo tecleado, de forma que elegir uno existente
sea más fácil que teclear uno nuevo.

Las sugerencias SHALL ignorar mayúsculas y tildes al comparar, igual que la
resolución.

#### Scenario: Sugerencia sobre lo ya escrito

- **WHEN** una persona que tiene «cebolla» y «cebolleta» teclea «ceb»
- **THEN** se le ofrecen ambos para elegir antes de crear uno nuevo

#### Scenario: Catálogo vacío

- **WHEN** una persona sin ningún ingrediente teclea cualquier cosa
- **THEN** no se ofrece ninguna sugerencia y puede crear el ingrediente igualmente

### Requirement: Ingredientes que se dan por supuestos

Un ingrediente SHALL poder estar marcado como «se da por supuesto»: algo que se
asume que hay siempre en la cocina y que por tanto no hace falta declarar ni
tener en cuenta al decidir si una receta se puede cocinar.

Cuando se cree un ingrediente cuyo nombre coincida con uno de un conjunto
reducido y fijo que la aplicación conoce —al menos sal, aceite, pimienta y
agua—, SHALL nacer ya marcado. Esto no SHALL crear ninguna fila por adelantado:
solo cambia el valor inicial de las que la persona cree.

La persona SHALL poder quitar y poner esa marca en cualquiera de sus
ingredientes.

#### Scenario: Añadir sal por primera vez

- **WHEN** una persona escribe «sal» y no tenía ese ingrediente
- **THEN** el ingrediente queda creado y ya marcado como que se da por supuesto

#### Scenario: Catálogo recién creado

- **WHEN** una persona acaba de registrarse y no ha escrito ningún ingrediente
- **THEN** su catálogo está completamente vacío

#### Scenario: Cambiar de opinión

- **WHEN** una persona quita la marca a «aceite» porque quiere controlarlo
- **THEN** «aceite» pasa a comportarse como cualquier otro ingrediente

### Requirement: Renombrar un ingrediente

Una persona SHALL poder cambiar el nombre de cualquiera de sus ingredientes. El
cambio SHALL reflejarse en todos los sitios donde ese ingrediente aparezca, sin
crear uno nuevo ni dejar el anterior detrás.

Si el nombre nuevo coincide —según la equivalencia de textos definida arriba—
con otro ingrediente que la persona ya tiene, el sistema SHALL avisar de que ya
existe y ofrecer fusionarlos, en lugar de crear un duplicado o fallar sin
explicación.

#### Scenario: Corregir una errata

- **WHEN** una persona renombra «cebolal» a «cebolla» y no tenía ninguna «cebolla»
- **THEN** el ingrediente pasa a llamarse «cebolla» en todas partes

#### Scenario: El nombre nuevo ya existe

- **WHEN** una persona renombra «cebollas» a «cebolla» y ya tiene una «cebolla»
- **THEN** se le explica que ya existe y se le ofrece fusionar los dos

### Requirement: Fusionar dos ingredientes

Una persona SHALL poder declarar que dos de sus ingredientes son en realidad el
mismo. Tras la fusión SHALL quedar uno solo, y todo lo que apuntaba al
descartado SHALL apuntar al que queda.

La fusión SHALL ser completa: no SHALL quedar rastro del ingrediente descartado
en el catálogo ni en las sugerencias.

#### Scenario: Fusión de dos entradas equivalentes

- **WHEN** una persona fusiona «cebolleta» dentro de «cebolla»
- **THEN** «cebolleta» desaparece de su catálogo y todo lo que la usaba pasa a usar «cebolla»

#### Scenario: Los dos estaban en uso

- **WHEN** una persona fusiona dos ingredientes y ambos aparecían en su despensa
- **THEN** queda una sola entrada en la despensa, la del ingrediente que sobrevive

### Requirement: Retirar ingredientes sin uso

Una persona SHALL poder eliminar de su catálogo los ingredientes que no esté
usando en ninguna parte. El sistema SHALL negarse a eliminar un ingrediente que
siga en uso, y SHALL decir por qué.

Esto existe porque escribir una palabra la mete en el catálogo, así que las
erratas se quedan dentro y vuelven a aparecer en las sugerencias, invitando a
elegirlas otra vez.

#### Scenario: Errata que no usa nadie

- **WHEN** una persona elimina «cebolal», que no está en su despensa ni en ninguna receta
- **THEN** desaparece de su catálogo y deja de sugerirse

#### Scenario: Ingrediente todavía en uso

- **WHEN** una persona intenta eliminar un ingrediente que sigue en su despensa
- **THEN** no se elimina y se le explica que está en uso
