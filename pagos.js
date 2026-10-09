/* StudyOS V6 · Stripe Payment Links (pago único).
 * Estos enlaces son públicos; NUNCA publiques claves secretas de Stripe.
 * IMPORTANTE: las 4 URLs se han introducido sin cambiar sus precios en Stripe.
 * Verifica en tu panel que cobran los importes publicados en la web.
 * Habilita enabled y deliveryReady solo cuando la entrega privada esté
 * implementada y comprobada y las condiciones de StudyOS+ estén publicadas.
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
