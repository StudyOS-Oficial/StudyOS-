# StudyOS — entrega privada d'eBooks V2

## Estat
- Worker en branca de proves; no desplegat ni validat en producció.
- `PAYMENTS_ENABLED=false`.
- No activar vendes reals fins que el flux complet passi les proves.

## Flux actual
1. Stripe Payment Link obre Checkout.
2. Després d'un pagament confirmat, Stripe redirigeix a `/thanks?session_id={CHECKOUT_SESSION_ID}`.
3. El Worker consulta la Checkout Session directament a Stripe i comprova que `payment_status=paid`.
4. El Worker comprova que el Payment Link és un dels quatre productes autoritzats.
5. Es crea l'entitlement de compra a KV i una sessió privada HttpOnly de 14 dies.
6. El comprador veu una pàgina de compra confirmada amb els PDFs disponibles.
7. Els PDFs i HTML es serveixen només després de validar la sessió i l'entitlement.
8. El webhook Stripe manté la conciliació automàtica i repeteix el mateix procés de concessió de manera idempotent.

Aquesta V2 no depèn de Resend ni de correu electrònic.

## Recursos
- GitHub Pages: web pública i mostres.
- Cloudflare Worker: verificació Stripe i entrega privada.
- Cloudflare KV: compres i sessions temporals.
- Cloudflare R2: PDFs/HTML complets privats.
- Stripe Payment Links: cobrament per transacció.

## Configuració pendent
1. Posar a `wrangler.toml` l'ID real del namespace KV `studyos-access`.
2. Confirmar que el bucket R2 privat és `studyos-private-docs` i sense public access.
3. Preparar i pujar els sis fitxers finals:
   - `ebooks/ebook-1.pdf` i `ebooks/ebook-1.html`
   - `ebooks/ebook-2.pdf` i `ebooks/ebook-2.html`
   - `ebooks/ebook-3.pdf` i `ebooks/ebook-3.html`
4. Configurar fora de Git els secrets necessaris del Worker: clau secreta de Stripe i secret de signatura del webhook.
5. Configurar el webhook Stripe a `/stripe-webhook` per `checkout.session.completed` i `checkout.session.async_payment_succeeded`.
6. Configurar el redirect de cada Payment Link cap a l'URL del Worker amb `{CHECKOUT_SESSION_ID}`. Fer-ho només quan el Worker estigui desplegat i provat.
7. Mantenir `PAYMENTS_ENABLED=false` durant totes les proves.
8. Provar salut, pagament confirmat, pagament no confirmat, Payment Link no autoritzat, duplicats del webhook, sessió caducada, accés a un eBook no comprat i fitxer absent.
9. Provar cada producte individual i el pack.
10. Afegir i provar revocació per reemborsament/disputa abans de vendre en real.
11. Revisar obligacions legals i fiscals de venda digital a Espanya/UE.
12. Només quan tot passi, activar el flux real i els botons públics.

## Seguretat
- Els eBooks complets no van al repositori públic.
- R2 no ha de tenir accés públic.
- Els PDFs requereixen sessió HttpOnly i entitlement.
- La signatura del webhook es verifica abans de processar-lo.
- La Checkout Session es valida servidor-side amb Stripe; no es confia en el preu ni en el producte enviats pel navegador.
- No es guarden claus secretes al repositori.

## Proves
Quan tinguem l'ID real del KV, els fitxers finals i les secrets configurades, es pot desplegar una versió de prova amb els pagaments desactivats i executar una bateria end-to-end. No s'ha de fer cap venda real abans d'aquesta validació.
