# UML State Machine Designer

Editor local de máquinas de estados UML, con interfaz en español, SVG nativo y módulos JavaScript. Permite diseñar, modificar, validar y exportar diagramas sin cuentas, backend ni conexión a internet. Implementa un subconjunto de UML 2.x, no la especificación completa.

## Ejecutar

Abre esta carpeta con VS Code y ejecuta **Open with Live Server** sobre `index.html`. También puedes usar cualquier servidor estático que sirva archivos JavaScript con su tipo MIME correcto.

Si tienes Node.js 22 o posterior, hay un servidor estático opcional, sin dependencias:

```sh
node tools/serve.js
```

Abre **http://127.0.0.1:8080**. El servidor solo entrega archivos locales; la aplicación no usa endpoints ni lógica de servidor. Detén el proceso con Ctrl + C. No abras el HTML con `file://`: los módulos ES necesitan HTTP.

No se requiere `npm install`, compilación ni servicios externos. En PowerShell, si la política de ejecución bloquea `npm`, usa `npm.cmd` o directamente los comandos `node` de esta documentación.

## Uso

1. Arrastra **Estado inicial** al lienzo. También puedes seleccionar una herramienta y hacer clic para colocarla.
2. Agrega estados simples y un estado final. La herramienta vuelve a selección después de cada creación.
3. Selecciona un estado y arrastra desde un punto azul hasta otro estado. Otra opción: activa **Transición**, haz clic en el origen y después en el destino. Elegir dos veces el mismo estado crea una transición hacia sí mismo. Un estado final no puede ser origen y un inicial no puede ser destino.
4. Selecciona un estado o transición y edita sus propiedades en el inspector. Los cambios se aplican al salir del campo o pulsar Enter en los campos de una línea. Las etiquetas usan `evento [guarda] / acción`.
5. Arrastra estados para moverlos. El controlador inferior derecho redimensiona estados simples, compuestos y barras. Shift + clic añade o quita elementos a la selección.
6. Para personalizar una ruta, haz doble clic en la línea. Se añade un punto de control que puedes arrastrar. **Restablecer ruta** vuelve al cálculo automático. Los puntos se recorren por orden de creación.
7. Usa el zoom de la barra, la rueda del ratón o **Ajustar**. Espacio + arrastrar o botón central desplaza la vista; los bordes del lienzo tienen barras de desplazamiento. Shift + rueda desplaza horizontalmente.

El lienzo mide 5000 × 3500 unidades. Las posiciones y movimientos tienen en cuenta el zoom. Se puede desactivar el ajuste a la cuadrícula y ocultar sus puntos.

### Estados compuestos

Agrega un contenedor y coloca estados dentro de su región, debajo de la cabecera. La pertenencia se detecta cuando el estado cabe por completo. Al mover el contenedor, sus descendientes se mueven juntos. Al sacar un estado, se actualiza su pertenencia. También puedes asignar un contenedor desde el inspector; el editor coloca el estado dentro o pide ampliar el contenedor si no cabe. La región principal corresponde a **Contenedor: Región principal**.

Los tamaños mínimos de un compuesto protegen los estados contenidos. Eliminar un compuesto elimina sus descendientes y transiciones asociadas, previa confirmación. Cada compuesto contiene una única región; admite compuestos anidados. Los comportamientos `entry`, `do` y `exit` se pueden guardar en estados simples y compuestos. El título y los comportamientos visibles se abrevian si no caben; el texto completo permanece en el inspector, JSON y tooltip. Amplía el estado para mostrar más líneas.

### Validación

El módulo independiente `DiagramValidator.js` distingue:

- **Errores:** identificadores duplicados, extremos inexistentes, pertenencia inválida o circular, transiciones entrantes a un inicial, salientes de un final y más de un inicial por región.
- **Advertencias:** estados desconectados, inicial sin una única salida, ausencia de inicial principal, elección sin al menos dos salidas con guardas, cardinalidad incompleta de fork/join o hijos fuera de su contenedor.

Los errores y advertencias se muestran con mensajes legibles. Haz clic en uno para seleccionar su elemento. Se pueden guardar diagramas incompletos. La importación rechaza errores que comprometen la integridad del modelo (referencias, jerarquías e identificadores); los errores semánticos se muestran en el panel para poder corregirlos.

## Atajos

