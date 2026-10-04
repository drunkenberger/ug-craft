# Aventuras de EugeCraft

## Entrar a jugar

El servidor actualizado de esta sesión está en **http://localhost:8941**. En otra máquina, usa su dirección de red con ese mismo puerto. El servidor habitual se inicia con `node server.js` en el puerto 8940; si ya estaba abierto antes de estos cambios, hay que reiniciarlo para cargar las nuevas funciones de multijugador.

Pulsa **J** durante el juego para abrir el **Libro de aventuras**. Ahí están las misiones, los nombres de las mascotas, las opciones y una guía de cada función. **R** llama a tus mascotas. Escape o “Volver al juego” cierra el libro.

## Nuevas expediciones: las ocho mejoras

El libro tiene cuatro pestañas: **Aventura**, **Aldea y ajustes**, **Compañeros** y **Álbum**. Las coordenadas X/Y/Z aparecen en pantalla. En el minimapa, el punto morado orienta hacia una runa pendiente o el castillo; los puntos dorados señalan mochilas.

### 1. Montar caballos y navegar

La silla se fabrica con tres tablones y dos hierros. Adopta un caballo y usa la silla sobre él, o pulsa “Montar caballo” en Compañeros estando cerca. Cabalga con WASD y salta con Espacio. La cámara pasa a tercera persona y el movimiento es más rápido.

El barco se fabrica con cinco tablones. Entra al agua, selecciónalo y haz clic derecho para desplegarlo y navegar con WASD. En tierra avanza muy despacio. **Mayús izquierda** permite bajar del caballo o barco. Ambos objetos son reutilizables y permanecen en el inventario; no se pierden al bajar. Al recargar la partida apareces desmontado.

### 2. Aldeanos con profesiones

Cada aldea tiene un granjero de sombrero de paja, un herrero de gorro gris y un explorador de gorro verde. En “Aldea y ajustes” aparecen sus intercambios y encargos. Debes estar cerca del profesional correspondiente.

- Granjero: intercambia dos trigos por tres zanahorias. Su encargo pide seis zanahorias y entrega pan y semillas.
- Herrero: intercambia dos hierros por ocho flechas. Su encargo pide cuatro carbones y entrega un pico de hierro.
- Explorador: intercambia dos cristales por un oro. Su encargo pide cinco cristales y entrega una silla y un barco.

Los intercambios son repetibles; cada encargo se recompensa una sola vez por jugador y se guarda.

### 3. Cueva de cristales y tesoro

En Supervivencia hay una cueva en **X 80, Z 8**. La entrada escalonada está al sur, cerca de **X 80, Z 28**. Dentro hay cristales violetas que requieren un pico, iluminación y un tesoro. Haz clic derecho sobre el tesoro para recibir oro y hierro una sola vez por jugador.

### 4. Euge y papá: las tres llaves

Visiten los tres lugares, hagan clic derecho en sus runas y resuelvan los acertijos desde el libro:

| Lugar | Coordenadas |
| --- | --- |
| Cueva de Cristales | X 80, Z 8 |
| Torre de la Luna | X 88, Z 72 |
| Santuario del Bosque | X 20, Z 80 |
| Castillo de las Tres Llaves | X 128, Z 40 |

Cualquier jugador puede aportar una respuesta. Las runas resueltas se comparten y guardan como cambios del mundo. Al resolver las tres se abre la puerta del castillo. El cofre real entrega a cada jugador un trofeo y tres diamantes una sola vez. También se puede completar la aventura sin compañía. Las runas, puertas de misión y tesoros no se pueden destruir con herramientas ni explosiones.

### 5. Mascotas más expresivas

En Compañeros puedes acariciar, pedir que esperen o sigan, alimentar y elegir entre cinco colores de collar. Alimentarlas recupera dos puntos de salud hasta su máximo: perro con chuleta cocinada, gato con pollo crudo y caballo con manzana. Solo se gasta alimento cuando necesitan curarse. Acariciar produce una reacción de cariño y partículas.

