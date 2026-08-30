## Context

Ver `proposal.md` para la motivación. Lo que hace falta saber aquí es el estado
del que se parte y las dos restricciones que lo condicionan todo.

El repositorio tiene el esqueleto terminado: React Router sobre Cloudflare
Workers, sesión en cookies legible desde el servidor, y una sola tabla
—`profiles`— cuya clave primaria es directamente el id del usuario, con RLS y
con un trigger que la rellena al registrarse. La segunda migración de esa tabla
dejó escrita una lección que se aplica aquí sin cambios: Supabase trae en el
esquema `public` un `alter default privileges` que **concede todo sobre cualquier
tabla nueva** a `anon`, `authenticated` y `service_role`, así que una tabla que
solo declare RLS nace con privilegios que nadie pidió.

La segunda restricción es de producto y está decidida: **el catálogo de
ingredientes empieza vacío**. No hay semilla curada. Todo el vocabulario sale de
lo que las personas escriban.

Este documento describe el modelo de datos **completo** de Cocinetas, no solo el
trozo que esta fase construye. El reparto en fases está en
`openspec/ROADMAP.md`, y la regla que lo gobierna es que el modelo se decidió
entero de una vez: las fases siguientes lo construyen, no lo renegocian.

## Goals / Non-Goals

**Goals:**

- Que *cebolla* en una receta y *cebolla* en la despensa sean la misma fila, y
  que lo sigan siendo dentro de dos años y trescientas recetas.
- Que escribir un ingrediente nunca falle ni bloquee, aunque el catálogo esté
  vacío y aunque la palabra no exista todavía.
- Que el vocabulario se pueda **reparar** —renombrar, fusionar, limpiar— en vez
  de tener que acertar a la primera.
- Dejar decidido y escrito el modelo de las fases 2 a 6, para que ninguna de
  ellas tenga que volver sobre esto.
- Que los privilegios concedidos y los pretendidos coincidan desde la primera
  migración, sin necesitar una segunda que los corrija.

**Non-Goals:**

- Cantidades, unidades o caducidades en la despensa.
- Jerarquía de ingredientes («cebolla morada» *es un* «cebolla»).
- Cualquier dato colgado del ingrediente: nutrición, temporada, pasillo del
  supermercado.
- Deshacer una fusión.
- Compartir nada entre cuentas.

## Decisions

### D1 — Catálogo canónico, no texto libre

Cada ingrediente es una fila con identidad. Una línea de receta y una entrada de
despensa apuntan a esa fila, no repiten su nombre.

**Alternativa descartada:** guardar el texto en cada sitio y comparar cadenas al
cruzarlas. Es lo que parece más barato hoy y es exactamente lo que hace
imposible el producto: el «4/7 ingredientes» se degrada en cuanto alguien
escriba «Cebolla» con mayúscula, y arreglarlo después significa migrar datos que
ya existen. El coste de la tabla canónica se paga una vez, al principio; el coste
del texto libre se paga cada vez que se toca el tema.

### D2 — El catálogo es privado, no compartido

`ingredients` lleva `perfil_id` y se aísla con la misma frase que el resto:
`perfil_id = auth.uid()`. Ninguna tabla del sistema es compartida.

**Alternativa considerada en serio: un catálogo global.** Tenía dos argumentos de
peso. Deduplica entre personas —lo que alimenta el autocompletado de quien
acaba de llegar— y permite colgar del ingrediente datos caros de producir
(nutrición, temporada) una sola vez en lugar de una por cuenta.

Se descarta por coherencia y por lo que arrastra. Una tabla compartida y
escribible obliga a: prohibir `update` y `delete` a las personas —porque
renombrar una fila común cambia la palabra en las recetas de todo el mundo—,
canalizar los `insert` por una función elevada, conceder `select` por columnas
para no filtrar quién metió qué en una aplicación donde todo lo demás es
estrictamente privado, y arbitrar antes o después qué nombre es el bueno. Nada
de eso existe si el catálogo es tuyo.

