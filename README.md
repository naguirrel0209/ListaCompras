# Lista Familiar

**Lista Familiar** es una aplicación colaborativa de listas de compra, diseñada primero para el móvil. Una familia crea un espacio compartido, recibe un código de invitación y puede mantener varias listas —por ejemplo, la compra semanal, la farmacia y la ferretería— sin crear cuentas personales.

La interfaz y la documentación están redactadas íntegramente en español. Cada persona que entra identifica su nombre para que el historial muestre quién añadió, compró, retiró o restauró un artículo.

| Área | Implementación |
| --- | --- |
| Cliente | React 19, TypeScript, Tailwind CSS 4, Lucide React y tRPC React Query |
| Servidor | Node.js, Express, TypeScript, tRPC y Zod |
| Persistencia | Archivo JSON local por defecto; Drizzle ORM sobre MySQL/TiDB opcional |
| Seguridad | Contraseñas compartidas con `scrypt`, cookies HTTP-only firmadas mediante JWT y autorización por familia |
| Calidad | Vitest, comprobación estática de TypeScript y build de producción |

> El proyecto original venía adaptado al scaffold de Manos, con backend Express tipado, Drizzle y soporte para MySQL/TiDB. Para uso local en esta computadora se agregó persistencia por archivo JSON, manteniendo MySQL/TiDB como opción si defines `DATABASE_URL`.

## Capacidades principales

La aplicación permite crear una familia con contraseña opcional, compartir un código legible, entrar con nombre propio y mantener la sesión activa durante treinta días. Cada familia puede crear varias listas, eliminarlas cuando ya no se necesitan y añadir artículos con prioridad, fecha límite opcional, comentario y etiquetas. Al crear un artículo se puede elegir una o varias listas de la misma familia; la lista activa aparece seleccionada por defecto. Las cantidades ya no se muestran como campo propio: cualquier detalle de tamaño, unidades o marca se anota en el comentario. Los artículos se pueden editar, marcar como comprados, retirar con una razón y restaurar más tarde desde el historial.

Las búsquedas, filtros por estado, prioridad y etiqueta, y la ordenación por prioridad o fecha límite se combinan dentro de la lista activa. La prioridad admite cuatro niveles: **crítica**, **alta**, **media** y **baja**. El selector de tema permite alternar entre modo claro y oscuro; la preferencia se conserva en el dispositivo. Las consultas se actualizan automáticamente cada cinco segundos mientras la pantalla está abierta; esto proporciona una sincronización cercana a tiempo real sin exigir un proceso de servidor permanente.

## Requisitos previos

Para correr la aplicación localmente se necesita Node.js 22 o una versión posterior y `pnpm`. El proyecto ya incluye un archivo `.env` local con `JWT_SECRET`, así que no necesitas configurar una base de datos para empezar.

Si defines `DATABASE_URL`, la aplicación usa MySQL/TiDB con Drizzle. Si no defines `DATABASE_URL`, usa automáticamente `data/local-db.json`, un archivo local persistente que se crea al guardar datos o al ejecutar el seed.

| Variable | Finalidad |
| --- | --- |
| `DATABASE_URL` | Opcional. Conecta Drizzle y el seed con una base MySQL/TiDB. |
| `JWT_SECRET` | Firma y verifica la cookie de sesión compartida por familia. |
| `SINGLE_FAMILY_MODE` | Activa en el backend el acceso a una sola familia configurada. Usa `true` o `false`. |
| `SINGLE_FAMILY_INVITE_CODE` | Opcional. Código de invitación de la familia permitida en modo familia única. |
| `SINGLE_FAMILY_ID` | Opcional. Identificador interno de la familia permitida en modo familia única. Tiene prioridad sobre `SINGLE_FAMILY_INVITE_CODE`. |
| `VITE_SINGLE_FAMILY_MODE` | Activa en el frontend la pantalla simple donde solo se pide el nombre del familiar. |
| `NODE_ENV` | Activa los ajustes de desarrollo o producción. |
| `LOCAL_DATA_FILE` | Opcional. Cambia la ruta del archivo JSON local. |

## Instalación y ejecución

Instala dependencias, carga datos de demostración y arranca el servidor local.

```bash
pnpm install
pnpm seed
pnpm dev
```

Abre la URL que imprime la terminal, normalmente `http://localhost:3000/`.

Para usar MySQL/TiDB en lugar del archivo JSON local, agrega `DATABASE_URL` al `.env` y prepara el esquema antes del seed.

```bash
pnpm db:push
pnpm seed
pnpm dev
```

## Modo de familia única

