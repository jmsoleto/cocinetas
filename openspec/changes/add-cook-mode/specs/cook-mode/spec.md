## Purpose

Define cómo se cocina una receta terminada en Cocinetas: una pantalla para
reunir los ingredientes antes de empezar, y después un paso por pantalla con lo
que usa ese paso, pensado para un móvil en la encimera y las manos ocupadas.

## ADDED Requirements

### Requirement: Se cocina una receta terminada

El modo cocina SHALL estar disponible para las recetas terminadas, y se SHALL
llegar a él desde el detalle de la receta. Los borradores NO SHALL tener modo
cocina: un borrador puede tener pasos a medias o ninguno.

El modo cocina SHALL ofrecer en todo momento una salida al detalle de la
receta, sin tener que recorrer los pasos hacia atrás.

Si se intenta abrir el modo cocina de un borrador, SHALL llevarse a la persona
al editor de ese borrador. Si la receta no existe o es de otra persona, SHALL
responderse como a una receta que no existe, sin revelar nada de ella.

#### Scenario: Empezar a cocinar

- **WHEN** una persona abre el detalle de una receta terminada y pulsa «Cocinar»
- **THEN** entra en el modo cocina de esa receta, en la pantalla de antes de empezar

#### Scenario: Un borrador

- **WHEN** una persona intenta abrir el modo cocina de un borrador suyo
- **THEN** llega al editor de ese borrador, no a un modo cocina

#### Scenario: Una receta ajena

- **WHEN** una persona intenta abrir el modo cocina de una receta de otra cuenta
- **THEN** recibe la misma respuesta que para una receta que no existe

#### Scenario: Salir a mitad

- **WHEN** una persona está en el paso 4 de 7 y quiere dejarlo
- **THEN** puede volver al detalle de la receta con un solo gesto

### Requirement: Antes de empezar se ven todos los ingredientes

La primera pantalla del modo cocina SHALL mostrar todos los ingredientes de la
receta, en el orden de la receta, cada uno con su cantidad y su nota si las
tiene. Las líneas opcionales SHALL estar señaladas como opcionales con texto, no
solo con color.

Desde esta pantalla SHALL poder pasarse al primer paso.

#### Scenario: Reunir lo necesario

- **WHEN** una persona entra en el modo cocina de una receta con cinco líneas de ingrediente, una de ellas opcional
- **THEN** ve las cinco, con sus cantidades y notas, y la opcional dice que lo es

#### Scenario: Pasar al primer paso

- **WHEN** una persona está en la pantalla de antes de empezar y avanza
- **THEN** ve el primer paso de la receta

### Requirement: Un paso por pantalla, con sus ingredientes

Cada paso SHALL ocupar su propia pantalla, con:

- su posición en la receta, en la forma «Paso 3 de 7»;
- su texto completo, respetando los saltos de línea con que se escribió, en un
  tamaño legible a distancia de brazo;
- los ingredientes que ese paso usa, cada uno con la cantidad y la nota de su
  línea.

Los ingredientes de un paso SHALL ser exactamente las líneas que el paso
declara usar (véase `recipes`). Si un paso usa dos líneas del mismo ingrediente,
SHALL mostrar las dos, cada una con su cantidad. Si un paso no usa ninguna línea,
NO SHALL mostrarse una lista vacía ni un aviso: un paso sin ingredientes es
normal («precalienta el horno»).

#### Scenario: Un paso con ingredientes

- **WHEN** el paso 2 de una receta usa «1 cebolla, picada» y «2 dientes de ajo»
- **THEN** la pantalla del paso 2 muestra «Paso 2 de N», su texto, y esas dos líneas con su cantidad y su nota

#### Scenario: Un paso sin ingredientes

- **WHEN** un paso no usa ninguna línea de ingrediente
- **THEN** su pantalla muestra solo la posición y el texto, sin lista ni aviso

#### Scenario: Dos líneas del mismo ingrediente

- **WHEN** un paso usa «100 ml de aceite para el sofrito» y otro usa «50 ml de aceite para terminar»
- **THEN** cada paso muestra su propia línea de aceite con su cantidad, no la otra

#### Scenario: Un paso largo

- **WHEN** el texto de un paso no cabe en la pantalla
- **THEN** se puede desplazar para leerlo entero sin que eso cambie de paso

### Requirement: Adelante y atrás

Cada pantalla del modo cocina SHALL tener un control para ir a la siguiente y
otro para volver a la anterior, grandes y fáciles de pulsar con un dedo. El
orden SHALL ser: antes de empezar, paso 1, paso 2, …, último paso.

- Desde el primer paso, volver SHALL llevar a la pantalla de antes de empezar.
- Desde el último paso, avanzar SHALL terminar y devolver al detalle de la
  receta. El control SHALL decir que termina, no que avanza.
- Desde antes de empezar NO SHALL haber control para volver dentro del modo
  cocina. La salida al detalle sigue disponible.

Cambiar de paso NO SHALL perder ni alterar nada, porque el modo cocina no
escribe nada.

#### Scenario: Avanzar

