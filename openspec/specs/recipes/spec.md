## Purpose

Define qué es una receta en Cocinetas: cómo se escribe, qué la distingue de un
borrador a medias, qué hace falta para darla por terminada, y qué garantiza el
sistema sobre lo que la persona teclea. Es la pieza central del producto: sin
recetas no hay nada que cruzar con la despensa, nada que cocinar paso a paso y
nada que importar desde un vídeo.

## Requirements

### Requirement: Toda receta nace borrador

Una receta SHALL estar en uno de dos estados: borrador o terminada. Toda receta
SHALL nacer borrador, con independencia de cómo se haya creado. «Crear una
receta desde cero» SHALL producir un borrador vacío, no un formulario en blanco
sin respaldo.

Un borrador SHALL poder existir incompleto: sin título, sin ingredientes y sin
pasos. Es su razón de ser.

El estado de una receta y su procedencia SHALL ser cosas distintas. Terminar una
receta, o devolverla a borrador, NO SHALL alterar de dónde salió.

#### Scenario: Crear una receta

- **WHEN** una persona pide crear una receta nueva
- **THEN** la receta ya existe y es suya desde ese momento, vacía y en estado de borrador

#### Scenario: Un borrador sin nada dentro

- **WHEN** una persona crea una receta y la deja sin título, sin ingredientes y sin pasos
- **THEN** el borrador se conserva tal cual, sin errores ni avisos

### Requirement: Lo que se escribe queda guardado sin pedirlo

Mientras se edita un borrador, cada cambio —el título, el número de comensales,
una línea de ingrediente, el texto de un paso, el orden— SHALL quedar guardado
sin que la persona tenga que confirmarlo. NO SHALL existir un estado en el que
lo que se ve en pantalla y lo que hay guardado difieran sin que se diga.

Un cambio a medias SHALL guardarse igual: un paso escrito por la mitad es
contenido legítimo de un borrador.

Cuando un cambio no se pueda guardar, el sistema SHALL decirlo de forma que
siga siendo visible después —señalando **qué** parte concreta no se guardó— y
NO SHALL indicar que el trabajo está guardado mientras quede algo sin guardar.

#### Scenario: Escribir un paso y cerrar

- **WHEN** una persona escribe un paso y cierra la aplicación sin hacer nada más
- **THEN** al volver, el paso está donde lo dejó

#### Scenario: Un paso a medio escribir

- **WHEN** una persona escribe «Sofríe la ce» y pasa a otra cosa
- **THEN** el texto se conserva tal cual, sin considerarse un error

#### Scenario: Un cambio que no se puede guardar

- **WHEN** el guardado del paso 7 falla y la persona ya está escribiendo el paso 9
- **THEN** el aviso queda asociado al paso 7 y sigue a la vista, y en ningún momento se afirma que todo está guardado

### Requirement: Escribir una receta requiere JavaScript; leerla no

El editor de recetas SHALL requerir JavaScript para funcionar. Esta capacidad NO
SHALL prometer que crear o modificar una receta sea posible sin él.

Leer una receta SHALL seguir cumpliendo lo que exige `app-shell`: el contenido
llega renderizado desde el servidor y es legible sin que se ejecute JavaScript.

La razón es un reparto deliberado: escribir una receta ocurre con tiempo y con
buena conexión; seguirla ocurre en una cocina, con el teléfono a medio metro y
las manos ocupadas. El esfuerzo de funcionar en malas condiciones se reserva
para lo segundo.

#### Scenario: Leer una receta sin JavaScript

- **WHEN** una persona abre una receta terminada con JavaScript deshabilitado
- **THEN** el título, los ingredientes y los pasos se leen completos

#### Scenario: Editar sin JavaScript

- **WHEN** una persona abre el editor con JavaScript deshabilitado
- **THEN** el contenido del borrador es legible, aunque no se pueda modificar

### Requirement: Las líneas de ingrediente resuelven contra el catálogo

Cada ingrediente de una receta SHALL ser una línea que apunta a un ingrediente
del catálogo de esa persona, desde el momento en que se escribe y ya en
borrador. NO SHALL existir una línea que guarde solo texto sin resolver.

Escribir una línea SHALL usar la misma resolución que el resto del sistema
(véase `ingredients`): la palabra que no exista todavía entra en el catálogo sin
ningún paso adicional. Al teclear SHALL ofrecerse sugerencias del catálogo
propio.