Y hay una compensación que no vi al principio: **lo privado devuelve renombrar y
fusionar**, que es justo lo que lo global tenía que prohibir. El vocabulario
propio se puede arreglar; el compartido solo se puede vigilar.

**Coste asumido, explícito:** cada persona nueva empieza con la caja vacía, no
solo la primera. Y el día que haya datos por ingrediente habrá que producirlos N
veces.

**Salida, si alguna vez hace falta:** una columna `canonico_id` nullable en la
fila privada apuntando a un catálogo global futuro. La fila sigue siendo tuya y
el enlace es una anotación encima. Es la misma forma que resuelve ya otros dos
problemas en este documento, y no exige migrar nada de lo que se construya ahora.

### D3 — Sin tabla de alias

`openspec/PENDIENTE.md` cerraba con «merece una tabla `ingredients` canónica con
alias desde el primer día». La tabla canónica sí; **los alias no**, y conviene
dejar escrito por qué se descarta algo que ya estaba anotado.

Un alias existe para que dos textos apunten al mismo ingrediente sin poder tocar
las filas. Esa impotencia era una consecuencia de D2 en su versión global. Con el
catálogo privado, la equivalencia se declara de una forma más directa y sin tabla
nueva: **se fusionan las dos filas**. Además, con el catálogo empezando vacío,
una tabla de alias nacería sin filas y sin ninguna forma de llenarse —nadie ha
escrito todavía las dos palabras que habría que equiparar—, así que no protegería
de nada en los primeros meses, que es justo cuando se pretendía que protegiera.

La defensa real contra los duplicados es una escalera de tres peldaños, de más
frecuente a menos:

```
  1. Autocompletar   evita el duplicado antes de nacer   ← el que trabaja
  2. Índice único    impide el duplicado exacto
  3. Fusionar        repara el que se coló
```

El peldaño 2 es el barato y el que menos casos coge. El 1 es una interfaz, no una
tabla — y esto importa para la fase 6, porque **una máquina no ve el
autocompletado** (ver D11).

Lo único que un alias añadiría sobre esto es memoria: que la próxima vez que
escribas «cebolleta» resuelva a «cebolla» sin preguntar. Es una comodidad
pequeña y es una tabla nueva con una columna, añadible más adelante sin migrar
nada.

### D4 — Qué se normaliza y qué no

La equivalencia entre textos se resuelve con una **columna generada** —el nombre
en minúsculas, sin tildes y con los espacios colapsados— y un índice único sobre
`(perfil_id, normalizado)`.

Generada y no calculada en la aplicación: si la normalización vive en el código,
un `insert` desde otro sitio —una consola, una migración, un script futuro— la
esquiva y mete el duplicado que el índice existía para impedir. La invariante
vive donde viven los datos, igual que la creación del perfil.

**El plural queda deliberadamente fuera.** No hay forma segura de singularizar en
español: quitar la `s` final rompe «arroz», «anís» y «cuscús». Un falso positivo
funde dos ingredientes que no eran el mismo, y eso es peor que dejar dos
entradas separadas que la persona puede fusionar cuando le moleste. «cebolla» y
«cebollas» van a convivir, y es una decisión, no un olvido.

### D5 — Una sola puerta: buscar-o-crear en la base de datos

Toda resolución de un texto a un ingrediente pasa por una función SQL, que
normaliza, busca y crea si hace falta, en una sola sentencia
(`insert ... on conflict ... returning`).

**Alternativa descartada:** hacerlo en el `action` con dos viajes —consultar, y
si no está, insertar—. Son dos viajes en lugar de uno, y entre ambos hay una
ventana en la que dos peticiones simultáneas crean el mismo ingrediente dos
veces. El índice único convertiría esa carrera en un error 500 en vez de en un
duplicado, lo cual es mejor pero sigue sin ser bueno.

