import sanitizeHtml from 'sanitize-html';

/** Etiquetas y estilos permitidos en la descripción con formato. Todo lo demás se elimina. */
const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'font', 'mark', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'],
  allowedAttributes: { span: ['style'], font: ['color', 'size', 'face'], p: ['style'], div: ['style'], mark: ['style'], li: ['style'], a: ['href', 'target', 'rel'] },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^transparent$/i],
      'font-size': [/^(x-small|small|medium|large|x-large|xx-large|\d{1,2}(px|em|rem|%))$/i],
      'font-family': [/^[\w\s"',-]{1,80}$/],
      'font-weight': [/^(bold|normal|[1-9]00)$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^[a-z\s-]{1,40}$/],
      'text-decoration-line': [/^[a-z\s-]{1,40}$/],
      'text-align': [/^(left|right|center|justify)$/]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) }
};

export function sanitizarHtml(html: string): string {
  return sanitizeHtml(html, OPCIONES).slice(0, 20000);
}

/** Texto sin formato (para correos y WhatsApp). */
export function textoPlano(html: string | null | undefined): string {
  return sanitizeHtml(String(html || '').replace(/<(br|\/p|\/div|\/li|\/h[23])\s*\/?>/gi, '\n'), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