Una línea SHALL poder llevar una cantidad y una nota, ambas opcionales y de
texto libre —«2 dientes», «un chorro», «para decorar»—. El sistema NO SHALL
exigir un número ni una unidad, ni interpretar su contenido.

Una receta SHALL poder tener varias líneas del mismo ingrediente, porque la
cantidad y la nota son de la línea y no del ingrediente.

#### Scenario: Ingrediente que ya está en el catálogo

- **WHEN** una persona añade una línea escribiendo «cebolla» y ya tiene ese ingrediente
- **THEN** la línea apunta al ingrediente que ya tenía, sin crear ninguno nuevo

#### Scenario: Ingrediente nuevo desde una receta

- **WHEN** una persona añade una línea escribiendo «pak choi», que no está en su catálogo
- **THEN** la línea queda creada y «pak choi» pasa a estar disponible en el catálogo y en las sugerencias

#### Scenario: El mismo ingrediente dos veces

- **WHEN** una persona añade «100 ml de aceite para el sofrito» y «50 ml de aceite para terminar»
- **THEN** la receta tiene dos líneas distintas, ambas del mismo ingrediente

#### Scenario: Cantidad que no es un número

- **WHEN** una persona escribe «al gusto» como cantidad
- **THEN** se guarda tal cual

### Requirement: Los pasos son texto ordenado

Una receta SHALL poder tener pasos, cada uno con su texto y su posición dentro
de la receta.

Un paso NO SHALL llevar duración ni marca de completado. Lo primero ya está
escrito dentro del texto cuando hace falta («sofríe 10 minutos»), y lo segundo
requeriría escribir mientras se cocina, cosa que esta capacidad no contempla.

#### Scenario: Añadir un paso

- **WHEN** una persona añade un paso a un borrador
- **THEN** el paso queda al final de los que ya hubiera

### Requirement: Cada paso declara qué líneas usa

Un paso SHALL poder declarar cuáles de las líneas de ingrediente de su receta
utiliza. El enlace SHALL ser a la línea y no al ingrediente, para que una receta
con dos líneas del mismo ingrediente pueda distinguir a cuál se refiere cada
paso.

El sistema SHALL impedir que un paso enlace con una línea de otra receta, con
independencia de que ambas recetas pertenezcan a la misma persona.

Un paso sin ninguna línea enlazada SHALL ser válido y normal: «precalienta el
horno» no usa ingredientes. Una línea que ningún paso usa NO SHALL impedir nada,
pero es el tipo de hueco que conviene poder detectar.

#### Scenario: Paso que usa dos ingredientes

- **WHEN** una persona marca que «Sofríe la cebolla en el aceite» usa las líneas de cebolla y de aceite
- **THEN** el paso queda enlazado a esas dos líneas y no a otras

#### Scenario: Paso sin ingredientes

- **WHEN** una persona añade «Precalienta el horno a 200°» y no marca ninguna línea
- **THEN** el paso es válido y la receta puede terminarse igualmente

#### Scenario: Enlace entre recetas distintas

- **WHEN** se intenta enlazar un paso de una receta con una línea de otra receta de la misma persona
- **THEN** la capa de datos lo rechaza

### Requirement: El orden de líneas y pasos lo decide la persona

Las líneas de ingrediente y los pasos SHALL mostrarse siempre en el orden que la
persona haya establecido, y ese orden SHALL ser estable entre visitas.

La persona SHALL poder reordenarlos. Una reordenación SHALL aplicarse entera o
no aplicarse: NO SHALL existir un resultado intermedio en el que dos elementos
compartan posición o alguno quede sin ella.

#### Scenario: Mover un paso

- **WHEN** una persona mueve el paso que estaba en novena posición al segundo lugar
- **THEN** los pasos quedan renumerados sin huecos ni repeticiones, y así se ven al volver

### Requirement: Borrar una línea en uso falla; borrar un paso se lleva sus enlaces

Borrar un paso SHALL retirar también los enlaces de ese paso con las líneas que
usaba. El paso es el dueño de esa anotación, y sin él no significa nada.

Borrar una línea de ingrediente que algún paso declare usar NO SHALL ocurrir en
silencio: el sistema SHALL negarse y SHALL indicar qué pasos la están usando,
para que la persona pueda decidir. Borrarla sin avisar perdería la única
constancia de que ese paso llevaba ese ingrediente.

#### Scenario: Borrar un paso anotado

- **WHEN** una persona borra un paso que declaraba usar dos líneas
- **THEN** el paso y sus enlaces desaparecen, y las dos líneas siguen en la receta

