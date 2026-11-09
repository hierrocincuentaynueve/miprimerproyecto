/**
 * PREMIOS DEL CALENDARIO DE ADVIENTO 2026
 * ---------------------------------------------------------------
 * Este es el único archivo que hay que tocar para cambiar premios,
 * textos de campaña o el aviso legal. No hace falta modificar nada más.
 *
 * Esquema de cada premio:
 *   dia          → número del 1 al 24 (día de diciembre en que se desbloquea)
 *   titulo       → título corto del premio
 *   descripcion  → una o dos frases explicando el premio
 *   codigo       → código de canje (formato ADV26-DD-XXXX). Es lo que se
 *                  muestra en grande y lo que contiene el código QR.
 *   condiciones  → letra pequeña específica de este premio
 *   caducidad    → fecha límite de canje en formato AAAA-MM-DD
 *   ilustracion  → nombre de un SVG de /assets/svg/premios/ (sin extensión):
 *                  mancuerna, ticket, entrenando, silbato, spa, botella,
 *                  zapatilla, taza, regalo, estrella, etiqueta, kettlebell
 */

export const CAMPANA = {
  empresa: 'Tu Club Deportivo',
  titulo: 'Calendario de Adviento',
  anio: 2026,
  // Texto del pie de la página
  pie: 'Promoción exclusiva para socios y clientes de Tu Club Deportivo. Diciembre de 2026.',
};

/** Aviso legal genérico que aparece al pie de la ventana de cada premio. */
export const AVISO_LEGAL =
  'Promoción válida exclusivamente para socios y clientes con alta activa. Un único uso por socio y código. ' +
  'No acumulable a otras ofertas ni canjeable por dinero. El canje se realiza en la recepción del centro presentando ' +
  'el código y, si se solicita, un documento identificativo. Sujeta a disponibilidad y a las condiciones de cada centro. ' +
  'La empresa se reserva el derecho a modificar o cancelar la promoción por causas justificadas.';

