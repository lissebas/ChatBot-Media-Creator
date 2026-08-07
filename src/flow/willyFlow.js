/*
 * Flujo conversacional de "Willy" (chatbot WhatsApp de WGT Seguros) como datos.
 *
 * Es un MAPA hecho a mano de la máquina de estados determinista del bot
 * (whatsapp-agent/app/engine.py). Al no estar declarada como datos en el código
 * (es if/elif), este archivo se mantiene manualmente: si cambia el flujo en
 * engine.py, actualiza los nodos/aristas de abajo. `id` = estado interno
 * (conv.estado) cuando aplica.
 *
 * Este es el flujo SEMILLA que carga Willy Studio la primera vez. Después el
 * editor guarda tus cambios en el navegador (localStorage) y puedes exportar/
 * importar el flujo como JSON.
 */
export const GRUPOS = {
  inicio: { color: "#64748b", nombre: "Inicio" },
  consent: { color: "#0ea5e9", nombre: "Consentimiento" },
  menu: { color: "#2563eb", nombre: "Menú" },
  auto: { color: "#16a34a", nombre: "Cotizar auto" },
  ref: { color: "#0d9488", nombre: "Marca / Modelo / Línea" },
  captura: { color: "#ea580c", nombre: "Datos del asegurado" },
  cotizar: { color: "#7c3aed", nombre: "Cotización / otros ramos" },
  seguimiento: { color: "#db2777", nombre: "Seguimiento" },
  servicio: { color: "#4f46e5", nombre: "Póliza / Siniestro / Cartera / FAQ" },
  fin: { color: "#dc2626", nombre: "Fin / handoff" },
  global: { color: "#9333ea", nombre: "Comandos globales" },
};