- **WHEN** una persona está en el paso 3 de 7 y avanza
- **THEN** ve el paso 4 de 7

#### Scenario: Volver desde el primer paso

- **WHEN** una persona está en el paso 1 y vuelve
- **THEN** ve la pantalla de antes de empezar

#### Scenario: Terminar

- **WHEN** una persona está en el último paso
- **THEN** el control de avanzar dice que termina, y al pulsarlo vuelve al detalle de la receta

### Requirement: Deslizar entre pasos

Además de los controles, SHALL poder pasarse a la pantalla siguiente deslizando
el dedo hacia la izquierda, y a la anterior deslizándolo hacia la derecha. Con
los mismos límites que los controles: hacia atrás desde antes de empezar no hace
nada, y hacia delante desde el último paso no termina. Terminar SHALL requerir el
control explícito, para que un roce no saque a nadie de la receta.

Un gesto mayormente vertical NO SHALL cambiar de pantalla: desplazarse por un
paso largo y deslizar son gestos distintos para el dedo, y confundirlos haría
saltar de paso a quien solo quería leer.

Deslizar SHALL necesitar JavaScript. Sin él, los controles bastan.

#### Scenario: Deslizar hacia la izquierda

- **WHEN** una persona en el paso 2 desliza el dedo de derecha a izquierda
- **THEN** ve el paso 3

#### Scenario: Desplazarse por un paso largo

- **WHEN** una persona desliza el dedo hacia arriba para leer el final de un paso largo
- **THEN** el texto se desplaza y el paso no cambia

#### Scenario: Deslizar en el último paso

- **WHEN** una persona en el último paso desliza hacia la izquierda
- **THEN** sigue en el último paso; para terminar tiene que usar el control

### Requirement: La posición sobrevive a una recarga y al botón atrás

La pantalla en la que está la persona SHALL formar parte de la dirección de la
página. Recargar SHALL dejarla en la misma pantalla, y el botón «atrás» del
navegador SHALL deshacer el último cambio de pantalla.

Una dirección con un paso que la receta no tiene SHALL llevar a la pantalla de
antes de empezar, no a un error.

Los controles de adelante y atrás SHALL funcionar sin JavaScript, porque son de
lectura y la aplicación exige que lo que se lee no dependa de JavaScript
(véase `app-shell`).

#### Scenario: Recargar en mitad de la receta

- **WHEN** una persona está en el paso 5 y recarga la página
- **THEN** sigue en el paso 5

#### Scenario: El botón atrás del navegador

- **WHEN** una persona pasa del paso 2 al 3 y pulsa «atrás» en el navegador
- **THEN** vuelve al paso 2

#### Scenario: Un paso que no existe

- **WHEN** alguien abre el modo cocina de una receta de 4 pasos con la dirección del paso 9
- **THEN** ve la pantalla de antes de empezar

#### Scenario: Sin JavaScript

- **WHEN** una persona con JavaScript deshabilitado entra en el modo cocina y avanza
- **THEN** ve cada paso con sus ingredientes, y puede avanzar y volver con los controles

### Requirement: La pantalla no se apaga mientras se cocina

Mientras el modo cocina esté a la vista, el sistema SHALL pedir al dispositivo
que no apague ni bloquee la pantalla. Al salir del modo cocina SHALL dejar de
pedirlo, para que el resto de la aplicación no gaste batería de más.

Si la persona cambia de aplicación y vuelve, SHALL volver a pedirlo: el
dispositivo retira la petición al ocultarse la página.

Si el dispositivo no lo permite, o lo niega, el modo cocina SHALL funcionar
igual, sin errores ni avisos que estorben. La persona SHALL poder saber si la
pantalla se va a mantener encendida o no.

#### Scenario: Cocinar sin tocar el móvil

- **WHEN** una persona deja el móvil quieto en el paso 3 más tiempo del que tarda en bloquearse normalmente
- **THEN** la pantalla sigue encendida y en el paso 3, en un dispositivo que lo permite

#### Scenario: Volver de otra aplicación

- **WHEN** una persona sale a otra aplicación a mitad de la receta y vuelve
- **THEN** la pantalla vuelve a mantenerse encendida

#### Scenario: Salir del modo cocina

- **WHEN** una persona sale del modo cocina al detalle de la receta
- **THEN** la pantalla vuelve a apagarse con normalidad

#### Scenario: Un dispositivo que no lo permite

- **WHEN** una persona cocina en un navegador sin esa capacidad
- **THEN** el modo cocina funciona igual, y no se le dice que la pantalla se mantendrá encendida

### Requirement: El cambio de pantalla se anuncia

Al cambiar de pantalla dentro del modo cocina, el foco SHALL llevarse al
principio de la pantalla nueva, de modo que un lector de pantalla anuncie en qué
paso se está y empiece a leer desde ahí, y no desde donde estaba el control
pulsado.

#### Scenario: Avanzar con un lector de pantalla

- **WHEN** una persona con lector de pantalla pulsa «Siguiente» en el paso 2
- **THEN** el lector anuncia «Paso 3 de N» y lee después el texto del paso
