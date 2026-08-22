# Evidencias de verificación visual

| Escenario | Resultado verificado |
| --- | --- |
| Panel autenticado en móvil (390 × 844) | El panel de Casa Albor mostró el encabezado familiar, el código compartible, selector horizontal de listas, formulario táctil de artículos, filtros y estado vacío legible en una sola columna. |
| Panel autenticado en escritorio | La vista mostró simultáneamente listas, formulario, artículos e historial reciente sin desbordamientos. |
| Fallo de `family.current` | Se mostró el mensaje en español “No pudimos abrir tu lista” con la acción “Reintentar”. |
| Fallo de listas | Se mostró el mensaje “No pudimos cargar tus listas” con la acción “Reintentar”. |
| Fallo de artículos | Se mostró el mensaje “No pudimos actualizar los artículos de esta lista” con la acción “Reintentar”. |
| Fallo de historial | Se mostró el mensaje “No pudimos cargar el historial” con la acción “Reintentar”. |
| Recuperación mediante reintento | En las consultas de listas, artículos e historial, se restauró la conexión y se accionó el botón “Reintentar”; cada panel volvió a mostrar los datos correspondientes. |

Las capturas temporales de estas comprobaciones se mantienen fuera del directorio de despliegue, en el espacio de activos de verificación.

La vista textual del navegador confirmó explícitamente para el fallo de sesión: “No pudimos abrir tu lista”, “Comprueba tu conexión y vuelve a intentarlo.” y la acción “Reintentar”.