Los atajos no interceptan la escritura en campos de texto. Los de selección y edición de elementos solo actúan cuando el foco está en el lienzo.

| Atajo | Acción |
| --- | --- |
| Ctrl/Cmd + Z | Deshacer |
| Ctrl/Cmd + Y, Ctrl/Cmd + Shift + Z | Rehacer |
| Ctrl/Cmd + S | Descargar JSON |
| Ctrl/Cmd + O | Abrir JSON |
| Ctrl/Cmd + A | Seleccionar todos los elementos |
| Ctrl/Cmd + C / V | Copiar / pegar estados y sus conexiones internas |
| Ctrl/Cmd + D | Duplicar selección |
| Delete o Backspace | Eliminar selección |
| Shift + clic | Añadir o quitar de la selección |
| Tab, luego Enter sobre un elemento SVG | Enfocar y seleccionar el elemento |
| Flechas / Shift + flechas | Mover 1 / 20 unidades |
| V / T | Seleccionar / crear transición |
| Espacio + arrastrar | Desplazar vista |
| Escape | Cancelar gesto o conexión, cerrar menú, volver a selección |

Copiar y pegar usa un portapapeles interno de la aplicación; no necesita permisos del sistema. Copia las jerarquías elegidas y las transiciones cuyos dos extremos pertenecen a esa selección. Las transiciones aisladas no se duplican. El menú contextual ofrece las mismas operaciones. El historial conserva hasta 100 operaciones, una por gesto completado; una nueva edición descarta la rama de rehacer. La vista y el zoom no forman parte del historial.

## Guardar, abrir y exportar

- **Guardar:** descarga el modelo completo como JSON versión `1.0`, incluyendo identificadores, geometría, jerarquías, propiedades, conexiones, puntos de control y vista.
- **Abrir:** elige un JSON local. La estructura se valida antes de sustituir el proyecto. Se aceptan hasta 10 MB, 1000 nodos y 3000 transiciones como límites de entrada; el objetivo de uso fluido es 100 estados y 200 transiciones. No se ejecuta contenido del archivo ni se inserta texto importado como HTML.
- **SVG:** exporta todo el contenido, independientemente del zoom o desplazamiento, con márgenes, etiquetas y estilos embebidos. No incluye cuadrícula, controles de selección ni CSS externo.
- **PNG:** genera una imagen rasterizada real del SVG a **2×**, mediante `Image`, `canvas` y `toBlob`. Para evitar exceder la memoria del navegador se rechazan imágenes con más de 64 millones de píxeles o un lado superior a 16384 píxeles; SVG sigue disponible.
- El fondo es blanco por defecto. Sin elementos seleccionados, el inspector permite cambiar el **Fondo de exportación**. Es una preferencia de la sesión.

El navegador decide la carpeta de descarga y si muestra un diálogo. La aplicación prepara la descarga, pero no puede confirmar que el usuario la haya guardado. Se solicita confirmación al reemplazar un trabajo modificado y al eliminar selecciones múltiples o contenedores con hijos. Las eliminaciones individuales se pueden deshacer. Se activa el aviso nativo de salida cuando hay cambios pendientes. Guarda JSON regularmente: no hay almacenamiento automático, nube ni persistencia del historial tras recargar.

## Arquitectura

```text
index.html                  Interfaz semántica
src/css/                    Diseño, controles y estilos SVG
src/js/
  core/                     Modelo central, historial y coordinador del editor
  models/                   Fábricas de estados y transiciones
  rendering/                Renderizado incremental de nodos y rutas SVG
  interactions/             Arrastre, conexiones y zoom
  services/                 Validación UML e importación/exportación
  ui/                       Barra, paleta, inspector y menú contextual
  utils/                    Geometría, constantes e identificadores
examples/                   Proyectos válidos para pruebas manuales
tests/                      Pruebas nativas de Node y navegador
tools/                      Servidor estático opcional y generación de ejemplos
```

`DiagramModel` conserva el modelo independientemente del DOM. La selección, herramienta activa, portapapeles y gestos son estado temporal del editor. `HistoryManager` gestiona instantáneas por operación. El renderizador reutiliza los grupos SVG y actualiza su contenido solo cuando cambian sus datos; agrupa los movimientos con `requestAnimationFrame`. La jerarquía conserva coordenadas absolutas, evitando conversiones al conectar estados de regiones distintas.

