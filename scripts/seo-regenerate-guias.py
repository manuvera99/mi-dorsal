#!/usr/bin/env python3
"""Regenera lib/guias/content.ts con las 9 guías completas, encoding UTF-8 correcto.
Esto arregla el archivo tras los problemas de encoding en PowerShell."""

GUIAS = [
  # =====================================================================
  # 1. ES LEGAL VENDER UN DORSAL
  # =====================================================================
  {
    "slug": "es-legal-vender-dorsal",
    "intent": "informational",
    "title": "¿Es legal vender un dorsal en España? Lo que dice la ley y la normativa de cada carrera",
    "metaDescription":
      "Vender un dorsal en España es legal si el organizador lo permite. Te explicamos el marco legal, las excepciones y qué mirar en el reglamento de cada carrera antes de publicar.",
    "intro":
      "Sí, vender un dorsal en España es legal en la mayoría de los casos. La ley no prohíbe la cesión entre particulares, pero cada organizador tiene sus propias reglas. Si tu dorsal no es transferible según el reglamento, venderlo puede acarrearte la descalificación y la pérdida del dorsal para siempre. Esta guía cubre el marco legal general y los límites prácticos que debes respetar.",
    "sections": [
      {
        "heading": "Qué dice la ley española",
        "paragraphs": [
          "En España no existe una ley específica que prohíba vender o comprar dorsales entre particulares. La cesión de una inscripción es, en general, un acto privado entre dos personas, parecido a vender una entrada de un evento a un tercero.",
          "Donde sí hay regulación clara es en la Ley del Deporte y en la normativa de la Real Federación Española de Atletismo (RFEA) y las federaciones autonómicas. Las carreras federadas o homologadas suelen exigir que el dorsal lo lleve el titular inscrito oficialmente. Si esto no se respeta, el organizador puede descalificar al corredor que corre con un dorsal ajeno.",
        ],
        "bullets": [
          "Vender entre particulares es legal como acto privado.",
          "Correr con un dorsal que no es tuyo puede ser sancionado por el organizador (descalificación, expulsión del evento).",
          "Si la carrera está federada, además puede haber consecuencias deportivas (sanción federativa, pérdida de licencia).",
        ],
      },
      {
        "heading": "Qué dice el organizador de cada carrera",
        "paragraphs": [
          "Cada organizador decide en su reglamento si el dorsal es transferible, cesible, nominativo o intransferible. Esta es la parte que más importa en la práctica.",
          "Las carreras grandes (Valencia, Madrid, Sevilla, Barcelona) suelen permitir el cambio de titularidad dentro de un plazo concreto, cobrando una pequeña tarifa administrativa. Algunas exigen que el corredor original justifique lesión o causa mayor. Otras no permiten ningún tipo de cambio.",
          "Las carreras populares locales, las san silvestres y muchos 10K no tienen sistema oficial de cambio: en estos casos vender el dorsal funciona de facto, pero implica el riesgo de que el organizador detecte el cambio y no te devuelva el dinero si hay reclamación.",
        ],
      },
      {
        "heading": "Riesgos reales de vender un dorsal no transferible",
        "paragraphs": [
          "El riesgo no es legal (no vas a ir a la cárcel por vender un dorsal), sino operativo y de reputación:",
        ],
        "bullets": [
          "Descalificación del comprador si el organizador detecta el cambio.",
          "Pérdida del dorsal para futuras ediciones si el organizador te identifica.",
          "Reembolso denegado en caso de cancelación si el dorsal está a nombre de otra persona.",
          "Estafas: que el comprador no pague, o que el organizador comparta tus datos con el titular original.",
        ],
      },
      {
        "heading": "Cómo saber si tu dorsal es transferible",
        "paragraphs": [
          "Antes de publicar un anuncio, busca el reglamento de la carrera. Suele estar en la web oficial, en un PDF descargable.",
          "Tres preguntas clave:",
        ],
        "bullets": [
          "¿El dorsal es nominativo? (es decir, ¿está ligado a tu DNI?)",
          "¿El organizador permite cambio de titularidad? ¿Dentro de qué plazo y con qué coste?",
          "¿Hay algún formulario oficial para solicitar el cambio?",
        ],
        "paragraphs_2": [
          "Si la respuesta a las tres preguntas es «sí, sí y sí», el camino más seguro es hacer el cambio oficial a través del organizador, aunque cueste algo más. Si no, vender de particular a particular sigue siendo el camino más rápido y usado en España, asumiendo los riesgos descritos.",
        ],
      },
    ],
    "faq": [
      {"question": "¿Me pueden sancionar por vender un dorsal?", "answer": "La venta entre particulares no está penada por la ley. Lo que sí puede ocurrir es que el organizador descalifique al comprador en meta y, en carreras federadas, se apliquen sanciones deportivas internas."},
      {"question": "¿Y si la carrera es federada?", "answer": "Las carreras federadas suelen exigir identidad del corredor. Si cambias el dorsal sin avisar, puedes ser descalificado y, en casos extremos, recibir sanción federativa."},
      {"question": "¿Quién se hace responsable si el comprador tiene un accidente corriendo con mi dorsal?", "answer": "El seguro del evento está vinculado al titular inscrito. Si hay un accidente y la persona no es la inscrita oficialmente, la aseguradora puede no cubrirlo. Este es uno de los motivos por los que se recomienda siempre hacer el cambio oficial cuando el organizador lo permite."},
      {"question": "¿Puedo vender el dorsal aunque diga «no transferible»?", "answer": "Técnicamente sí. Operativamente, asumes los riesgos de que el comprador sea descalificado o de que el organizador no te devuelva el dinero si cancelan la prueba. Decide con esa información."},
    ],
    "ctaTitle": "¿Tienes un dorsal y no puedes correr?",
    "ctaDescription": "Publícalo gratis en 3 minutos y llega a corredores que buscan exactamente tu carrera. Sin comisión.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Publicar dorsal gratis",
    "ctaSecondaryHref": "/carreras",
    "ctaSecondaryLabel": "Ver carreras disponibles",
  },

  # =====================================================================
  # 2. COMO TRANSFERIR UN DORSAL
  # =====================================================================
  {
    "slug": "como-transferir-dorsal",
    "intent": "transactional",
    "title": "Cómo transferir un dorsal de una carrera: el proceso real paso a paso",
    "metaDescription": "Transferir un dorsal no es solo cambiar un nombre. Te explicamos qué plazos, costes y formularios piden los organizadores para hacer el cambio oficial.",
    "intro": "Si tu dorsal es transferible según el reglamento, el camino más seguro es hacer el cambio oficial a través del organizador. Esto evita descalificaciones, problemas de seguro y malentendidos con el comprador. Esta guía te lleva por los pasos reales que aplican la mayoría de carreras populares en España.",
    "sections": [
      {"heading": "Paso 1 — Comprueba el reglamento", "paragraphs": ["Antes de cualquier cosa, lee el reglamento de la carrera. Las preguntas que tienes que responder son:"], "bullets": ["¿Permite cambio de titular? (suele estar en la sección «Inscripciones» o «Reglamento»).", "¿Dentro de qué plazo? (la mayoría cierra el cambio 7–15 días antes de la carrera).", "¿Qué coste tiene? (los hay gratuitos, pero los grandes cobran 5–25 €).", "¿Hay qué procedés un formulario específico o se hace por email?"]},
      {"heading": "Paso 2 — Consigue los datos del comprador", "paragraphs": ["El organizador suele pedir: nombre completo, DNI/NIE, fecha de nacimiento, talla de camiseta (si la inscripción incluye), email de contacto y, en carreras federadas, número de licencia.", "Ten estos datos antes antes de iniciar el trámite. Si tu comprador cambia de idea a mitad del proceso, el organizador te cobra igual los gastos administrativos."]},
      {"heading": "Paso 3 — Solicita el cambio oficial", "paragraphs": ["El proceso varía. Tres patrones comunes:"], "bullets": ["Online desde tu perfil de usuario: algunos organizadores tienen un botón «transferir mi dorsal» que envía un email al comprador para que confirme sus datos.", "Email a la organización: envías un email con tus datos + los del comprador + una foto de tu DNI + foto del dorsal. Algunos cobran por adelantado.", "Formulario específico en PDF: para carreras grandes. Hay que rellenarlo, firmarlo, y enviarlo por email."]},
      {"heading": "Paso 4 — Pago entre particulares", "paragraphs": ["El cambio oficial con el organizador no implica dinero entre tú y el comprador. Eso lo cerráis aparte, por el canal que prefiráis (Bizum, transferencia, PayPal).", "Consejo: cobra al comprador después de que el organizador confirme el cambio, no antes. Así tienes garantía de que el trámite se ha hecho."]},
      {"heading": "Errores comunes que conviene evitar", "paragraphs": ["Hacer el cambio fuera de plazo: pierdes el dorsal y el dinero.", "No notificar al organizador: si el comprador corre con un dorsal que sigue a tu nombre y hay un incidente, te puede salpicar a ti.", "Olvidar cambiar el seguro: algunas carreras incluyen seguro vinculado al titular; el cambio de nombre implica también cambio de póliza."]},
    ],
    "faq": [
      {"question": "¿Cuánto cobra un organizador por cambiar el titular?", "answer": "Depende. Las grandes (Valencia, Madrid, Sevilla) cobran entre 5 y 25 € por gastos de gestión. Las populares locales suelen ser gratuitas o cobrar 5–10 €."},
      {"question": "¿Puedo transferir a alguien que no conozco?", "answer": "Sí, pero el organizador no te lo va a poner fácil. Te pedirán los datos del comprador (DNI, fecha de nacimiento) y normalmente tienen que coincidir con los que se inscribieron. Algunos organizadores limitan los cambios a familiares o amigos."},
      {"question": "¿Qué pasa si el organizador rechaza el cambio?", "answer": "Si has pagado al comprador antes de que se confirme el cambio y luego lo rechazan, tienes un problema. Por eso se cobra siempre después de la confirmación oficial."},
    ],
    "ctaTitle": "Encuentra dorsal para tu próxima carrera",
    "ctaDescription": "Catálogo actualizado a diario con dorsales de particulares para las carreras más populares de España.",
    "ctaPrimaryHref": "/carreras",
    "ctaPrimaryLabel": "Buscar dorsales",
    "ctaSecondaryHref": "/publicar",
    "ctaSecondaryLabel": "Vender el mío",
  },

  # =====================================================================
  # 3. QUE PASA SI NO PUEDO CORRER
  # =====================================================================
  {
    "slug": "que-pasa-si-no-puedo-correr",
    "intent": "informational",
    "title": "Qué hacer si no puedes correr una carrera a última hora",
    "metaDescription": "Te has lesionado o no puedes correr la carrera que pagaste. Tienes más opciones de las que crees: transferir, vender, ceder a un club, esperar al reembolso. Te las ordenamos.",
    "intro": "No poder correr una carrera en la que llevas semanas (o meses) apuntado es un palo. Pero tienes opciones reales, ordenadas por urgencia y por viabilidad. La clave es actuar rápido: cuanto antes contactes con el organizador, más opciones tendrás.",
    "sections": [
      {"heading": "Lo primero: lee el reglamento de la carrera", "paragraphs": ["Cada organizador tiene políticas distintas para imprevistos. Antes de hacer nada, busca en su web:"], "bullets": ["Política de cancelación y reembolso (suele distinguir entre lesión, causa mayor y desistimiento).", "Plazo máximo para solicitar cambio de titular.", "Si hay opción de aplazar la inscripción a la edición siguiente.", "Si aceptan cesión a un club o a un tercero con justificación."]},
      {"heading": "Opción 1 — Transferir a otra persona (la más común)", "paragraphs": ["Si el organizador permite cambio de titular y estás dentro del plazo, esta es la opción más limpia. El comprador corre oficialmente con tu dorsal y tú recuperas el dinero (menos los gastos de gestión del organizador)."], "bullets": ["Ventaja: rápido, sin riesgos legales, el organizador acepta el cambio.", "Riesgo: tienes que encontrar comprador willing a correr y dispuesto a pagar lo que te costó (o menos).", "Plazo típico: hasta 7–15 días antes de la carrera."]},
      {"heading": "Opción 2 — Vender a un particular (la más rápida)", "paragraphs": ["Si no hay cambio oficial de titular o el plazo ya pasó, venderlo de particular a particular sigue siendo la opción más usada. Asume los riesgos descritos en la guía de legalidad, pero es lo que funciona en la práctica."], "bullets": ["Ventaja: cierras en 24–48 h si publicas en un marketplace con buen tráfico.", "Riesgo: posible descalificación del comprador si el organizador detecta el cambio.", "Consejo: queda con el comprador en un sitio público, cobra por Bizum y entrega el dorsal en mano."]},
      {"heading": "Opción 3 — Solicitar reembolso al organizador", "paragraphs": ["Solo algunos organizadores reembolsan, y siempre con condiciones. Lo habitual:"], "bullets": ["Lesión acreditada con informe médico: reembolso del 50–80 % del importe.", "Cancelación por causa mayor propia (viaje, laboral): depende del organizador, lo más habitual es que no reembolsen.", "Cancelación de la prueba por el organizador: reembolso completo sí o sí (es tu derecho)."]},
      {"heading": "Opción 4 — Ceder a un club o a una causa solidaria", "paragraphs": ["Algunas carreras tienen acuerdos con clubes o asociaciones. Si donas tu dorsal a una causa solidaria (por ejemplo, una carrera benéfica para niños con cáncer), puedes recuperar parte del dinero y ayudar a alguien. No es lo más rápido, pero es una opción real para dorsales caros."]},
    ],
    "faq": [
      {"question": "¿Cuánto se pierde si vendo el dorsal en lugar de transferirlo?", "answer": "Si lo transfieres oficialmente al comprador, pierdes solo los gastos de gestión del organizador (0–25 €). Si lo vendes a un particular, el precio suele ser 30–60 % del valor original dependiendo de la prueba."},
      {"question": "¿Puedo perder todo el dinero si cancelan la prueba?", "answer": "Si el organizador cancela, tienes derecho al reembolso completo. Si cancelas tú por una causa no contemplada, dependerás de la política del organizador."},
    ],
    "ctaTitle": "Publica tu dorsal en menos de 3 minutos",
    "ctaDescription": "Llega a corredores que buscan tu carrera. Publicación gratis, sin comisión, mensajes internos protegidos.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Publicar gratis",
    "ctaSecondaryHref": "/como-funciona",
    "ctaSecondaryLabel": "Cómo funciona",
  },

  # =====================================================================
  # 4. CAMBIO TITULAR MARATON GRANDES
  # =====================================================================
  {
    "slug": "como-cambiar-titular-dorsal-maraton",
    "intent": "transactional",
    "title": "Cambio de titular en maratones grandes (Valencia, Madrid, Sevilla, Barcelona): guía práctica",
    "metaDescription": "Cada gran maratón tiene su propio proceso. Comparativa práctica con plazos, costes y enlaces oficiales para no perder tiempo ni dinero.",
    "intro": "Las cuatro grandes maratones de España (Valencia, Madrid, Sevilla y Barcelona) son las que más búsquedas de cambio de titular reciben. Esta guía resume los procesos reales de cada una para que sepas qué hacer antes de iniciar el trámite.",
    "sections": [
      {"heading": "Marathon Valencia Trinidad Alfonso", "paragraphs": ["El maratón más grande de España. Permite cambio de titular dentro de un plazo cerrado."], "bullets": ["Plazo: hasta 15 días antes de la carrera (varía según edición, consulta la web oficial).", "Coste: gratuito o 10 € por gastos de gestión.", "Cómo: online desde tu perfil de perfil de corredor en la web oficial.", "Documentación: nombre completo + DNI + fecha de nacimiento del nuevo titular."], "paragraphs_2": ["Más info en la web oficial del Maratón Valencia."]},
      {"heading": "Rock'n'Roll Madrid Maratón & 1/2", "paragraphs": ["Otra de las grandes. Permite cambio de titular dentro de plazo."], "bullets": ["Plazo: hasta 10–14 días antes de la carrera.", "Coste: 10–15 € por gastos de gestión.", "Cómo: online desde el perfil del corredor.", "Documentación: los mismos datos que en Valencia."]},
      {"heading": "Zurich Maratón Sevilla", "paragraphs": ["Una de las que más rápido agota dorsales. El proceso de titular está bien documentado."], "bullets": ["Plazo: hasta 15 días antes.", "Coste: 10 €.", "Cómo: a través del perfil del corredor o por email a la organización."]},
      {"heading": "Zurich Maratón Barcelona", "paragraphs": ["La más internacional. Cambio de titular posible."], "bullets": ["Plazo: hasta 10 días antes.", "Coste: 15–20 €.", "Cómo: a través del perfil del corredor."]},
    ],
    "faq": [
      {"question": "¿Cuánto tarda en confirmarse el cambio?", "answer": "Entre 24 horas y 7 días dependiendo del organizador. Las grandes suelen confirmar en 48–72 h si todo está correcto."},
      {"question": "¿Y si ya he pagado al comprador y el organizador rechaza?", "answer": "Por eso se cobra siempre después de la confirmación oficial. Si ya has pagado, asume que pierdes el dinero o negocia la devolución con el comprador."},
    ],
    "ctaTitle": "Encuentra dorsales para las grandes maratones",
    "ctaDescription": "Catálogo con dorsales disponibles para Valencia, Madrid, Sevilla y Barcelona. Publica o busca en 3 minutos.",
    "ctaPrimaryHref": "/carreras",
    "ctaPrimaryLabel": "Ver dorsales",
    "ctaSecondaryHref": "/publicar",
    "ctaSecondaryLabel": "Vender el mío",
  },

  # =====================================================================
  # 5. PLAZOS CAMBIO TITULARIDAD
  # =====================================================================
  {
    "slug": "plazo-cambio-titularidad-carrera",
    "intent": "informational",
    "title": "Plazos reales de cambio de titularidad en carreras populares",
    "metaDescription": "Por qué dejar el cambio para el final te puede dejar sin dorsal. Comparativa de plazos entre los principales organizadores.",
    "intro": "Los plazos de cambio de titular varían enormemente. Algunos organizadores lo cierran un mes antes, otros 48 horas antes. Esta guía resume los plazos típicos para que no te pille el toro.",
    "sections": [
      {"heading": "Por qué el plazo importa", "paragraphs": ["Si te pasas del plazo, ya no puedes cambiar el titular. Tendrás que venderlo de particular a particular (asumiendo los riesgos) o perder el dinero.", "Lo más recomendable: inicia el trámite en cuanto sepas que no puedes correr. No lo dejes para el final."]},
      {"heading": "Plazos típicos por distancia", "paragraphs": ["Los plazos cambian según el tipo de prueba."], "bullets": ["Maratones y grandes pruebas: 10–15 días antes.", "10K populares: 5–7 días antes.", "San Silvestres y pruebas navideñas: 7–10 días antes.", "Carreras locales pequeñas: 3–5 días antes, si es que admiten cambios.", "Carreras con dorsal nominativo: hay algunas que permiten cambio hasta 24 h antes por teléfono."]},
      {"heading": "Cómo no perder el plazo", "paragraphs": ["Tres consejos prácticos:"], "bullets": ["Apunta en tu calendario la fecha «límite cambio titular» en cuanto te inscribas.", "Lee el reglamento antes de inscribirte: si ves que el plazo es muy corto, plantéate un seguro de cancelación (hay corredores que contratan uno con su aseguradora de viajes).", "Si te lesionas, contacta con el organizador el mismo día: en muchos casos, presentar el parte médico dentro de las 72 h siguientes te abre opciones de reembolso parcial o cambio de titular sin coste."]},
    ],
    "faq": [
      {"question": "¿Y si el plazo ya ha pasado?", "answer": "Solo te queda vender a un particular (asumiendo riesgos) o perder el dinero. Algunos organizadores tienen políticas de devolución para lesionados incluso fuera de plazo, pero son excepciones."},
    ],
    "ctaTitle": "Encuentra dorsal antes de que se agote el plazo",
    "ctaDescription": "Catálogo actualizado a diario con dorsales disponibles para las carreras populares de España.",
    "ctaPrimaryHref": "/carreras",
    "ctaPrimaryLabel": "Buscar dorsales",
    "ctaSecondaryHref": "/publicar",
    "ctaSecondaryLabel": "Publicar el mío",
  },

  # =====================================================================
  # 6. COMO VENDER DORSAL RAPIDO
  # =====================================================================
  {
    "slug": "como-vender-dorsal-rapido",
    "intent": "transactional",
    "title": "Cómo vender tu dorsal rápido y sin riesgos: 7 pasos verificados",
    "metaDescription": "7 pasos prácticos para colocar tu dorsal en 48 horas sin caer en estafas. Lo que funciona de verdad en España.",
    "intro": "Vender un dorsal rápido es posible si actúas con método. Estos 7 pasos son los que funcionan en la práctica, ordenados de lo más importante a lo menos.",
    "sections": [
      {"heading": "Paso 1 — Define tu precio mínimo", "paragraphs": ["Antes de publicar, decide cuánto estás dispuesto a aceptar. Una regla orientativa:"], "bullets": ["Si la carrera está agotada y faltan más de 2 semanas: cobra el 80–100 % del precio original.", "Si la carrera está agotada y faltan 1–7 días: cobra el 50–70 %.", "Si faltan menos de 48 h: cobra el 30–50 % (es difícil colocar)."]},
      {"heading": "Paso 2 — Publica en 2–3 sitios a la vez", "paragraphs": ["Maximiza alcance. Los tres canales que mejor funcionan para dorsales en España:"], "bullets": ["Marketplace especializado (mi-dorsal.es): tráfico segmentado, compradores con intención clara.", "Grupos de Facebook de running: gratis, alto tráfico, pero requiere que respondas rápido.", "Wallapop o Milanuncios: llegan a gente que ya busca, pero también hay más gente que regatea para abajo."]},
      {"heading": "Paso 3 — Foto y descripción que venden", "paragraphs": ["Una buena descripción multiplica por 3 las respuestas. Incluye:"], "bullets": ["Nombre exacto de la carrera, fecha y lugar.", "Dorsal asignado (si lo tienes) o distancia (5K/10K/maratón).", "Talla de camiseta si la inscripción incluye.", "Hora de salida y lugar de recogida de dorsal.", "Si es transferible oficialmente: dílo (es un plus de confianza)."]},
      {"heading": "Paso 4 — Responde en menos de 30 minutos", "paragraphs": ["El que responde primero cierra la venta. Si ves un mensaje en un grupo de Facebook y no respondes en 30 minutos, ya hay otros 5 vendedores escribiendo lo mismo."]},
      {"heading": "Paso 5 — Pide Bizum o transferencia antes de entregar", "paragraphs": ["Bizum al instante, con confirmación de nombre. Evita PayPal (comisiones) y evita pagos en mano sin Bizum (no tienes prueba)."]},
      {"heading": "Paso 6 — Entrega en sitio público", "paragraphs": ["Cafetería, centro comercial, parada de metro. Nunca en tu casa. Si puedes, queda en una zona transitada y a plena luz del día."]},
      {"heading": "Paso 7 — Notifica el cambio al organizador", "paragraphs": ["Aunque el cambio no sea oficial, muchos organizadores aceptan una notificación por email. Es una garantía para ti y para el comprador."]},
    ],
    "faq": [
      {"question": "¿Cuánto tarda en venderse un dorsal?", "answer": "Depende de la carrera. Las grandes (Valencia, Behobia, San Silvestre) se venden en 24–48 h. Las locales, en 3–7 días."},
      {"question": "¿Cómo evito una estafa?", "answer": "Cobra siempre por Bizum o transferencia antes de entregar el dorsal. Si alguien insiste en pagar por otro método o te pide datos raros, desconfía."},
    ],
    "ctaTitle": "Publica tu dorsal gratis",
    "ctaDescription": "Llega a corredores buscando tu carrera. Sin comisión, sin intermediarios.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Publicar dorsal",
    "ctaSecondaryHref": "/como-funciona",
    "ctaSecondaryLabel": "Cómo funciona",
  },

  # =====================================================================
  # 7. DONDE VENDER DORSAL SEGUNDA MANO
  # =====================================================================
  {
    "slug": "donde-vender-dorsal-segunda-mano",
    "intent": "transactional",
    "title": "Dónde vender un dorsal de segunda mano de forma segura",
    "metaDescription": "Comparativa honesta de canales para vender tu dorsal: marketplaces especializados, Wallapop, Milanuncios y grupos de Facebook. Ventajas y riesgos reales de cada uno.",
    "intro": "Tienes cuatro opciones reales para vender un dorsal en España. Las comparamos en tiempo, comisión, seguridad y visibilidad para que elijas la que mejor te encaje.",
    "sections": [
      {"heading": "Opción 1 — Marketplace especializado (mi-dorsal.es)", "paragraphs": ["El más nuevo del mercado, pero el que más rápido crece. Está pensado específicamente para dorsales."], "bullets": ["Tiempo medio de venta: 24–48 h en carreras grandes.", "Comisión: gratis para vendedores.", "Seguridad: alta. Mensajería interna, perfiles verificados, sin compartir datos personales hasta cerrar.", "Visibilidad: alta para corredores que ya buscan dorsal."]},
      {"heading": "Opción 2 — Wallapop", "paragraphs": ["El marketplace de segunda mano más grande de España. Mucho tráfico general, no tanto de corredores."], "bullets": ["Tiempo medio: 3–7 días.", "Comisión: gratis para particulares.", "Seguridad: media. Sistema de valoraciones, pero los corredores novatos no siempre usan Wallapop.", "Visibilidad: alta en general, baja en específico."]},
      {"heading": "Opción 3 — Grupos de Facebook", "paragraphs": ["Hay grupos específicos para vender dorsales (ej. «Vendo dorsal X», «Cesión dorsales Madrid»). Mucha gente los usa."], "bullets": ["Tiempo medio: 1–3 días si el grupo está activo.", "Comisión: gratis.", "Seguridad: baja-media. Has de gestionar tú toda la conversación.", "Visibilidad: media-alta en grupos grandes."]},
      {"heading": "Opción 4 — Milanuncios", "paragraphs": ["El otro marketplace generalista español. Más veterano, menos tráfico que Wallapop."], "bullets": ["Tiempo medio: 5–10 días.", "Comisión: gratis.", "Seguridad: media-baja. Plataforma veterana pero con menos moderación."]},
    ],
    "faq": [
      {"question": "¿Cuál es la más rápida?", "answer": "Para carreras grandes, un marketplace especializado (mi-dorsal.es) cierra en 24–48 h. Para carreras locales, los grupos de Facebook suelen ir mejor."},
      {"question": "¿Cuál es la más segura?", "answer": "Un marketplace con mensajería interna y perfiles verificados. Wallapop también es razonablemente seguro."},
    ],
    "ctaTitle": "Publica gratis en 3 minutos",
    "ctaDescription": "Mensajería interna, sin comisión, perfiles verificados.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Publicar dorsal",
    "ctaSecondaryHref": "/comparativas/mi-dorsal-vs-wallapop",
    "ctaSecondaryLabel": "Comparar con Wallapop",
  },

  # =====================================================================
  # 8. VENDER DORSAL LESION
  # =====================================================================
  {
    "slug": "vender-dorsal-lesion",
    "intent": "informational",
    "title": "Vender un dorsal cuando te lesionas: cómo y cuándo",
    "metaDescription": "Te has lesionado y la carrera es en 2 semanas. Qué hacer para recuperar el máximo dinero y dejar todo en regla.",
    "intro": "Una lesión de corredor es una de las situaciones más estresantes que existen, sobre todo cuando te has apuntado a una prueba importante. Estos son los pasos que tienes que dar para no perder dinero y para no liar al organizador.",
    "sections": [
      {"heading": "Lo primero: ve al médico y pide informe", "paragraphs": ["Sin un parte médico no tienes nada. Cualquier solicitud de reembolso, cambio o venta argumentando lesión sin documento no se sostiene."]},
      {"heading": "Antes de los 7 días previos a la carrera", "paragraphs": ["Es el momento con más opciones. El organizador aún acepta cambios de titular oficiales."], "bullets": ["Contacta con el organizador y envía el parte médico.", "Solicita cambio de titular (más barato y seguro).", "Si no consigues comprador, vende a un particular en marketplace."]},
      {"heading": "7–2 días antes", "paragraphs": ["El plazo oficial de cambio suele estar cerrado. Solo te queda vender de particular a particular."], "bullets": ["Publica en marketplace con precio agresivo (50–60 % del valor original).", "Sé claro en la descripción: «vendo dorsal por lesión, no me interesa negociable»."]},
      {"heading": "Menos de 48 horas antes", "paragraphs": ["Casi imposible vender. mejor guardar el dorsal y mira si te sirve para la edición siguiente (algunos organizadores lo permiten para lesionados, casi ninguno de forma gratuita)."]},
      {"heading": "Después de la carrera: lecciones aprendidas", "paragraphs": ["Tres acciones para la próxima:"], "bullets": ["Apunta la fecha de lesión y calcula el coste de perder el dorsal.", "Contrata un seguro de cancelación (hay corredoras que lo incluyen en su póliza de salud).", "Lee el reglamento antes de inscribirte, no después."]},
    ],
    "faq": [
      {"question": "¿Y si la lesión es leve pero sigo pudiendo correr?", "answer": "Si sigues pudiendo correr (rodilla molesta, gemelo cargado), la decisión es tuya. Pero piensa en tu salud: una lesión leve se convierte en grave el día que la ignoras."},
    ],
    "ctaTitle": "Vende tu dorsal rápido por lesión",
    "ctaDescription": "Publicación gratis en 3 minutos. Llega a corredores que buscan tu carrera.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Publicar gratis",
    "ctaSecondaryHref": "/guias/es-legal-vender-dorsal",
    "ctaSecondaryLabel": "¿Es legal?",
  },

  # =====================================================================
  # 9. COMPARATIVA MARKETPLACES
  # =====================================================================
  {
    "slug": "comparativa-marketplaces-dorsales",
    "intent": "transactional",
    "title": "Comparativa de marketplaces para vender dorsales en España",
    "metaDescription": "Tabla con comisiones, seguridad, tiempo medio de venta y visibilidad para 6 plataformas activas en España.",
    "intro": "Hay al menos 6 canales donde puedes vender un dorsal en España. Esta tabla los compara en lo que importa de verdad: tiempo, comisión, perfil del comprador.",
    "sections": [
      {"heading": "Tabla comparativa", "paragraphs": ["Resumen rápido. Para detalle, mira cada guía específica."], "bullets": ["mi-dorsal.es: gratis, 24–48 h, segmentado, alta seguridad.", "Wallapop: gratis, 3–7 días, general, media seguridad.", "Milanuncios: gratis, 5–10 días, general, media-baja seguridad.", "Facebook grupos: gratis, 1–3 días, segmentado, baja-media seguridad.", "Foroatletismo: gratis, 7–15 días, muy segmentado, baja seguridad.", "Instagram: gratis, variable, visual, baja-media seguridad."]},
      {"heading": "Qué canal elegir", "paragraphs": ["Depende de la carrera:"], "bullets": ["Carrera grande (Valencia, Behobia, San Silvestre): mi-dorsal.es + grupos grandes de Facebook.", "Carrera popular media: Wallapop + mi-dorsal.es.", "Carrera local pequeña: grupos de Facebook regionales + Foroatletismo."]},
    ],
    "faq": [
      {"question": "¿Cuál cobra menos comisión?", "answer": "Todos los listados son gratis para vendedores. La diferencia está en la velocidad de venta y en la calidad del comprador."},
      {"question": "¿Y para comprar un dorsal?", "answer": "Las mismas plataformas pero en sentido contrario. El marketplace especializado es el más seguro porque los vendedores están verificados y la mensajería es interna."},
    ],
    "ctaTitle": "Prueba mi-dorsal gratis",
    "ctaDescription": "Sin comisión, con mensajería interna y perfiles verificados. La opción más rápida para vender o comprar dorsales en España.",
    "ctaPrimaryHref": "/publicar",
    "ctaPrimaryLabel": "Vender mi dorsal",
    "ctaSecondaryHref": "/carreras",
    "ctaSecondaryLabel": "Buscar dorsales",
  },
]