**Detalle que la distingue del precedente:** esta función NO es `security
definer`, a diferencia de `crear_perfil_para_usuario_nuevo`. Aquella lo necesita
porque quien ejecuta el alta es GoTrue, que no tiene permisos sobre
`public.profiles`. Aquí la fila es de quien la pide, así que la función corre
como invocador y la RLS se aplica con normalidad. Elevar privilegios sin
necesitarlo es regalar superficie.

### D6 — La despensa es una marca, no un inventario

Clave primaria compuesta `(perfil_id, ingrediente_id)`. Sin columna de cantidad.
La fila existe: lo tienes. No existe: no lo tienes. La justificación de producto
está en la spec de `pantry`.

Consecuencia práctica: «marcar que tengo algo que ya tenía» no es un error ni
necesita comprobación previa, es un `insert ... on conflict do nothing`.

### D7 — Los que se dan por supuestos: semilla de comportamiento, no de filas

La marca es una columna booleana **del ingrediente**. Cuando la función de D5
crea una fila cuyo nombre normalizado cae en una lista corta y fija que conoce la
aplicación —sal, aceite, pimienta, agua—, nace ya marcada.

Esto respeta «el catálogo empieza vacío» al pie de la letra: no se inserta
ninguna fila por adelantado, solo se le da un valor inicial distinto a las que la
persona cree. Y hace que el «4/7» de la fase 3 sea honesto desde la primera
receta, en vez de desde el día en que alguien se acuerde de marcar la sal.

**Alternativa descartada:** sembrar esos cuatro ingredientes al registrarse.
Contradice la decisión de partir de vacío, y le mete a todo el mundo cuatro filas
que quizá no use.

**Distinción que la fase 2 no debe fundir en la misma columna:**

```
  se_asume   propiedad del INGREDIENTE   "siempre tengo sal"
  opcional   propiedad de la LÍNEA       "perejil para decorar"
```

Las dos sacan una línea del denominador de la cobertura, pero por motivos
distintos y con interfaz distinta. Esta fase solo necesita la primera. Si acaban
siendo una sola columna, dentro de tres meses no se podrán separar.

**Límite conocido:** la marca es del ingrediente y vale para todo el recetario.
Un alioli con 200 ml de aceite tampoco lo contará. Se da por bueno: perseguir esa
excepción cuesta más de lo que arregla.

### D8 — Los privilegios se revocan y se conceden, siempre

Cada tabla nueva incluye `revoke all ... from anon, authenticated` antes de
conceder exactamente los verbos que la aplicación usa. No es defensa en
profundidad opcional: es que sin ello el privilegio concedido y el pretendido no
coinciden, y a partir de ahí cualquier razonamiento sobre la tabla parte de una
premisa falsa. Es literalmente la lección de
`20260823010000_privilegios_profiles.sql`, aplicada a tiempo esta vez.

### D9 — Fusionar es destructivo, y aquí eso es seguro

Fusionar reasigna lo que apuntaba al ingrediente descartado y borra su fila. No
queda tumba ni redirección.

Es seguro precisamente por D2: lo que se destruye es tuyo y solo tuyo. En un
catálogo compartido esto sería inaceptable —borrarías una palabra que otros
están usando— y de ahí venía la necesidad de los alias.

**No hay deshacer.** Es una operación poco frecuente y con una confirmación
delante; construir el deshacer costaría más que rehacer a mano el caso raro en
que alguien se equivoque.

### D10 — Nomenclatura: tablas en inglés, columnas en español

Se continúa exactamente el patrón que ya existe, aunque sea mixto: la tabla se
llama `profiles` y sus columnas `nombre`, `creado_en`, `actualizado_en`; las
funciones son `crear_perfil_para_usuario_nuevo` y `tocar_actualizado_en`. Así que
`ingredients` y `pantry`, con `perfil_id`, `nombre`, `normalizado`, `se_asume`.