Para probar la aplicación con una sola familia sin eliminar el flujo público original, activa el modo de familia única en backend y frontend. En este modo la pantalla inicial muestra únicamente un formulario para escribir el nombre del familiar; el navegador no envía ni elige el código o identificador de familia.

Configura una familia existente por código de invitación:

```bash
SINGLE_FAMILY_MODE=true
SINGLE_FAMILY_INVITE_CODE=HOGAR-2026
VITE_SINGLE_FAMILY_MODE=true
```

O configúrala por identificador interno:

```bash
SINGLE_FAMILY_MODE=true
SINGLE_FAMILY_ID=fam_xxxxxxxxxxxxxxxx
VITE_SINGLE_FAMILY_MODE=true
```

Si defines ambos, `SINGLE_FAMILY_ID` tiene prioridad. El acceso crea la misma cookie HTTP-only que el flujo normal y registra la entrada del familiar en el historial. En este modo no se muestra el botón para salir de la familia desde el dashboard, y el backend rechaza `logout` con un error claro. Para volver al login público de crear o unirse con código y recuperar la salida normal, deja `SINGLE_FAMILY_MODE=false` y `VITE_SINGLE_FAMILY_MODE=false`.

Para generar una versión de producción y servirla localmente, ejecuta lo siguiente.

```bash
pnpm build
pnpm start
```

## Datos de demostración

Después de ejecutar `pnpm seed`, puedes acceder con las siguientes credenciales:

| Campo | Valor |
| --- | --- |
| Código familiar | `HOGAR-2026` |
| Contraseña compartida | `familia2026` |
| Nombre sugerido | `Elena`, `Pablo` o `Lucía` |

El seed se puede ejecutar más de una vez. Antes de insertar, elimina únicamente el conjunto demostrativo `Casa Albor` y lo vuelve a crear con tres listas, prioridades variadas, fechas límite, comentarios, artículos pendientes y completados, un artículo retirado y actividad de distintas personas.

## Verificación de calidad

La suite cubre la creación y acceso de una familia, contraseñas incorrectas, creación y eliminación de listas, artículos válidos e inválidos sin cantidad visible, fecha límite opcional, creación en varias listas, filtros, marcado como comprado, retiro con razón, restauración, historial y aislamiento entre familias. Ejecuta las comprobaciones con los siguientes comandos.

```bash
pnpm test
pnpm check
pnpm build
```

## Estructura principal

```text
client/src/pages/Home.tsx     Pantalla de acceso y panel móvil de listas
client/src/index.css          Tema visual, tipografía y microinteracciones
server/routers/               Procedimientos de familia, listas, artículos e historial
server/family-session.ts      Cookie de sesión familiar firmada y persistente
server/family-security.ts     Hash y verificación de contraseña con scrypt
server/family-repository.ts   Acceso a datos y registro de actividad
drizzle/schema.ts             Entidades persistentes y tipos del dominio
scripts/seed.mjs              Datos reproducibles de demostración
server/family-lists.test.ts   Pruebas automatizadas del dominio
```

## Decisiones técnicas

La sesión familiar no depende del inicio de sesión OAuth del scaffold. El servidor firma una cookie HTTP-only que contiene únicamente el identificador de la familia y el nombre visible del integrante. Cada procedimiento privado comprueba esa cookie y filtra las consultas por `familyId`, por lo que un código de artículo de otra familia no concede acceso a su información.

Los artículos no se eliminan físicamente. La acción de “quitar” cambia su estado a `archived`, guarda quién lo hizo y una razón, y permite restaurarlo. Esto conserva el contexto de compra y hace posible el historial compartido.

Para permitir que un producto aparezca en varias listas sin migración destructiva, el modelo conserva `shoppingListId` y crea una fila por lista seleccionada, enlazadas por `sharedItemId`. Los campos compartidos del producto, como nombre, prioridad, comentario, etiquetas y fecha límite, se propagan al editar una de esas filas. Los estados operativos, como comprado, retirado o restaurado, se mantienen por lista para que una tienda no afecte automáticamente a otra. Los artículos anteriores siguen funcionando porque, si no tienen `sharedItemId`, se interpretan como productos individuales.

La sincronización se resuelve con actualización automática de las consultas desde el cliente cada cinco segundos y también cuando la ventana recupera el foco. Esta elección es compatible con una ejecución autoscalable y no requiere WebSockets ni un servidor que permanezca activo.

## Limitación conocida

La actualización colaborativa es **cercana a tiempo real**, no una conexión push instantánea. En condiciones normales, los cambios de otro integrante aparecen en la siguiente actualización automática, en un máximo aproximado de cinco segundos mientras la pantalla está abierta.