def render_section(s):
    lines = ["      {"]
    lines.append(f'        heading: {json.dumps(s["heading"], ensure_ascii=False)},')
    # Fusionar paragraphs y paragraphs_2 en una sola lista
    paragraphs = list(s.get("paragraphs", [])) + list(s.get("paragraphs_2", []))
    if paragraphs:
        lines.append('        paragraphs: [')
        for p in paragraphs:
            lines.append(f'          {json.dumps(p, ensure_ascii=False)},')
        lines.append('        ],')
    if "bullets" in s:
        lines.append('        bullets: [')
        for b in s["bullets"]:
            lines.append(f'          {json.dumps(b, ensure_ascii=False)},')
        lines.append('        ],')
    lines.append('      },')
    return "\n".join(lines)


def render_guia(g):
    lines = ["  {"]
    lines.append(f'    slug: {json.dumps(g["slug"])},')
    lines.append(f'    intent: {json.dumps(g["intent"])},')
    lines.append(f'    title: {json.dumps(g["title"], ensure_ascii=False)},')
    lines.append(f'    metaDescription:')
    lines.append(f'      {json.dumps(g["metaDescription"], ensure_ascii=False)},')
    lines.append(f'    intro:')
    lines.append(f'      {json.dumps(g["intro"], ensure_ascii=False)},')
    lines.append('    sections: [')
    for s in g["sections"]:
        lines.append(render_section(s))
    lines.append('    ],')
    lines.append('    faq: [')
    for f in g["faq"]:
        lines.append('      {')
        lines.append(f'        question: {json.dumps(f["question"], ensure_ascii=False)},')
        lines.append(f'        answer: {json.dumps(f["answer"], ensure_ascii=False)},')
        lines.append('      },')
    lines.append('    ],')
    lines.append(f'    ctaTitle: {json.dumps(g["ctaTitle"], ensure_ascii=False)},')
    lines.append(f'    ctaDescription: {json.dumps(g["ctaDescription"], ensure_ascii=False)},')
    lines.append(f'    ctaPrimaryHref: {json.dumps(g["ctaPrimaryHref"])},')
    lines.append(f'    ctaPrimaryLabel: {json.dumps(g["ctaPrimaryLabel"], ensure_ascii=False)},')
    lines.append(f'    ctaSecondaryHref: {json.dumps(g["ctaSecondaryHref"])},')
    lines.append(f'    ctaSecondaryLabel: {json.dumps(g["ctaSecondaryLabel"], ensure_ascii=False)},')
    lines.append('  },')
    return "\n".join(lines)


HEADER = '''// =============================================================================
// lib/guias/content.ts — Contenido de las 9 guías SEO estáticas.
// =============================================================================

export interface GuiaFAQ {
  question: string;
  answer: string;
}

export interface GuiaSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Guia {
  slug: string;
  intent: "informational" | "transactional" | "commercial";
  title: string;
  metaDescription: string;
  intro: string;
  sections: GuiaSection[];
  faq: GuiaFAQ[];
  ctaTitle: string;
  ctaDescription: string;
  ctaPrimaryHref: string;
  ctaPrimaryLabel: string;
  ctaSecondaryHref: string;
  ctaSecondaryLabel: string;
}

export const GUIAS: Guia[] = [
'''

FOOTER = '''
];
'''

import json

def main():
    out = [HEADER]
    for g in GUIAS:
        out.append(render_guia(g))
    out.append(FOOTER)
    content = "\n".join(out)
    path = r"C:\desarrollo\mi-dorsal\lib\guias\content.ts"
    with open(path, "wb") as f:
        f.write(content.encode("utf-8"))
    print(f"Wrote {path}: {len(content)} chars, {len(GUIAS)} guías")

if __name__ == "__main__":
    main()