Nombre, collar, estado de espera y salud se guardan. Cada jugador solo controla sus propias mascotas. Llamarlas con R hace que dejen de esperar y regresen a un suelo seguro cercano.

### 6. Construcción más cómoda

**Q** gira las escaleras antes de colocarlas. Colocar una losa sobre la cara superior de otra las combina en un bloque completo de tablones, gastando la segunda losa. No se combina si ocupa el espacio de un jugador.

Al seleccionar un plano y apuntar al suelo aparece una **vista previa** de 5 × 5 × 5. Verde indica que se puede construir; rojo explica el impedimento. Clic derecho valida nuevamente el terreno y construye. No gasta el plano si aparecieron obstáculos, jugadores o criaturas.

### 7. Álbum con medallas

El álbum registra automáticamente los animales cercanos, materiales y objetos del inventario y lugares visitados. Hay medallas por reunir doce materiales u objetos distintos, encontrar tres especies, visitar tres lugares y completar el castillo. Es personal y persiste entre sesiones.

### 8. Mochila de rescate y regreso a casa

En Supervivencia, al morir el inventario queda en una mochila dorada cerca del último suelo seguro. Tras revivir, consulta sus coordenadas en Aventura, acércate a menos de cinco bloques y pulsa “Recuperar objetos”. La recuperación es única: no duplica objetos. Si vuelves a morir, se conservan las mochilas anteriores. Todo se guarda; Creativo conserva sus objetos infinitos.

“Volver a casa” te lleva a la cama que fijaste como reaparición o al inicio, buscando suelo firme sin obstáculos, y llama a tus compañeros. No rellena vida ni hambre. No se puede usar mientras estás muerto.

## Aldeas y misiones

En Supervivencia, la primera plaza está en **X=40, Z=40**, cerca del inicio. Hay aldeas cada 192 bloques, con cuatro casas, camas, mesas, cofres vacíos, faroles, una fuente y un portal morado. Los caminos incluyen escalones cuando la plaza queda elevada.

Busca al aldeano con sombrero. Haz clic derecho sobre él para abrir el libro. Las misiones son personales y se completan en orden:

1. Entregar 8 troncos: recibe semillas de trigo y zanahorias.
2. Entregar 6 trigos: recibe oro y pan.
3. Adoptar una mascota: recibe un silbato y un plano de casita.
4. Visitar el Bosque Luminoso: recibe piedras luminosas y diamantes.

Para reclamar cada premio debes estar a menos de seis bloques de un aldeano. Cada misión entrega su premio una sola vez y el progreso se guarda.

## Granjas

- Fabrica una **azada** con dos tablones y dos palos en una mesa.
- Haz clic derecho sobre pasto o tierra con la azada para preparar el suelo.
- Necesitas agua al nivel del suelo, a cuatro casillas o menos en cada eje, y cielo libre sobre la planta.
- Selecciona semillas de trigo o una zanahoria y haz clic derecho sobre la tierra de cultivo.
- Tras **45 segundos de juego activo** con esas condiciones, la planta madura. Haz clic derecho para cosechar: el trigo da dos trigos y dos semillas; la zanahoria da tres zanahorias.
- Tres trigos permiten fabricar pan en una mesa. Se come con clic derecho.

También obtienes semillas al romper hierba alta, o con una receta de flores. Las zanahorias se pueden fabricar a partir de semillas. Los cultivos conservan su etapa al guardar; un brote sin madurar vuelve a contar sus 45 segundos al cargar. En red, el anfitrión simula su crecimiento.

## Mascotas

Adopta con clic derecho y el alimento seleccionado:

| Animal | Alimento |
| --- | --- |
| Perro | Hueso |
| Gato | Pollo crudo |
| Caballo | Manzana |