Los identificadores de spec van en inglés por la misma razón.

Es una convención, no un argumento: cambiarla ahora cuesta reescribir este
documento, y cambiarla después cuesta una migración de renombrado por cada tabla.
Si va a cambiar, que cambie antes de la primera migración.

### D11 — Lo que este modelo tiene que aguantar en la fase 6

Se anota aquí porque condiciona decisiones de ahora, no de entonces.

En la fase 6 el autor principal de recetas deja de ser una persona y pasa a ser
una máquina que interpreta un vídeo. Eso invierte el problema de los duplicados:
ya no llegan de uno en uno, llegan de ocho en ocho, porque **una máquina no ve el
autocompletado** y escribirá «aceite de oliva virgen extra» tan contenta mientras
tú ya tienes «aceite».

La respuesta es que **tu catálogo entra en el prompt de extracción**: el
autocompletado de la máquina eres tú. Y la salida la obliga a declarar cuál de
las dos cosas está haciendo, en vez de devolver un nombre y dejar que el servidor
adivine después:

```
   { "ingrediente_id": "…" }              reutiliza uno tuyo
   { "ingrediente_nuevo": "pak choi" }    propone uno nuevo
```

Esto hace visible y revisable la decisión de reutilizar, que es exactamente donde
nacen los duplicados. Y explica por qué el catálogo privado, que parecía el
pariente pobre del global, resulta ser el bueno aquí: al modelo se le da tu
vocabulario, no el de desconocidos.

## El modelo completo, incluidas las fases siguientes

Esta fase crea las dos primeras tablas. Las demás se describen aquí para que las
fases 2 a 6 las construyan sin volver a discutirlas.

```
  profiles ─ id = auth.uid()                            [ya existe]
     │
     ├─▶ ingredients      perfil_id, nombre,            [fase 1]
     │        ▲    ▲      normalizado (generada), se_asume
     │        │    │      unique (perfil_id, normalizado)
     ├─▶ pantry ──┘    │                                [fase 1]
     │     (perfil_id, ingrediente_id) ← PK compuesta
     │                  │
     └─▶ recipes        │  titulo?, comensales?         [fase 2]
            │           │  finalizada_en?  ← null = borrador
            │           │  origen_tipo
            │           │  foto_ruta?                   [fase 5]
            │           │  origen_url?, origen_datos?   [fase 6]
            │           │
            ├─▶ recipe_ingredients ─┘                   [fase 2]
            │      orden, cantidad?, nota?      ◀────┐
            │      ingrediente_id NOT NULL           │
            │                                        │
            └─▶ steps                                │  [fase 2]
                   orden, texto                      │
                   segundo_video?                    │  [fase 6]
                        └─▶ step_ingredients ────────┘  [fase 2]

  RLS en todas:  perfil_id = auth.uid()
```

**Toda receta nace borrador**, venga de donde venga; «crear desde cero» es un
borrador vacío. Por eso `finalizada_en` es un estado y `origen_tipo` es una
procedencia, y son **dos columnas distintas**: una receta de vídeo ya terminada
sigue siendo de origen vídeo para siempre, y eso es lo que permitirá preguntar
«¿qué recetas salieron de la extracción antes de arreglar aquel fallo?».

**El esquema se aprieta al finalizar**, en vez de partirse en dos tablas: título
y comensales son nullables, y las exigencias de una receta terminada se expresan
como comprobaciones condicionadas a que `finalizada_en` no sea nulo. Un borrador
tiene que poder existir vacío; una receta terminada no.

**Las líneas de la receta resuelven su ingrediente desde el primer momento**, ya
en borrador, con `ingrediente_id NOT NULL`. La alternativa —guardar el texto y
resolver al finalizar— haría que una línea tuviera una forma mientras es borrador
y otra después, y devolvería la necesidad de un enlace nullable con el texto
original al lado. Se prefiere el desorden reparable (un catálogo con alguna
errata) al desorden estructural (dos formas de la misma fila).

