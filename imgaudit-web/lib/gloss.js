export const GLOSS = [
  [/^Pesa/, 'Una imagen pesada tarda más en descargarse, sobre todo en móvil. Cada tipo de imagen tiene un peso razonable; el límite es orientativo.'],
  [/^Formato/, 'JPEG, PNG y GIF son formatos antiguos. WebP guarda la misma imagen con bastante menos peso y lo soportan todos los navegadores actuales.'],
  [/^Sobredimensionada/, 'La imagen tiene más píxeles de los que se llegan a ver. En pantallas retina basta con el doble del ancho mostrado.'],
  [/^Distorsionada/, 'La imagen se estira o se aplasta porque su proporción no coincide con el hueco. Usa la proporción correcta o object-fit: cover.'],
  [/^Recorte/, 'El navegador corta parte de la imagen para llenar el hueco (object-fit: cover). Si corta mucho, puede quedar fuera lo importante.'],
  [/^Proporción/, 'La proporción (ancho:alto) no es habitual para este tipo de imagen. No es grave, pero proporciones coherentes ordenan el diseño.'],
  [/width\/height/, 'CLS (Cumulative Layout Shift) mide cuánto se mueve el contenido mientras carga la página. Sin width y height el navegador no reserva espacio y el texto salta cuando llega la imagen.'],
  [/srcset/, 'srcset ofrece varias versiones de la imagen para que el navegador elija la más pequeña que le sirva. Sin él, un móvil descarga la versión de escritorio.'],
  [/principal tiene loading/, 'La imagen principal marca la sensación de velocidad (LCP, Largest Contentful Paint). Con loading="lazy" se retrasa a propósito; debe cargar cuanto antes.'],
  [/Fuera de pantalla/, 'Con loading="lazy" las imágenes que aún no se ven solo se descargan cuando el usuario se acerca. Ahorra datos y acelera la primera carga.'],
  [/animada/, 'Un GIF animado suele pesar muchísimo. Un vídeo MP4 o WebM en bucle y sin sonido se ve igual y pesa una fracción.'],
];
