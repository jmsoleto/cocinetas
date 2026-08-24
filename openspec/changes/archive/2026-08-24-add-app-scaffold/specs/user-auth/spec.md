## Purpose

Permite que una persona cree su cuenta en Cocinetas, entre y salga de ella, y que la aplicación sepa quién es en cada petición para poder mostrarle sus propios datos y negar el acceso a los de los demás.

## ADDED Requirements

### Requirement: Registro de una cuenta

Una persona SHALL poder crear una cuenta indicando su correo electrónico, una contraseña y el nombre por el que quiere que la aplicación se dirija a ella.

El sistema SHALL rechazar el registro cuando el correo ya tenga una cuenta, cuando el correo no tenga forma de dirección válida, cuando la contraseña no alcance la longitud mínima exigida, o cuando el nombre esté vacío. En todos esos casos SHALL explicar en español qué hay que corregir, y SHALL conservar los datos ya introducidos salvo la contraseña.

El sistema SHALL exigir la confirmación del correo electrónico antes de permitir el acceso.

#### Scenario: Registro correcto

- **WHEN** una persona envía un correo no registrado, una contraseña válida y un nombre
- **THEN** se crea la cuenta, se envía un correo de confirmación a esa dirección, y se informa a la persona de que debe confirmarlo

#### Scenario: Correo ya registrado

- **WHEN** una persona intenta registrarse con un correo que ya tiene cuenta
- **THEN** se le indica que no se puede completar el registro con ese correo, sin revelar si la cuenta existe o no

#### Scenario: Contraseña demasiado corta

- **WHEN** una persona envía una contraseña por debajo de la longitud mínima
- **THEN** se le indica la longitud mínima exigida y el correo y el nombre que había escrito siguen en el formulario

#### Scenario: Intento de acceso sin confirmar el correo

- **WHEN** una persona que se ha registrado pero no ha confirmado su correo intenta iniciar sesión
- **THEN** el acceso se deniega y se le recuerda que debe confirmar el correo

### Requirement: Inicio de sesión

Una persona con cuenta confirmada SHALL poder iniciar sesión con su correo y su contraseña.

Cuando las credenciales no sean correctas, el sistema SHALL mostrar un único mensaje de error que no distinga entre «ese correo no existe» y «la contraseña es incorrecta», para no revelar qué correos tienen cuenta.

#### Scenario: Credenciales correctas

- **WHEN** una persona envía el correo y la contraseña correctos de una cuenta confirmada
- **THEN** queda con la sesión iniciada y se le lleva a la pantalla principal de la aplicación

#### Scenario: Contraseña incorrecta

- **WHEN** una persona envía un correo existente con una contraseña equivocada
- **THEN** se muestra un error genérico de credenciales inválidas y no se inicia sesión

#### Scenario: Correo inexistente

- **WHEN** una persona envía un correo que no tiene cuenta
- **THEN** se muestra exactamente el mismo error genérico que ante una contraseña equivocada

### Requirement: Persistencia de la sesión

La sesión SHALL persistir entre recargas y entre cierres del navegador, y SHALL ser legible por el servidor en cada petición, de forma que el servidor pueda renderizar contenido personalizado sin esperar a que se ejecute JavaScript en el cliente.

Las credenciales de sesión SHALL almacenarse de modo que el JavaScript de la página no pueda leerlas, SHALL viajar únicamente por conexiones seguras en producción, y SHALL renovarse de forma transparente antes de caducar mientras la persona siga usando la aplicación.

#### Scenario: Recarga de la página

- **WHEN** una persona con sesión iniciada recarga la página
- **THEN** sigue con la sesión iniciada

#### Scenario: Cierre y reapertura del navegador

- **WHEN** una persona con sesión iniciada cierra el navegador y vuelve a abrir la aplicación al día siguiente
- **THEN** sigue con la sesión iniciada, sin tener que volver a introducir sus credenciales

#### Scenario: Sesión a punto de caducar

- **WHEN** una persona con sesión iniciada navega y sus credenciales de sesión están próximas a caducar
- **THEN** se renuevan sin que la persona perciba nada y sin que se le expulse

### Requirement: Cierre de sesión

Una persona con sesión iniciada SHALL poder cerrarla desde la interfaz. Tras cerrarla, las credenciales de sesión SHALL quedar invalidadas, de modo que volver atrás en el historial del navegador no devuelva el acceso.

#### Scenario: Cierre de sesión

- **WHEN** una persona con sesión iniciada cierra la sesión
- **THEN** se la lleva a la pantalla de inicio de sesión y deja de tener acceso al contenido protegido

#### Scenario: Volver atrás tras cerrar sesión

- **WHEN** una persona que acaba de cerrar sesión pulsa el botón de volver atrás del navegador hacia una página protegida
- **THEN** no se le muestra el contenido protegido y se la redirige al inicio de sesión

### Requirement: Protección de rutas

Las rutas que muestran datos de una persona SHALL requerir sesión iniciada. Una petición sin sesión a una de esas rutas SHALL redirigirse al inicio de sesión.

Una persona que ya tiene sesión iniciada y solicita el registro o el inicio de sesión SHALL ser redirigida a la pantalla principal en lugar de ver el formulario.

#### Scenario: Acceso sin sesión a una ruta protegida

- **WHEN** alguien sin sesión solicita una ruta protegida
- **THEN** se le redirige al inicio de sesión y en ningún momento se envía el contenido protegido

#### Scenario: Acceso al inicio de sesión con sesión ya iniciada

- **WHEN** una persona con sesión iniciada solicita la pantalla de inicio de sesión
- **THEN** se le redirige a la pantalla principal

### Requirement: Perfil de usuario

Cada cuenta SHALL tener un perfil asociado que guarde, como mínimo, el nombre por el que dirigirse a la persona. El perfil SHALL crearse en el mismo momento que la cuenta, sin requerir un paso adicional.

Una persona SHALL poder leer y modificar únicamente su propio perfil. El sistema SHALL impedir en la propia capa de datos que una persona lea o escriba el perfil de otra, con independencia de lo que solicite la aplicación.

#### Scenario: Perfil creado con la cuenta

- **WHEN** se completa el registro de una cuenta
- **THEN** existe ya un perfil asociado con el nombre indicado durante el registro

#### Scenario: Intento de leer el perfil ajeno

- **WHEN** una persona con sesión iniciada solicita el perfil de otra cuenta
- **THEN** la capa de datos no devuelve ese perfil

### Requirement: Saludo al usuario autenticado

La pantalla principal SHALL saludar a la persona por el nombre de su perfil. Es la única pantalla de contenido que este change entrega; sirve para demostrar de extremo a extremo que el servidor conoce la identidad de quien pide la página.

#### Scenario: Pantalla principal con sesión iniciada

- **WHEN** una persona con sesión iniciada abre la pantalla principal
- **THEN** ve un saludo que incluye el nombre que indicó al registrarse, y un control para cerrar sesión
