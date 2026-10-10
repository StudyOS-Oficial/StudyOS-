# StudyOS — entrega privada d'eBooks V1

## Estat actual
- Aquest Worker és una base de treball, encara no desplegada ni validada en producció.
- Els pagaments estan desactivats per defecte: PAYMENTS_ENABLED=false.
- No s'hi han afegit claus secretes.
- No activis cobraments fins que tots els passos de la checklist estiguin completats.

## Arquitectura amb objectiu de 0 € de quota fixa mensual
- GitHub Pages: web pública i mostres.
- Cloudflare Worker: webhook Stripe, accés per correu i endpoints protegits de lectura/descàrrega.
- Cloudflare KV: drets de compra, tokens temporals i sessions.
- Cloudflare R2: PDFs i HTML complets, amb accés privat.
- Resend: envia l'enllaç d'accés; cal verificar el domini remitent.
- Stripe Payment Links: cobra la compra i aplica comissions per transacció.

Els plans gratuïts tenen límits i no garanteixen cost zero amb qualsevol volum. Revisa els límits dels teus comptes.

## Configuració pendent
1. Crear un KV namespace a Cloudflare i substituir l'ID a wrangler.toml.
2. Crear el bucket privat R2 studyos-private-docs. No activar public access ni domini públic.
3. Preparar i pujar al bucket els sis fitxers finals:
   - ebooks/ebook-1.pdf i ebooks/ebook-1.html
   - ebooks/ebook-2.pdf i ebooks/ebook-2.html
   - ebooks/ebook-3.pdf i ebooks/ebook-3.html
4. Configurar com a secrets del Worker STRIPE_WEBHOOK_SECRET i RESEND_API_KEY.
5. Verificar el domini remitent amb Resend i establir MAIL_FROM al domini verificat.
6. Substituir BASE_URL per l'URL real del Worker.
7. Substituir STRIPE_LINK_EBOOK1, STRIPE_LINK_EBOOK2, STRIPE_LINK_EBOOK3 i STRIPE_LINK_PACK pels IDs reals de Payment Link (plink_...). Verificar producte i import a Stripe. Les URL buy.stripe.com existents no són aquests IDs.
8. Configurar Stripe webhook POST /stripe-webhook per checkout.session.completed i checkout.session.async_payment_succeeded.
9. Desplegar amb PAYMENTS_ENABLED=false i provar /health, webhook signat, email, login, sessió, lectura HTML i PDF.
10. Provar que cada compra individual només dona accés a un eBook i el pack als tres.
11. Provar pagament incomplet, esdeveniment duplicat, email invàlid, enllaç caducat, sessió tancada i fitxer absent.
12. Afegir i provar revocació d'accés per reemborsament/disputa abans d'acceptar vendes reals.
13. Revisar les obligacions legals i fiscals de venda digital a Espanya/UE.
14. Només quan tot passi, activar PAYMENTS_ENABLED=true al panell del Worker. No activar els botons públics abans d'això.

## Seguretat del contingut
Els PDF i els HTML premium no poden estar al repositori públic ni en URLs públiques. Els HTML han de ser responsius i autocontinguts. Els eBooks complets no són en aquest canvi: cal preparar-los i revisar-los abans de vendre. StudyOS+ no està inclòs en aquesta primera versió perquè encara cal definir-ne l'abast, durada i enllaç de pagament.

## Proves locals
Amb Wrangler configurat amb bindings locals de prova, executar npx wrangler dev. No desar secrets reals en fitxers versionats.
