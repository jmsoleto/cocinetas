# Roadmap

El orden en que se construye Cocinetas, y por qué ese orden y no otro.

No es una lista de deseos ni un compromiso de fechas: es el reparto en fases de
un modelo de datos que **se decidió entero de una vez**. El diseño completo
—catálogo, despensa, recetas, pasos, importación— vive en
`changes/archive/2026-08-29-add-pantry/design.md`, el change de la fase 1. Está
archivado, pero sigue siendo la referencia: es donde se razonó cada decisión y
qué alternativas se descartaron. Las fases siguientes lo construyen a trozos; no lo
renegocian. Si una fase necesita cambiar el modelo, eso es una señal de que algo
se pensó mal, no de que toca improvisar.

Lo que se reparte son las migraciones y las pantallas. Ninguna tabla nace antes
de que exista quien la use.

```
   1 · Mi cocina ──▶ 2 · Recetario ──┬──▶ 3 · Qué puedo hacer
                                     │
                                     ├──▶ 4 · Modo cocina
                                     │
                                     └──▶ 5 · Foto ──▶ 6 · Importar vídeo
```

---

## 1 · Mi cocina — el catálogo y la despensa ✓ HECHA

**Qué se entrega.** Una pantalla donde escribes lo que tienes en casa, con
autocompletado. Añadir, quitar, renombrar, y fusionar dos entradas que resultaron
ser lo mismo.

**Por qué va primero, antes que las recetas.** El catálogo de ingredientes
empieza vacío: es una decisión tomada, no un descuido. Eso significa que las
primeras recetas se teclean sin una sola sugerencia. Si la despensa va delante,
cuando llegue la receta número uno tu vocabulario ya existe y el autocompletado
ya funciona. **La despensa es el mecanismo de siembra del catálogo**, y por eso
la pega de haber empezado vacío se convierte en la primera fase.

Además valida en la superficie más pequeña posible lo que más se ha discutido:
la clave normalizada, el índice único por perfil, la resolución
buscar-o-crear, la marca de los ingredientes que se dan por supuestos, y las
operaciones de reparar. Si algo de eso está mal pensado, se descubre aquí y no
con cuarenta recetas dentro.

- **Tablas**: `ingredientes`, `despensa`
- **Specs**: `ingredients`, `pantry`
- **Change**: `add-pantry`, archivado el 2026-08-29 en
  `changes/archive/2026-08-29-add-pantry/`. Las dos specs están ya volcadas en
  `specs/ingredients/` y `specs/pantry/`, que son el contrato vigente.

## 2 · Recetario — escribir recetas a mano

**Qué se entrega.** El editor de recetas: crear desde cero, guardar como
borrador, editar, finalizar. La lista de recetas con los borradores aparte, y la
pantalla de detalle.

**Por qué va aquí.** Es la fase grande y la más incierta: el editor es la
interfaz más difícil de la aplicación —líneas de ingrediente con autocompletado,
pasos ordenables, y la unión entre ambos—. Llega en segundo lugar apoyándose en
un catálogo que ya funciona y que ya tiene vocabulario real dentro.

Toda receta nace borrador, venga de donde venga. «Crear desde cero» es un
borrador vacío. Eso hace que la importación de la fase 6 no necesite pantalla
propia: reutiliza este editor, precargado.

- **Tablas**: `recetas`, `receta_ingredientes`, `pasos`, `paso_ingredientes`.
  `recetas.origen_tipo` nace aquí valiendo `manual`; las columnas del vídeo no
  se crean hasta la fase 6.
- **Specs**: `recipes`

**Si se hace larga, aquí es donde partirla:** primero el modelo, la lista y el
detalle —con dos o tres recetas metidas a mano por SQL para poder verlas—, y
después el editor. Adelanta el trabajo visual de la aplicación y prueba el modelo
con datos reales antes de construir la pantalla cara. La pega es que el
entregable intermedio no lo puede usar nadie sin acceso a la base de datos.

## 3 · Qué puedo hacer — el cruce

**Qué se entrega.** El «4/7 ingredientes», el «Tienes todo», y el filtro de
«solo con lo que tengo en casa».

**Por qué tiene change propio.** Es trabajo pequeño —una vista, un par de
índices, una insignia y un filtro— y cabría dentro de la fase 2. Va aparte por
dos razones: es **la tesis del producto**, lo que hace que Cocinetas no sea otro
recetario, y merece su propia spec con sus propios escenarios; y la fase 2 ya es
suficientemente grande sin ella.

- **Tablas**: ninguna nueva. Una vista, que **tiene que declararse
  `security_invoker = true`**: una vista normal corre con los privilegios de
  quien la creó y se salta la RLS entera.
- **Specs**: `recipe-coverage`

## 4 · Modo cocina

**Qué se entrega.** La pantalla de cocinar: paso a paso, con los ingredientes de
ese paso al lado, y navegación adelante y atrás para poder moverse por la receta.

Sin cronómetro y sin marcar pasos hechos. No hay nada que guardar: es una
pantalla que solo lee.

- **Tablas**: ninguna. Cero columnas, cero escrituras.
- **Specs**: `cook-mode`

**Es movible.** No depende más que de que existan recetas finalizadas, así que
puede adelantarse por delante de la 3 si en algún momento interesa más.

## 5 · Foto de la receta

**Qué se entrega.** Una foto por receta. No hay fotos por paso.

**Por qué fase propia y no una columna dentro de la 2.** Porque no es una
columna: es Supabase Storage, un bucket, políticas RLS sobre `storage.objects`,
la subida desde el móvil y —como todo aquí es privado— URLs firmadas que caducan
y hay que generar en cada `loader`. Es un mecanismo nuevo entero, y meterlo en la
fase 2, que ya es la más cargada, lo escondería.

**Por qué antes del vídeo.** Para que la extracción pueda quedarse un fotograma
como foto de la receta. Al revés habría que reprocesar lo ya importado.

- **Tablas**: una columna en `recetas`, un bucket privado y sus políticas.
- **Specs**: `recipe-photo`

## 6 · Importar desde vídeo

**Qué se entrega.** Pegas un enlace y sale un borrador, que abres en el editor de
la fase 2 y terminas a mano.

**Por qué la última.** Necesita que el editor exista —un borrador sin editor no
sirve de nada— y para entonces habrás usado el esquema a mano decenas de veces.
La skill se escribe contra un contrato probado en vez de contra uno inventado.

Dos cosas que este change hereda del diseño y no puede replantearse:

- El contrato de la skill no es «una receta válida», es **«un borrador válido»**.
  Un borrador admite huecos por definición, así que una extracción parcial es
  legal por construcción y no un caso de error. La regla para el modelo es que
  **`null` es una respuesta legítima**: no sabe cuántos comensales, `null`, no
  «4».
- Tu catálogo entra en el prompt. Una máquina no ve el autocompletado, así que
  si no se le da tu vocabulario propondrá «aceite de oliva virgen extra» cuando
  ya tienes «aceite», y los duplicados no llegan de uno en uno sino de ocho en
  ocho.

- **Tablas**: `recetas.origen_url`, `recetas.origen_datos`,
  `pasos.segundo_video`.
- **Specs**: `video-import`

---

## Fuera del reparto

**El `?code=` de la confirmación de correo** sigue anotado en `PENDIENTE.md`.
Son unas veinte líneas y hoy hace que todo el que se registra tenga que escribir
la contraseña dos veces. Cabe en cualquier hueco; no se le asigna fase porque no
depende de nada de esto.

**Inter desde Google Fonts**, también en `PENDIENTE.md`. Igual: independiente.
