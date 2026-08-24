## Purpose

Define cómo se sirve y se presenta Cocinetas: una aplicación web renderizada en el servidor, pensada exclusivamente para móvil, con una única paleta visual, y que el usuario puede añadir a la pantalla de inicio de su teléfono como si fuera una aplicación nativa.

## Requirements

### Requirement: Renderizado en servidor

Toda navegación SHALL devolver HTML completo y ya renderizado en la primera respuesta, incluyendo el contenido que depende de la sesión del usuario. El cliente hidrata ese HTML; no SHALL existir un estado intermedio en el que la página quede en blanco o muestre un esqueleto mientras se resuelve la sesión.

#### Scenario: Primera carga de una página con sesión iniciada

- **WHEN** un usuario con sesión activa solicita una ruta protegida y el JavaScript de la página aún no se ha ejecutado
- **THEN** el HTML recibido ya contiene el contenido personalizado del usuario

#### Scenario: Primera carga sin JavaScript disponible

- **WHEN** un usuario solicita cualquier ruta con JavaScript deshabilitado
- **THEN** el contenido de la página es legible y los formularios de autenticación siguen siendo enviables

### Requirement: Paleta visual única

La aplicación SHALL presentarse siempre con la paleta cálida clara `miga` (fondo `#f7f1e8`, superficie `#fffbf4`, texto `#2c2521`, acento `#b25c3c`). No SHALL ofrecerse ningún mecanismo de cambio de tema, ni SHALL adaptarse automáticamente a la preferencia de esquema de color del sistema operativo.

Todos los valores de color, espaciado, radio, sombra y tipografía SHALL provenir de las variables CSS del design system. Ningún componente SHALL declarar un color, un tamaño de fuente base o una distancia con un valor literal que las variables ya cubran.

#### Scenario: Usuario con el sistema en modo oscuro

- **WHEN** un usuario cuyo sistema operativo está en modo oscuro abre la aplicación
- **THEN** la aplicación se muestra con la paleta clara `miga`, sin invertir colores

#### Scenario: Superficie elevada sobre fondo claro

- **WHEN** se muestra un elemento que oscurece el contenido de detrás, como el fondo de un diálogo modal
- **THEN** ese fondo oscurece de forma perceptible el contenido, en lugar de aclararlo

### Requirement: Presentación en pantalla de móvil

La interfaz SHALL estar dimensionada para pantallas de teléfono en orientación vertical. El contenido interactivo SHALL respetar las áreas seguras del dispositivo, de modo que ningún control quede tapado por la muesca superior ni por el indicador de gestos inferior.

La altura de las pantallas a página completa SHALL medirse contra el área visible real del navegador, de manera que la aparición o desaparición de la barra de direcciones no recorte contenido ni genere desplazamiento espurio.

En ventanas más anchas que un teléfono la aplicación SHALL seguir siendo legible y usable, aunque el escritorio no es un objetivo soportado.

#### Scenario: Teléfono con muesca e indicador de gestos

- **WHEN** la aplicación se muestra en un dispositivo con muesca superior e indicador de gestos inferior
- **THEN** ningún elemento interactivo queda solapado por ninguno de los dos

#### Scenario: Barra de direcciones que aparece al desplazarse

- **WHEN** el usuario se desplaza en una pantalla a página completa y el navegador muestra u oculta su barra de direcciones
- **THEN** el contenido no se recorta ni aparece un desplazamiento vertical que no existía

#### Scenario: Apertura en un navegador de escritorio

- **WHEN** alguien abre la aplicación en una ventana de escritorio ancha
- **THEN** el contenido se mantiene en una columna de ancho legible en lugar de estirarse a todo el ancho de la ventana

### Requirement: Instalación en la pantalla de inicio

La aplicación SHALL poder añadirse a la pantalla de inicio de un teléfono y, una vez añadida, SHALL abrirse en su propia ventana sin la interfaz del navegador.

La aplicación instalada SHALL identificarse con el nombre «Cocinetas» y con un icono propio, y ese icono SHALL seguir siendo reconocible cuando el sistema operativo lo recorte a la forma que use (círculo, cuadrado redondeado u otra).

#### Scenario: Instalación en Android

- **WHEN** un usuario visita la aplicación en un navegador Android compatible
- **THEN** el navegador ofrece instalarla, y al abrirla desde la pantalla de inicio se muestra sin barra de direcciones ni pestañas

#### Scenario: Instalación en iOS

- **WHEN** un usuario añade la aplicación a la pantalla de inicio desde Safari en iOS
- **THEN** el icono mostrado es el icono propio de Cocinetas, y la aplicación se abre en su propia ventana

#### Scenario: Recorte del icono por el sistema

- **WHEN** el sistema operativo recorta el icono a una máscara circular
- **THEN** ningún elemento significativo del icono queda cortado

### Requirement: Idioma de la interfaz

La interfaz SHALL estar íntegramente en español, y el documento SHALL declarar el español como idioma para que los agentes de usuario apliquen la separación silábica, la corrección ortográfica y la lectura asistida correctas.

#### Scenario: Lector de pantalla

- **WHEN** un lector de pantalla lee cualquier página de la aplicación
- **THEN** la pronuncia en español
