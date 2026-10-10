/* StudyOS · Stripe Payment Links (pago único).
 * Nunca publiques claves secretas en este repositorio.
 * Los enlaces de eBooks y pack existen en Stripe Live; el de StudyOS+ aún no está configurado.
 * Mantener enabled=false y deliveryReady=false hasta desplegar y probar el backend,
 * verificar el dominio de correo, cargar los PDF en almacenamiento privado y publicar condiciones.
 */
window.STUDYOS_PAYMENTS = {
  enabled: false,
  deliveryReady: false,
  links: {
    ebook1: 'https://buy.stripe.com/aFa9AV3tX7nc63i0EA1VK02', // Tu Nueva Versión · 2,99 €
    ebook2: 'https://buy.stripe.com/3cI7sN0hL9vkbnCbje1VK03', // Pre-Daily OS · 2,99 €
    ebook3: 'https://buy.stripe.com/eVqdRb7Kd0YOfDS3QM1VK04', // Ayuno OS · 2,99 €
    plus: '', // StudyOS+ · 7,99 € (pendiente de enlace y condiciones)
    pack: 'https://buy.stripe.com/eVqbJ38Oh5f4dvKbje1VK05' // Pack completo · 12,99 €
  }
};