La geometría calcula intersecciones con círculos, rombos y rectángulos, busca rutas por carriles horizontales/verticales penalizando obstáculos y separa conexiones múltiples. Los bucles tienen rutas exteriores propias. Los puntos de control manuales tienen prioridad sobre las rutas automáticas. No se usan bibliotecas, fuentes remotas, imágenes externas, frameworks, backend o dependencias de ejecución.

## Pruebas

Se requiere Node.js 22 o posterior únicamente para las herramientas de desarrollo.

```sh
node --test tests/*.test.js
# O bien:
npm test
```

Cubren creación de todos los tipos, identificadores, conexiones y etiquetas UML, eliminación en cascada, pertenencia y movimiento compuesto, duplicación, serialización/importación, datos malformados, validación, historial, intersecciones, rutas dinámicas, bucles, conexiones paralelas y obstáculos.

`node tests/performance.mjs` mide el cálculo de rutas con 100 estados y 200 transiciones. El tiempo depende del equipo y de la distribución de los elementos; no es una garantía de rendimiento para cualquier diagrama.

Comprobación opcional de navegador con Chrome instalado, sin dependencias de automatización:

```sh
node tests/browser.mjs
```

En Windows busca Chrome en `C:/Program Files/Google/Chrome/Application/chrome.exe`. Puedes configurar `BROWSER_PATH` para la ruta de Chrome o Edge de tu equipo. Usa los puertos libres 8080 y 9223. La prueba lanza un servidor estático y un navegador headless propios y los cierra al terminar. Guarda capturas de 1366 × 768 y 1920 × 1080, exportaciones y un perfil de prueba en `.tmp/`, excluido del control de versiones. Verifica creación por paleta, conexiones y bucles, arrastre, inspector, historial, duplicación y portapapeles, conexiones con zoom, descargas SVG/PNG/JSON, importación mediante selector de archivos, compuestos y ausencia de errores JavaScript.

### Prueba manual de aceptación

1. Crea un inicial, tres estados simples y un final.
2. Conéctalos en orden; crea un bucle y una conexión inversa entre dos estados.
3. Edita nombres, evento, guarda, acción y comportamientos internos.
4. Cambia el zoom, mueve y redimensiona estados; verifica que las líneas siguen sus extremos.
5. Añade un punto a una conexión y arrástralo. Selecciona y elimina estados y conexiones; prueba deshacer y rehacer.
6. Guarda JSON y exporta SVG y PNG. Abre las imágenes y verifica sus etiquetas y márgenes.
7. Recarga, abre el JSON y continúa moviendo y editando.
8. Abre `examples/compuesto.json`: prueba mover el contenedor, sacar un hijo, cambiar orientación de barras y modificar guardas.
9. Desconecta la red y repite el flujo con el servidor estático local activo.

`examples/pedido.json` contiene el flujo de aceptación con tres estados y un bucle. El botón del lienzo vacío lo abre. `examples/compuesto.json` incluye estado compuesto, inicial interno, fork, join, elección y final interno. Los ejemplos también se pueden abrir desde **Abrir**.

## Límites conocidos

- Subconjunto UML 2.x: una región por compuesto; no hay regiones ortogonales, historial UML, submáquinas, puntos de entrada/salida, simulación ni ejecución semántica de guardas o acciones.
- Las rutas automáticas son heurísticas. En diagramas densos o con elementos superpuestos pueden cruzar nodos o etiquetas; usa puntos de control para ajustarlas. No hay prevención automática de colisión entre etiquetas. La intersección rectangular aproxima las esquinas redondeadas de los estados.
- La vista se optimiza para escritorio y ratón, con paneles visibles a 1366 × 768 y 1920 × 1080; no es un editor móvil. Los controles y la selección de nodos son accesibles por teclado, pero crear conexiones y redimensionar en el lienzo requiere ratón (las dimensiones también se editan en el inspector).
- No hay selección por marco, autoorganización ni portapapeles del sistema. Shift + clic y Ctrl + A permiten selección múltiple. No se guarda automáticamente al cerrar.
- El texto de nodos se abrevia cuando no cabe; las etiquetas de transición se dividen en líneas. Los valores completos siguen disponibles en el inspector y el JSON.
#   U M L _ G e n e r a t o r  
 