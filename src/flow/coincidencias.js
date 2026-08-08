/*
 * Emparejar texto libre con una lista, sin modelos de lenguaje.
 *
 * La gente no escribe el nombre exacto de una opción: escribe "mazda", "MAZDA
 * 3", "mazda tres". Así que se prueba por capas, de la más estricta a la más
 * laxa, y se para en la primera que dé resultado. Lo importante es el resultado
 * de tres estados:
 *
 *   único   → resolvió: sigue sin preguntar nada.
 *   varios  → hay candidatos: enséñalos y que elija.
 *   ninguno → no se parece a nada: reintenta o pasa a un humano.
 *
 * Ese tri-estado es lo que evita el error clásico de "elegir el más parecido"
 * cuando en realidad no había ni uno bueno.
 */
import { listaDe, normalizar } from "./validadores";

/**
 * Letras que las dos cadenas comparten en el mismo orden.
 *
 * Se mide así, y no con pares de letras, porque la errata más común es cambiar
 * dos de sitio ("renualt" por "renault"): contando pares, eso rompe tres de los
 * seis pares y el parecido se hunde; contando letras en orden, apenas baja.
 */
function comunesEnOrden(a, b) {
  let previa = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const fila = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      fila[j] = a[i - 1] === b[j - 1] ? previa[j - 1] + 1 : Math.max(previa[j], fila[j - 1]);
    }
    previa = fila;
  }
  return previa[b.length];
}

/** Parecido entre dos textos: 1 es idéntico, 0 no se parecen en nada. */
export function parecido(a, b) {
  const x = normalizar(a).replace(/\s+/g, " ");
  const y = normalizar(b).replace(/\s+/g, " ");
  if (!x || !y) return x === y ? 1 : 0;
  return (2 * comunesEnOrden(x, y)) / (x.length + y.length);
}

/**
 * Busca `texto` en `items` por capas.
 * Devuelve { tipo: "unico"|"varios"|"ninguno", valor, opciones }.
 */
export function coincidir(texto, items, { umbral = 0.72, max = 10 } = {}) {
  const lista = listaDe(items);
  const t = normalizar(texto);
  if (!t || !lista.length) return { tipo: "ninguno", valor: null, opciones: [] };

  const capas = [
    (o) => normalizar(o) === t,
    (o) => normalizar(o).startsWith(`${t} `) || normalizar(o) === t,
    (o) => t.startsWith(`${normalizar(o)} `),
    (o) => normalizar(o).includes(t) || t.includes(normalizar(o)),
  ];

  for (const capa of capas) {
    const hits = lista.filter(capa);
    if (hits.length === 1) return { tipo: "unico", valor: hits[0], opciones: hits };
    if (hits.length > 1) return { tipo: "varios", valor: null, opciones: hits.slice(0, max) };
  }

  // Última capa: parecido tipográfico, para las erratas.
  const puntuados = lista
    .map((o) => ({ o, p: parecido(texto, o) }))
    .filter((x) => x.p >= umbral)
    .sort((a, b) => b.p - a.p);

  if (puntuados.length === 1) return { tipo: "unico", valor: puntuados[0].o, opciones: [puntuados[0].o] };
  if (puntuados.length > 1) {
    return { tipo: "varios", valor: null, opciones: puntuados.slice(0, max).map((x) => x.o) };
  }
  return { tipo: "ninguno", valor: null, opciones: [] };
}

/**
 * ¿El texto contiene alguna de estas palabras clave? Es el emparejado de las
 * intenciones y de los comandos globales: basta con que aparezca una.
 */
export function coincidePalabras(texto, palabras) {
  const t = normalizar(texto);
  if (!t) return false;
  return listaDe(palabras).some((p) => {
    const clave = normalizar(p);
    return clave && (t === clave || t.includes(clave));
  });
}

/** La primera opción de la lista cuyas palabras clave aparezcan en el texto. */
export function primeraQueCoincide(texto, opciones, sacarPalabras) {
  return opciones.find((o) => coincidePalabras(texto, sacarPalabras(o))) || null;
}