Los animales adoptados llevan collar, siguen a su dueño y pueden tener un nombre de hasta 20 caracteres, visible sobre ellos. El libro permite cambiarlo y llamarlos; también puedes usar **R** o el silbato. Hay un máximo de 12 compañeros por jugador. Los caballos se pueden montar con una silla: selecciona la silla y haz clic derecho sobre uno propio, o usa su botón en la pestaña Compañeros.

Se guardan especie, nombre y posición. Los antiguos guardados de perros siguen funcionando. En red, cada jugador gestiona sus propios animales y el cambio de anfitrión conserva los compañeros presentes.

## Portal y Bosque Luminoso

Haz clic derecho en el portal morado de una aldea y elige el Bosque Luminoso. Viajarás a un bosque con hongos gigantes, piedras luminosas y un campamento con columnas de obsidiana. Los piglins pueden aparecer cerca de los jugadores allí, igual que en el mundo principal.

El portal del campamento regresa al punto desde donde viajaste. El viaje conserva vida e inventario y llama a tus mascotas. Puedes fabricar portales con cuatro obsidianas, cuatro cuarzos y un oro. La región de aventura ocupa una zona lejana de la misma partida, por lo que sus construcciones y cambios se guardan y comparten con el mundo principal.

## Construcción

- **Puertas:** se colocan con dos bloques de altura, se abren con clic derecho y no se cierran si hay un jugador en su espacio.
- **Losas:** miden medio bloque y su colisión coincide con esa altura.
- **Escaleras:** tienen dos alturas y permiten subir caminando. La tecla Q alterna cuatro orientaciones antes de colocarlas.
- **Plano de casita:** crea una casa con puerta y ventanas en una superficie firme, plana y despejada de 5 × 5, con cinco bloques libres de altura. Si hay obstáculos o jugadores, no construye ni consume el plano. Se fabrica con 24 tablones y 20 ladrillos de piedra.

## Reglas, TNT y efectos

En el libro puedes activar **Modo tranquilo** para quitar los enemigos, y elegir si las explosiones pueden romper bloques. En multijugador, el anfitrión controla estas dos reglas y se guardan para toda la partida. El modo tranquilo conserva a los aldeanos, piglins y animales; no desactiva el hambre ni las caídas.

La **TNT** se fabrica con cuatro arenas y tres carbones. Colócala y haz clic derecho: tiene cuatro segundos de mecha y enciende otras TNT cercanas con una mecha de 0.6 segundos. Si se permite daño al terreno, crea un cráter de tres bloques de radio. Conserva cofres, obsidiana, agua, letreros y corazones. Daña criaturas, pero no al jugador. Al cargar TNT encendida, la mecha vuelve a cuatro segundos.

Hay sonidos sintetizados de pasos, explosiones, premios, silbato y portales; humo de mecha y partículas de explosión; sombreado de esquinas y variación suave del agua. El libro permite desactivar sonidos y efectos. Las partículas respetan la preferencia de movimiento reducido del dispositivo.

## Materiales y piglins

Creativo incluye los materiales, herramientas y elementos nuevos en el selector de la tecla **9**. En Supervivencia hay recetas para los objetos fabricables y recolección para cultivos y bloques del bosque.

Los piglins son mercaderes neutrales que cambian un oro por cuatro cuarzos al hacer clic derecho con oro seleccionado. Los nuevos materiales son bloques de construcción; el cobre es decorativo y no se oxida.

## Guardado y compatibilidad

Se mantiene el formato anterior y se añaden campos para misiones, compañeros y reglas. Las ediciones del jugador se aplican después de generar el terreno. Las parcelas de aldeas y portales modifican el terreno base, por lo que es mejor estrenar estas aventuras en una partida nueva. Los aldeanos y piglins reaparecen al explorar; no se guardan individualmente.

## Verificaciones

Ejecuta `npm test`. Las pruebas incluyen el contenido anterior y comportamientos de aldeas, TNT, cultivos, misiones, puertas, colisiones de losas y escaleras, planos, portales, mascotas y reglas.

