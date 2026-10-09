/* STUDYOS V6 · Configuración de Stripe Payment Links públicos. */
/* Nunca pegues claves secretas de Stripe en GitHub Pages. */
/* PASOS: crea 5 enlaces distintos (pago único). Pega las URLs buy.stripe.com aquí. */
/* Activa enabled=true y deliveryReady=true SOLO cuando la entrega y los accesos
   privados estén implementados y se hayan probado con compras de prueba. */
window.STUDYOS_PAYMENTS = {
  enabled: false,
  deliveryReady: false,
  links: {
    ebook1: '', // Tu Nueva Versión · 5,99 €
    ebook2: '', // Pre-Daily OS · 5,99 €
    ebook3: '', // Ayuno OS · 5,99 €
    plus: '',   // StudyOS+ · 7,99 € (duración de acceso por definir)
    pack: ''    // StudyOS Complete · 14,99 € (3 eBooks + StudyOS+)
  }
};