#### Scenario: Borrar una línea que un paso usa

- **WHEN** una persona intenta borrar la línea de cebolla y los pasos 3 y 7 declaran usarla
- **THEN** la línea no se borra y se le indica que la usan los pasos 3 y 7

#### Scenario: Borrar una línea que no usa nadie

- **WHEN** una persona borra una línea que ningún paso declara usar
- **THEN** la línea desaparece de la receta

### Requirement: Terminar una receta exige lo mínimo para que sirva

Una persona SHALL poder declarar terminada una receta. El sistema SHALL exigir
para ello un título no vacío, al menos una línea de ingrediente y al menos un
paso, y SHALL explicar en español qué falta cuando no se cumpla.

El número de comensales NO SHALL ser obligatorio.

Cada exigencia tiene su motivo: sin título la receta no se encuentra en la
lista, sin ingredientes aparecería siempre como cocinable, y sin pasos no es una
receta sino una lista de la compra.

La comprobación y el sellado SHALL ocurrir juntos, de modo que no exista un
instante en que una receta figure terminada sin cumplir las condiciones.

#### Scenario: Receta completa

- **WHEN** una persona termina un borrador con título, tres ingredientes y cinco pasos
- **THEN** la receta pasa a estar terminada

#### Scenario: Falta un paso

- **WHEN** una persona intenta terminar un borrador con título e ingredientes pero sin ningún paso
- **THEN** no se termina y se le explica que hace falta al menos un paso

#### Scenario: Sin comensales

- **WHEN** una persona termina una receta sin indicar para cuántos comensales es
- **THEN** la receta se termina igualmente

### Requirement: Una receta terminada no se edita

Una receta terminada SHALL ser inmutable. Para modificarla, la persona SHALL
devolverla explícitamente a borrador, y eso SHALL ser un gesto suyo y nunca
automático.

Esto existe para que las condiciones de una receta terminada sigan cumpliéndose
después de terminarla: como se guarda sin confirmar, no hay ningún momento
posterior en el que volver a comprobarlas.

Devolver una receta a borrador SHALL conservar todo su contenido y SHALL poder
deshacerse volviéndola a terminar. La fecha en que se terminó por primera vez NO
SHALL conservarse.

#### Scenario: Corregir una errata en una receta terminada

- **WHEN** una persona quiere corregir una palabra de una receta ya terminada
- **THEN** primero la devuelve a borrador, la corrige y la vuelve a terminar

#### Scenario: Abrir el editor de una receta terminada

- **WHEN** una persona llega al editor de una receta que está terminada
- **THEN** no se edita: se le lleva a la receta, desde donde puede devolverla a borrador

### Requirement: La lista separa los borradores de las recetas terminadas

La lista de recetas SHALL mostrar las recetas terminadas y los borradores en
secciones distintas, de modo que un borrador nunca se confunda con una receta
lista para cocinar.

Como crear una receta la hace existir de inmediato, el sistema SHALL poder
retirar sin preguntar los borradores que no contengan nada —sin título, sin
líneas y sin pasos—, y SHALL ofrecer descartar un borrador a mano.

Descartar un borrador que sí tiene contenido SHALL pedir confirmación aparte:
ahí no se está limpiando basura, se está borrando trabajo.

#### Scenario: Borrador abandonado nada más crearlo

- **WHEN** una persona crea una receta y sale sin escribir nada
- **THEN** ese borrador vacío puede retirarse sin preguntarle

#### Scenario: Descartar un borrador con contenido

- **WHEN** una persona descarta un borrador que tiene título, ingredientes y pasos
- **THEN** se le pide confirmación antes de borrarlo

### Requirement: Cada receta es privada, y sus piezas son suyas

Las recetas de una persona, sus líneas de ingrediente, sus pasos y los enlaces
entre ellos SHALL ser privados. Ninguna cuenta SHALL poder leer ni modificar
nada de otra.

El sistema SHALL impedirlo en la propia capa de datos, con independencia de lo
que solicite la aplicación.

Una línea de receta SHALL apuntar siempre a un ingrediente del catálogo de la
misma persona.

#### Scenario: Intento de leer una receta ajena

- **WHEN** una persona con sesión iniciada solicita una receta que pertenece a otra cuenta
- **THEN** la capa de datos no la devuelve

#### Scenario: Línea que apunta a un ingrediente ajeno

- **WHEN** se intenta crear una línea de receta que apunta a un ingrediente de otra cuenta
- **THEN** la capa de datos lo rechaza