export const PREMIOS = [
  {
    dia: 1,
    titulo: '10 % de descuento en tu cuota de enero',
    descripcion: 'Empezamos el Adviento con fuerza: ahorra un 10 % en la cuota mensual de enero de 2027.',
    codigo: 'ADV26-01-NV4K',
    condiciones: 'Aplicable a cuotas mensuales individuales. Debe canjearse antes de que se emita el recibo de enero.',
    caducidad: '2026-12-31',
    ilustracion: 'etiqueta',
  },
  {
    dia: 2,
    titulo: 'Clase gratuita de ciclo indoor',
    descripcion: 'Reserva una plaza en cualquier sesión de ciclo indoor y pedalea al ritmo de la música.',
    codigo: 'ADV26-02-PD7R',
    condiciones: 'Sujeto a disponibilidad de plazas. Reserva previa en recepción o en la app del centro.',
    caducidad: '2027-01-31',
    ilustracion: 'ticket',
  },
  {
    dia: 3,
    titulo: 'Pase de un día para un amigo',
    descripcion: 'Trae a quien tú quieras a entrenar contigo un día completo, con acceso a sala y actividades dirigidas.',
    codigo: 'ADV26-03-AM9G',
    condiciones: 'El invitado debe ser mayor de 16 años y no haber sido socio en los últimos 6 meses.',
    caducidad: '2027-01-31',
    ilustracion: 'entrenando',
  },
  {
    dia: 4,
    titulo: 'Café o infusión gratis',
    descripcion: 'Date un respiro después de entrenar: te invitamos a un café o una infusión en la cafetería del club.',
    codigo: 'ADV26-04-CF3T',
    condiciones: 'Válido en centros con cafetería propia. Una consumición por código.',
    caducidad: '2027-01-15',
    ilustracion: 'taza',
  },
  {
    dia: 5,
    titulo: '15 % en ropa técnica',
    descripcion: 'Renueva tu equipación con un 15 % de descuento en ropa técnica de la tienda del club.',
    codigo: 'ADV26-05-RT6W',
    condiciones: 'No aplicable a artículos ya rebajados. Un ticket de compra por código.',
    caducidad: '2027-01-31',
    ilustracion: 'zapatilla',
  },
  {
    dia: 6,
    titulo: 'Sesión con entrenador personal',
    descripcion: 'Una sesión individual de 45 minutos con uno de nuestros entrenadores para revisar tu técnica y tus objetivos.',
    codigo: 'ADV26-06-EP2M',
    condiciones: 'Cita previa en recepción. Sesión no transferible.',
    caducidad: '2027-02-15',
    ilustracion: 'silbato',
  },
  {
    dia: 7,
    titulo: 'Circuito termal de 90 minutos',
    descripcion: 'Relájate en nuestra zona de aguas: piscina de hidromasaje, sauna, baño turco y duchas de contraste.',
    codigo: 'ADV26-07-SP8H',
    condiciones: 'Válido en centros con spa. Imprescindible gorro y chanclas. Reserva previa.',
    caducidad: '2027-02-28',
    ilustracion: 'spa',
  },
  {
    dia: 8,
    titulo: 'Botella isotérmica de regalo',
    descripcion: 'Llévate una botella isotérmica de acero del club para que la hidratación nunca falte en tus entrenos.',
    codigo: 'ADV26-08-BT5L',
    condiciones: 'Hasta fin de existencias. Una unidad por socio.',
    caducidad: '2027-01-31',
    ilustracion: 'botella',
  },
  {
    dia: 9,
    titulo: 'Valoración de composición corporal',
    descripcion: 'Análisis por bioimpedancia con informe de masa muscular, grasa e hidratación, explicado por un técnico.',
    codigo: 'ADV26-09-BC4Q',
    condiciones: 'Cita previa. No apto para personas con marcapasos ni embarazadas.',
    caducidad: '2027-02-28',
    ilustracion: 'mancuerna',
  },
  {
    dia: 10,
    titulo: '2×1 en batidos de proteína',
    descripcion: 'Pide un batido de proteína en la cafetería y el segundo corre de nuestra cuenta. ¡Ideal para compartir!',
    codigo: 'ADV26-10-BP7X',
    condiciones: 'Ambos batidos deben pedirse en la misma consumición. Válido en centros con cafetería.',
    caducidad: '2027-01-31',
    ilustracion: 'taza',
  },
  {
    dia: 11,
    titulo: 'Clase gratuita de yoga o pilates',
    descripcion: 'Encuentra tu equilibrio con una clase de yoga o pilates suelo, a elegir según el horario de tu centro.',
    codigo: 'ADV26-11-YP3N',
    condiciones: 'Sujeto a disponibilidad de plazas. Reserva previa.',
    caducidad: '2027-01-31',
    ilustracion: 'ticket',
  },
  {
    dia: 12,
    titulo: 'Semana gratis para un amigo',
    descripcion: 'Regala a un amigo siete días de acceso libre al club. Entrenar acompañado siempre motiva más.',
    codigo: 'ADV26-12-SA6F',
    condiciones: 'El invitado debe registrarse en recepción con documento identificativo. Días consecutivos.',
    caducidad: '2027-02-15',
    ilustracion: 'entrenando',
  },
  {
    dia: 13,
    titulo: '20 % en masaje deportivo',
    descripcion: 'Descarga tensiones con un masaje deportivo de 30 o 60 minutos con un 20 % de descuento.',
    codigo: 'ADV26-13-MD9P',
    condiciones: 'Cita previa con el servicio de fisioterapia del centro.',
    caducidad: '2027-02-28',
    ilustracion: 'spa',
  },
  {
    dia: 14,
    titulo: 'Matrícula gratis para un amigo',
    descripcion: 'Si un amigo se da de alta gracias a ti, no paga matrícula. ¡Y tú sumas un compañero de entrenamiento!',
    codigo: 'ADV26-14-MG2D',
    condiciones: 'Válido para altas nuevas con permanencia mínima de 3 meses. El amigo debe presentar este código.',
    caducidad: '2027-01-31',
    ilustracion: 'regalo',
  },
  {
    dia: 15,
    titulo: 'Entrenamiento funcional en grupo reducido',
    descripcion: 'Una sesión de entrenamiento funcional con kettlebells en grupo de máximo 6 personas.',
    codigo: 'ADV26-15-KB5S',
    condiciones: 'Plazas limitadas. Reserva previa en recepción.',
    caducidad: '2027-01-31',
    ilustracion: 'kettlebell',
  },
  {
    dia: 16,
    titulo: '10 % en suplementación',
    descripcion: 'Descuento del 10 % en proteínas, barritas y suplementos de la tienda del club.',
    codigo: 'ADV26-16-SU8V',
    condiciones: 'No acumulable con otras promociones de tienda. Un ticket por código.',
    caducidad: '2027-01-31',
    ilustracion: 'etiqueta',
  },
  {
    dia: 17,
    titulo: 'Toalla del club de regalo',
    descripcion: 'Una toalla de microfibra con el logotipo del club, ligera y de secado rápido.',
    codigo: 'ADV26-17-TW4B',
    condiciones: 'Hasta fin de existencias. Una unidad por socio.',
    caducidad: '2027-01-31',
    ilustracion: 'regalo',
  },
  {
    dia: 18,
    titulo: 'Clase de aquagym gratuita',
    descripcion: 'Entrena sin impacto en el agua con una clase de aquagym. ¡Diversión garantizada!',
    codigo: 'ADV26-18-AQ6C',
    condiciones: 'Válido en centros con piscina. Imprescindible gorro de baño.',
    caducidad: '2027-01-31',
    ilustracion: 'ticket',
  },
  {
    dia: 19,
    titulo: 'Consulta inicial de nutrición',
    descripcion: '30 minutos con nuestro equipo de nutrición para revisar tus hábitos y preparar el nuevo año.',
    codigo: 'ADV26-19-NU3J',
    condiciones: 'Cita previa. Consulta orientativa, no sustituye el consejo médico.',
    caducidad: '2027-02-28',
    ilustracion: 'botella',
  },
  {
    dia: 20,
    titulo: 'Desayuno saludable gratis',
    descripcion: 'Tostada integral, fruta de temporada y café o zumo natural en la cafetería del club.',
    codigo: 'ADV26-20-DS7Y',
    condiciones: 'Válido de lunes a viernes hasta las 11:00 en centros con cafetería.',
    caducidad: '2027-01-31',
    ilustracion: 'taza',
  },
  {
    dia: 21,
    titulo: 'Entrenamiento personal en pareja',
    descripcion: 'Una sesión de entrenamiento personal para dos personas al precio de una. Ven con tu pareja, amigo o familiar.',
    codigo: 'ADV26-21-PP5E',
    condiciones: 'Al menos una de las dos personas debe ser socia. Cita previa.',
    caducidad: '2027-02-15',
    ilustracion: 'silbato',
  },
  {
    dia: 22,
    titulo: '25 % en zapatillas de running',
    descripcion: 'Prepárate para la San Silvestre con un 25 % de descuento en zapatillas de running de la tienda.',
    codigo: 'ADV26-22-ZR9U',
    condiciones: 'Hasta fin de existencias. No aplicable a artículos ya rebajados.',
    caducidad: '2027-01-15',
    ilustracion: 'zapatilla',
  },
  {
    dia: 23,
    titulo: 'Circuito termal para dos',
    descripcion: 'Disfruta del spa en buena compañía: acceso de 90 minutos para ti y un acompañante.',
    codigo: 'ADV26-23-SD4A',
    condiciones: 'Válido en centros con spa. Reserva previa para ambas personas.',
    caducidad: '2027-02-28',
    ilustracion: 'spa',
  },
  {
    dia: 24,
    titulo: '¡Gran regalo de Nochebuena: enero al 50 %!',
    descripcion: 'Nuestro regalo más especial: la mitad de tu cuota de enero corre de nuestra cuenta. ¡Felices fiestas!',
    codigo: 'ADV26-24-NB8Z',
    condiciones: 'Aplicable a cuotas mensuales individuales. No acumulable con el premio del día 1.',
    caducidad: '2026-12-31',
    ilustracion: 'estrella',
  },
];

/** Devuelve el premio de un día concreto. */
export function premioDelDia(dia) {
  return PREMIOS.find((p) => p.dia === dia) || null;
}