**Los pasos apuntan a la línea, no al ingrediente.** La cantidad y la nota viven
en la línea, y una receta puede tener dos líneas del mismo ingrediente («100 ml
de aceite para el sofrito, 50 para terminar»): apuntando al ingrediente, el paso
no sabría a cuál se refiere. Es M:N por los dos lados.

De ahí sale gratis una comprobación de calidad para la revisión de la fase 6:
una **línea que ningún paso usa** es sospechosa —o falta un paso, o la máquina se
inventó un ingrediente—, mientras que un **paso que no usa ninguna línea** es
perfectamente normal («precalienta el horno»). La asimetría es intencionada.

**Lo que no lleva el modelo, y por qué:** ni cronómetro ni marcar pasos hechos
—el modo cocina solo lee, y «sofríe 10 minutos» ya está en el texto del paso; una
columna de duración solo se ganaría el sitio si algo calculara con ella—, ni
fotos por paso: una foto por receta y nada más.

## Risks / Trade-offs

**El catálogo se ensucia con erratas** → Escribir una palabra la mete dentro, así
que «cebolal» se queda y vuelve a aparecer en las sugerencias, invitando a
elegirla otra vez. Mitigación: los tres peldaños de D3, más la retirada de
huérfanos —un ingrediente sin despensa y sin receta se puede borrar—. Es una
tarea de mantenimiento, no un fallo de arquitectura.

**La despensa se desactualiza y nadie la mantiene** → Es el riesgo mayor del
producto entero, no solo de esta fase: todo el valor de la fase 3 depende de que
la despensa se parezca a la realidad. Mitigación aquí: que añadir y quitar cueste
un toque, y que los que se dan por supuestos no salgan nunca en la lista para no
convertirla en una tarea. Mitigación en la fase 3: que «Tienes todo» no prometa
más de lo que sabe.

**La lista de básicos vive en la aplicación, no en los datos** → Si mañana se
añade «azúcar» a la lista, las filas ya creadas no se re-marcan solas.
Mitigación: la persona puede poner la marca a mano en cualquier ingrediente
suyo, así que el caso se arregla en la interfaz y no hace falta migración. Queda
anotado para que a nadie le sorprenda.

**Fusionar no se puede deshacer** → Mitigación: confirmación explícita antes, y
la fusión es infrecuente. Aceptado en D9.

**Un catálogo por persona multiplica el trabajo futuro por ingrediente** →
Nutrición y temporada habrá que producirlas N veces si algún día existen.
Mitigación: la salida de D2 (`canonico_id`), que no obliga a migrar nada de lo
que se construya ahora. Aceptado a cambio de no tener ninguna tabla compartida.

## Migration Plan

Una sola migración, que crea las dos tablas con sus políticas, sus privilegios
explícitos (D8) y la función de resolución (D5). No hay datos previos de
ingredientes ni de despensa, así que no hay migración de datos ni estrategia de
convivencia: la vuelta atrás es tirar las dos tablas.

Se aplica primero en local con `supabase db reset` y se comprueba con
`supabase db diff --linked` antes de subirla — que es exactamente cómo se
descubrió el problema de privilegios de `profiles`, leyendo el diff y no el SQL.

`public.tocar_actualizado_en()` ya existe desde la migración de perfiles y es
genérica: si estas tablas llevan `actualizado_en`, solo hace falta el trigger.

## Open Questions

- **Orden de la lista de la despensa.** La spec exige que sea estable y
  predecible, y eso lo cumplen tanto el alfabético como el de añadido más
  reciente. Se elige al construir la pantalla; no cambia el modelo.
- **Si la retirada de huérfanos llega a ser automática.** La spec la define como
  una acción de la persona. Si con el uso resulta que nadie la ejecuta, un
  barrido automático al descartar un borrador (fase 2) es añadible sin tocar
  nada de esto.
