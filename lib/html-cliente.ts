/**
 * Limpieza de HTML en el navegador (por si algo llegó sin pasar por el servidor).
 * Solo deja etiquetas de formato básico y estilos de color, tamaño y tipo de letra.
 */
const ETIQUETAS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'FONT', 'MARK', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A']);
const ESTILOS = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align'];

function limpiarNodo(nodo: Element) {
  for (const hijo of Array.from(nodo.children)) {
    // Primero se limpian sus hijos; así, si esta etiqueta se quita, lo que suba ya está limpio.
    limpiarNodo(hijo);
    if (!ETIQUETAS.has(hijo.tagName)) {
      // Etiqueta no permitida: se conserva su texto, sin la etiqueta.
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(hijo.tagName)) hijo.remove();
      else hijo.replaceWith(...Array.from(hijo.childNodes));
      continue;
    }
    for (const attr of Array.from(hijo.attributes)) {
      const n = attr.name.toLowerCase();
      if (n === 'style') {
        const el = hijo as HTMLElement;
        const conservar = ESTILOS.map((p) => [p, el.style.getPropertyValue(p)] as const).filter(([, v]) => v && !/url\(|expression/i.test(v));
        el.removeAttribute('style');
        conservar.forEach(([p, v]) => el.style.setProperty(p, v));
        if (!el.getAttribute('style')) el.removeAttribute('style');
      } else if (hijo.tagName === 'FONT' && ['color', 'size', 'face'].includes(n)) {
        // permitido
      } else if (hijo.tagName === 'A' && n === 'href' && /^(https?:|mailto:)/i.test(attr.value.trim())) {
        hijo.setAttribute('target', '_blank');
        hijo.setAttribute('rel', 'noopener noreferrer');
      } else if (!(hijo.tagName === 'A' && (n === 'target' || n === 'rel'))) {
        hijo.removeAttribute(attr.name);
      }
    }
  }
}

export function sanitizarHtmlCliente(html: string): string {
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const raiz = doc.body.firstElementChild as HTMLElement;
  limpiarNodo(raiz);
  return raiz.innerHTML;
}

/** Las descripciones viejas eran texto plano: se convierten a HTML respetando los saltos de línea. */
export function aHtml(texto: string | null | undefined): string {
  const t = texto || '';
  if (/<\/?[a-z][\s\S]*>/i.test(t)) return t;
  return t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>');
}
