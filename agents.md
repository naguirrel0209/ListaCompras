# Agents Guide

## Proyecto

Lista Familiar es una app colaborativa de listas de compra, mobile-first y en español. Permite crear una familia, compartir un código de invitación, entrar con nombre propio y gestionar varias listas con artículos, prioridades, fechas límite, comentarios, etiquetas e historial.

Mantén la experiencia y los textos de usuario en español.

## Stack

- Cliente: React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Lucide React, tRPC React Query.
- Servidor: Node.js, Express, TypeScript, tRPC, Zod.
- Persistencia local por defecto: `data/local-db.json`.
- Persistencia opcional: MySQL/TiDB con Drizzle cuando existe `DATABASE_URL`.
- Sesión familiar: cookie HTTP-only `lista_familiar_session`, JWT firmado con `JWT_SECRET`.

## Comandos

Usa `pnpm` cuando funcione en el entorno:

```bash
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm seed
```

Si el wrapper de `pnpm` falla por resolución/red en Codex, los binarios locales suelen servir para verificar:

```bash
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\esbuild.cmd server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

En este entorno, Vite/Vitest/esbuild pueden requerir ejecución fuera del sandbox por errores de acceso al cargar configs.

## Archivos Clave

- `client/src/pages/Home.tsx`: pantalla principal de acceso y dashboard de listas.
- `client/src/index.css`: tema visual, tokens, tipografía y microinteracciones.
- `client/src/main.tsx`: cliente tRPC, React Query y manejo global de errores.
- `server/routers/family.ts`: creación, ingreso, sesión actual y salida de familia.
- `server/routers/lists.ts`: CRUD de listas.
- `server/routers/items.ts`: CRUD y estados de artículos.
- `server/routers/activities.ts`: historial reciente.
- `server/family-session.ts`: lectura, firma y limpieza de sesión familiar.
- `server/family-security.ts`: hash/verificación de contraseña compartida con scrypt.
- `server/family-repository.ts`: repositorio SQL/Drizzle y delegación a local.
- `server/local-repository.ts`: repositorio JSON local.
- `drizzle/schema.ts`: esquema persistente.
- `vitest.config.ts`: configuración de pruebas, incluyendo `LOCAL_DATA_FILE`.

## Reglas de Arquitectura

- Los routers deben validar entrada con Zod y usar `familyProcedure` para cualquier dato privado de familia.
- Toda consulta o mutación de listas/artículos debe filtrar por `familyId` o validar pertenencia antes de escribir.
- El repositorio SQL y el repositorio local deben conservar el mismo comportamiento observable.
- No elimines físicamente artículos para la acción de "quitar"; usa `status: "archived"` y conserva historial.
- Las fechas límite llegan desde la UI como fecha local al mediodía (`T12:00:00`) para evitar desfases simples de zona horaria.
- Mantén `publicFamily` sin exponer `passwordHash`.

## Persistencia Local

Sin `DATABASE_URL`, el proyecto usa `data/local-db.json`. Para pruebas, `vitest.config.ts` redirige a `.tmp/test-local-db.json`.

Ten cuidado con escrituras concurrentes en `server/local-repository.ts`: hoy se hace `readData()` seguido de `writeData()` sin bloqueo ni escritura atómica. Si tocas esta zona, considera una cola/mutex y escritura a archivo temporal con rename.

## Seguridad

Puntos a revisar antes de cambios sensibles:

- `server/routers/family.ts` no tiene rate limiting para `join`; si se endurece seguridad, empieza por ahí.
- Los códigos de invitación se generan con `Math.random()` y un espacio pequeño de palabras/números.
- La contraseña compartida permite mínimo 4 caracteres.
- `server/_core/storageProxy.ts` registra `/manus-storage/*` públicamente. Si la app no usa storage, desactívalo; si lo usa, añade autorización y valida prefijos.
- `getSessionCookieOptions` cambia `sameSite` según si la petición parece HTTPS. Revisa bien despliegues detrás de proxy.

## Dependencias

La última auditoría encontró vulnerabilidades en dependencias directas y transitivas. Prioriza actualizar:

- `@trpc/*` a una versión con `@trpc/server >= 11.8.0`.
- `vitest` a `>= 3.2.6`.
- `@tailwindcss/vite` o sus transitivas para resolver `tar >= 7.5.19`.
- `@aws-sdk/*` o overrides para resolver `fast-xml-parser >= 5.3.5`.
- `pnpm` devDependency a `>= 10.26.0`.
- `streamdown`/`mermaid`/`dompurify` si el showcase o chat markdown siguen siendo necesarios.

Después de actualizar dependencias, corre `pnpm audit --audit-level=moderate`, `pnpm test`, `pnpm check` y `pnpm build`.

## Pruebas

La suite actual cubre:

- creación e ingreso a familia;
- contraseña incorrecta;
- creación, renombrado y eliminación de listas;
- creación, edición, filtros y validación de artículos;
- alternar comprado/pendiente;
- archivar/restaurar artículos;
- historial;
- aislamiento básico entre familias.

Cuando cambies autorización o repositorios, agrega pruebas para la rama local y, si es viable, para la rama SQL.

## Estilo

- Sigue el estilo compacto del proyecto: TypeScript estricto, funciones pequeñas y validación cerca del router.
- Evita introducir abstracciones globales si el cambio es local.
- Respeta el diseño mobile-first y la UI en español.
- Usa Lucide para iconos cuando agregues controles.
- No reviertas cambios ajenos en el árbol de trabajo.