También se probó en navegador: entrega de misión desde el libro, diseño sin desbordamiento a 390 px, renderizado del bosque, restauración del progreso y mascotas guardadas. Con dos clientes se verificaron reglas compartidas, cambio de nombre de una mascota desde el invitado y conservación de esa mascota al cambiar el anfitrión.

La suite adicional de expediciones comprueba monturas y flotación, cambios de collar y alimentación, las cuatro colisiones de escaleras, unión de losas, encargos sin duplicaciones, mochila y regreso seguro, álbum, generación de lugares, acertijos, apertura del castillo y persistencia de las runas.

En navegador se verificaron los botones de un acertijo y el libro a 390 px, además del renderizado del castillo y un jugador sentado en el barco. Con dos clientes se resolvieron runas desde ambos lados, se comprobó la puerta compartida, las preferencias de mascotas y la montura del invitado visible para el otro jugador.

## Mundos y armaduras

- **J → Mundos** permite visitar el Bosque Luminoso, el Desierto Dorado, las Cumbres Nevadas y el Reino Volcánico. Cada destino tiene un campamento con mesa, cofre y portal de regreso. También puedes volver desde el libro. El clic derecho en cualquier portal abre el menú de mundos. Elige un destino o, desde otro mundo, el regreso al mundo principal. Atravesar el portal no activa viajes automáticos.
- Los destinos comparten la partida: conservan construcciones, inventario y mascotas, también en multijugador. Cambiar entre destinos mantiene el punto de regreso al mundo principal. Son regiones de 512 × 512 bloques dentro del mismo guardado; las partidas existentes siguen funcionando.
- El desierto tiene pirámides de cuarzo con oro; las cumbres tienen abetos nevados; el reino volcánico tiene agujas de obsidiana y piedras luminosas. Los tres incluyen minerales bajo tierra.
- **J → Armaduras** permite equipar o quitar casco, pechera, pantalones y botas. En supervivencia se fabrican con **C**, cerca de una mesa: cuestan 5, 8, 7 y 4 unidades del material correspondiente. En creativo se equipan gratis desde el libro.
- Cada pieza de oro reduce los ataques un 8 %, hierro un 12 % y diamante un 18 %. Un conjunto completo protege un 32 %, 48 % o 72 %. Puedes mezclar materiales. El hambre, las caídas y el vacío mantienen su daño.
- Las piezas equipadas salen del inventario y vuelven a él al quitarlas o reemplazarlas. Se guardan por jugador y permanecen equipadas al reaparecer. Se ven con **V** (tercera persona) y en los personajes de otros jugadores.

## Reunirse en multijugador

- **J → Jugar juntos** muestra el servidor, la partida exacta, cuántos jugadores hay y la distancia a cada compañero. **Ir con mi compañero** te lleva a un lugar seguro a su lado, incluso en otro mundo, sin modificar tu inventario o salud.
- El enlace de esa sección abre la misma partida compartida en la otra computadora. Deben usar el mismo servidor y puerto, y nombres distintos. Dos partidas locales con el mismo número son guardados independientes.
- El clic derecho en los portales abre el menú para elegir destino, aunque tengas una herramienta o armadura seleccionada. Caminar a través de ellos no te teletransporta.

## Inventario al morir

Al morir y reaparecer conservas todos los objetos, sus cantidades y la armadura equipada, tanto en partidas locales como compartidas. El estado se guarda al morir y al reaparecer. Ya no se crean mochilas por nuevas muertes; las que quedaron de versiones anteriores aún se pueden recuperar desde J → Aventura.

Los objetos que permanecían en mochilas de la versión anterior vuelven automáticamente al inventario al abrir la partida. Se conservan las cantidades y se eliminan esas mochilas del mismo guardado para impedir duplicados. Al cargar aparece «Inventario protegido» o el aviso de recuperación.