export const flujoData = {
  nodes: [
    // ── Entrada / consentimiento ──
    { id: "start", group: "inicio", label: "Mensaje entrante\n(WhatsApp)" },
    { id: "consent", group: "consent", label: "Consentimiento (Habeas Data)\n¿Autorizas el tratamiento de datos?\n[Sí, acepto] · [No]\n(se re-pide cada día calendario)" },
    { id: "despedida", group: "fin", label: "Fin: no autoriza\n(despedida)" },
    { id: "menu", group: "menu", label: "MENÚ PRINCIPAL\n[Cotizar] [Mi póliza] [Siniestro]\n[Cartera] [Preguntas] [Asesor]\n(saluda 1ª vez del día)" },

    // ── Comandos globales (desde cualquier paso) ──
    { id: "g_asesor", group: "global", label: "«asesor» → hablar con un asesor\n(handoff wa.me, cualquier paso)" },
    { id: "g_confianza", group: "global", label: "«fraude / es seguro / confianza»\n→ mensaje de confianza / anti-fraude" },
    { id: "g_menu", group: "global", label: "«menú» → vuelve al menú" },

    // ── Cotizar: elegir ramo ──
    { id: "cot_ramo", group: "cotizar", label: "cot_ramo\n¿Qué deseas proteger?\n[Auto · Vida · Salud · Hogar · Empresa]" },

    // ── Cotizar AUTO ──
    { id: "cot_auto_tipo", group: "auto", label: "cot_auto_tipo\nSeguro TODO RIESGO (no cotizamos SOAT)\n¿Es un carro o una moto?" },
    { id: "cot_auto_0km", group: "auto", label: "cot_auto_0km\n¿El vehículo es 0 km (nuevo)?\n[Sí] · [No]" },
    { id: "cot_auto_0km_placa", group: "auto", label: "cot_auto_0km_placa\n(0km) ¿Ya tiene placa asignada?\n[Sí] · [No]" },
    { id: "cot_auto_placa", group: "auto", label: "cot_auto_placa\n¿Cuál es la placa?\n(valida carro XXX123 / moto XXX12A)" },
    { id: "cot_auto_placa_recovery", group: "auto", label: "cot_auto_placa_recovery\nLa placa no resolvió en AgenteMotor\n[Corregir la placa] · [Buscar por marca]" },
    { id: "cot_auto_placa2", group: "auto", label: "cot_auto_placa2\nReintento de placa (typo)" },

    // ── Sub-flujo por REFERENCIA (marca/modelo/línea → Fasecolda) ──
    { id: "ref_modelo", group: "ref", label: "cot_auto_ref_modelo\n¿De qué modelo (año)?" },
    { id: "ref_marca", group: "ref", label: "cot_auto_ref_marca\n¿Marca? (match difuso vs 473 marcas)" },
    { id: "ref_marca_elegir", group: "ref", label: "cot_auto_ref_marca_elegir\nElegir marca (lista, 2-10 candidatos)" },
    { id: "ref_linea", group: "ref", label: "cot_auto_ref_linea\n¿Línea / referencia? (match difuso)" },
    { id: "ref_linea_elegir", group: "ref", label: "cot_auto_ref_linea_elegir\nElegir línea (lista, 2-10 candidatos)" },
    { id: "ref_resolver", group: "ref", label: "Resolver vehículo (Fasecolda)\nbuscar-por-característica" },
    { id: "ref_variante_elegir", group: "ref", label: "cot_auto_ref_variante_elegir\nElegir versión (lista rica: CC + precio,\npaginada «Ver más» si >10)" },
    { id: "ref_precio", group: "ref", label: "cot_auto_ref_precio\n¿Precio del vehículo?\n(ok = referencia, o escribe otro)" },
    { id: "escalar_ref", group: "fin", label: "Escala a asesor\n(no se identificó el vehículo)" },

    // ── Captura del asegurado (cadena) ──
    { id: "cedula", group: "captura", label: "cot_auto_cedula\n¿Cédula del asegurado?" },
    { id: "nombre", group: "captura", label: "cot_auto_nombre\n¿Nombres?" },
    { id: "apellido", group: "captura", label: "cot_auto_apellido\n¿Apellidos?" },
    { id: "genero", group: "captura", label: "cot_auto_genero\n¿Género? [Masculino/Femenino]" },
    { id: "fnac", group: "captura", label: "cot_auto_fnac\n¿Fecha de nacimiento?" },
    { id: "ciudad", group: "captura", label: "cot_auto_ciudad\n¿En qué ciudad circula el vehículo?" },
    { id: "correo", group: "captura", label: "cot_auto_correo\n¿Correo? (obligatorio)\n→ se registra en el CRM (NO en AgenteMotor)" },
    { id: "motivo", group: "captura", label: "cot_auto_motivo\n¿Motivo? (lista numerada 1-6)\n→ bitácora del negocio" },

    // ── Cotizar (AgenteMotor + CRM) ──
    { id: "finalizar", group: "cotizar", label: "COTIZAR (AgenteMotor)\ncrea cliente + negocio en Softseguros\n(todo en MAYÚSCULA); jala ofertas (pull)" },
    { id: "ofertas", group: "cotizar", label: "Entrega comparativo + PDF\n+ nota de confianza\n(sube el PDF a Archivos del negocio)" },

    // ── Seguimiento post-cotización ──
    { id: "sigue_asesor", group: "seguimiento", label: "¿Quieres que un asesor te ayude a avanzar?\n[Sí] · [No]" },
    { id: "tarea", group: "seguimiento", label: "Sí → crea TAREA en el negocio\n(asignada a Juan Sebastián) + link asesor" },
    { id: "cierra_no", group: "seguimiento", label: "No → cierra el seguimiento" },
    { id: "recordatorios", group: "seguimiento", label: "Recordatorios 2h / 48h / 7d\n(cron AWS EventBridge, horario laboral)\nplantilla o texto; fin al 3º" },

    // ── Otros ramos (vida/salud/hogar/empresa) ──
    { id: "otro_nombre", group: "cotizar", label: "cot_otro_nombre\n¿Nombre completo?" },
    { id: "otro_cedula", group: "cotizar", label: "cot_otro_cedula\n¿Cédula?" },
    { id: "otro_ciudad", group: "cotizar", label: "cot_otro_ciudad\n¿Ciudad?" },
    { id: "otro_correo", group: "cotizar", label: "cot_otro_correo\n¿Correo? (opcional)" },
    { id: "otro_handoff", group: "fin", label: "Registra lead + handoff a asesor\n(cotización de otro ramo)" },

    // ── Otros servicios del menú ──
    { id: "pol", group: "servicio", label: "Mi póliza / renovación\nverifica identidad (wa_id = celular)\n→ muestra pólizas vigentes + PDF" },
    { id: "sin", group: "servicio", label: "Siniestro\ndirectorio de la aseguradora + requisitos\n→ acompañamiento de asesor" },
    { id: "car", group: "servicio", label: "Cartera / pagos\nestado y vencimientos\n→ asesor de cartera" },
    { id: "faq", group: "servicio", label: "Preguntas frecuentes\n[Qué cubre · Documentos · Cómo pagar\n· ¿Es seguro? · Por qué WGT · Otra]" },
    { id: "asesor", group: "fin", label: "Hablar con un asesor\n(handoff wa.me con contexto)" },
  ],

  edges: [
    { from: "start", to: "consent" },
    { from: "consent", to: "menu", label: "Sí acepto" },
    { from: "consent", to: "despedida", label: "No" },

    // menú → sub-flujos
    { from: "menu", to: "cot_ramo", label: "Cotizar" },
    { from: "menu", to: "pol", label: "Mi póliza" },
    { from: "menu", to: "sin", label: "Siniestro" },
    { from: "menu", to: "car", label: "Cartera" },
    { from: "menu", to: "faq", label: "Preguntas" },
    { from: "menu", to: "asesor", label: "Asesor" },

    // ramo
    { from: "cot_ramo", to: "cot_auto_tipo", label: "Auto" },
    { from: "cot_ramo", to: "otro_nombre", label: "Vida/Salud/Hogar/Empresa" },

    // auto: 0km
    { from: "cot_auto_tipo", to: "cot_auto_0km", label: "carro / moto" },
    { from: "cot_auto_0km", to: "cot_auto_0km_placa", label: "Sí (0km)" },
    { from: "cot_auto_0km", to: "cot_auto_placa", label: "No (usado)" },
    { from: "cot_auto_0km_placa", to: "cot_auto_placa", label: "Sí, tiene placa" },
    { from: "cot_auto_0km_placa", to: "ref_modelo", label: "No tiene placa" },

    // auto: placa
    { from: "cot_auto_placa", to: "cedula", label: "usado → captura" },
    { from: "cot_auto_placa", to: "ref_modelo", label: "0km con placa → referencia" },
    { from: "cot_auto_placa2", to: "finalizar" },

    // referencia
    { from: "ref_modelo", to: "ref_marca" },
    { from: "ref_marca", to: "ref_linea", label: "1 match" },
    { from: "ref_marca", to: "ref_marca_elegir", label: "2-10" },
    { from: "ref_marca", to: "escalar_ref", label: "0 / >10", dashes: true },
    { from: "ref_marca_elegir", to: "ref_linea" },
    { from: "ref_linea", to: "ref_resolver", label: "1 match" },
    { from: "ref_linea", to: "ref_linea_elegir", label: "2-10" },
    { from: "ref_linea", to: "escalar_ref", label: "0 / >10", dashes: true },
    { from: "ref_linea_elegir", to: "ref_resolver" },
    { from: "ref_resolver", to: "ref_precio", label: "1 vehículo" },
    { from: "ref_resolver", to: "ref_variante_elegir", label: "2+ versiones" },
    { from: "ref_resolver", to: "escalar_ref", label: "0", dashes: true },
    { from: "ref_variante_elegir", to: "ref_precio", label: "elige versión" },
    { from: "ref_precio", to: "cedula", label: "precio → captura" },

    // captura (cadena)
    { from: "cedula", to: "nombre" },
    { from: "nombre", to: "apellido" },
    { from: "apellido", to: "genero" },
    { from: "genero", to: "fnac" },
    { from: "fnac", to: "ciudad" },
    { from: "ciudad", to: "correo" },
    { from: "correo", to: "motivo" },
    { from: "motivo", to: "finalizar" },

    // cotizar
    { from: "finalizar", to: "ofertas", label: "cotización OK" },
    { from: "finalizar", to: "cot_auto_placa_recovery", label: "placa no resolvió", dashes: true },
    { from: "finalizar", to: "asesor", label: "sin saldo / error", dashes: true },
    { from: "cot_auto_placa_recovery", to: "cot_auto_placa2", label: "Corregir la placa" },
    { from: "cot_auto_placa_recovery", to: "ref_modelo", label: "Buscar por marca" },

    // seguimiento
    { from: "ofertas", to: "sigue_asesor" },
    { from: "sigue_asesor", to: "tarea", label: "Sí" },
    { from: "sigue_asesor", to: "cierra_no", label: "No" },
    { from: "sigue_asesor", to: "recordatorios", label: "sin respuesta" },
    { from: "recordatorios", to: "sigue_asesor", label: "re-pregunta (2h/48h/7d)", dashes: true },

    // otros ramos
    { from: "otro_nombre", to: "otro_cedula" },
    { from: "otro_cedula", to: "otro_ciudad" },
    { from: "otro_ciudad", to: "otro_correo" },
    { from: "otro_correo", to: "otro_handoff" },
  ],
};
