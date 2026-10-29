'use client';

import { useEffect, useRef, useState } from 'react';
import { aHtml, sanitizarHtmlCliente } from '@/lib/html-cliente';

const COLORES = ['#182333', '#B42318', '#D9703F', '#B54708', '#027A48', '#2246C4', '#7C3AED', '#6E6E73'];
const RESALTADOS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', 'transparent'];
const TAMANOS: [string, string][] = [['2', 'Pequeño'], ['3', 'Normal'], ['5', 'Grande'], ['6', 'Muy grande']];
const LETRAS: [string, string][] = [['', 'Predeterminada'], ['Georgia, serif', 'Serif'], ['ui-monospace, monospace', 'Monoespaciada'], ['"Comic Sans MS", cursive', 'Manuscrita']];

/**
 * Editor de texto con formato básico (negrita, cursiva, subrayado, tachado, color, resaltado,
 * tamaño, tipo de letra y listas). Guarda HTML limpio.
 */
export default function EditorTexto({ id, valor, onCambio, placeholder }: { id: string; valor: string; onCambio: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vacio, setVacio] = useState(!valor);
  const [panel, setPanel] = useState<'color' | 'resaltar' | null>(null);

  // Carga el contenido al abrir otra tarea (no mientras se escribe, para no mover el cursor).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = sanitizarHtmlCliente(aHtml(valor));
    if (el.innerHTML !== html && document.activeElement !== el) el.innerHTML = html;
    setVacio(!el.textContent?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function emitir() {
    const el = ref.current;
    if (!el) return;
    setVacio(!el.textContent?.trim() && !el.querySelector('li'));
    onCambio(el.textContent?.trim() || el.querySelector('li') ? sanitizarHtmlCliente(el.innerHTML) : '');
  }

  function cmd(nombre: string, valor?: string) {
    ref.current?.focus();
    document.execCommand('styleWithCSS', false, nombre === 'fontSize' ? 'false' : 'true');
    document.execCommand(nombre, false, valor);
    emitir();
  }

  const Boton = ({ titulo, onClick, children, activo = false }: { titulo: string; onClick: () => void; children: React.ReactNode; activo?: boolean }) => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm transition hover:bg-white ${activo ? 'bg-white shadow-sm' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-300 bg-white focus-within:border-azul focus-within:ring-2 focus-within:ring-azul/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-fondo px-1.5 py-1" role="toolbar" aria-label="Formato del texto">
        <Boton titulo="Negrita (Ctrl+B)" onClick={() => cmd('bold')}><b>B</b></Boton>
        <Boton titulo="Cursiva (Ctrl+I)" onClick={() => cmd('italic')}><i className="font-serif">I</i></Boton>
        <Boton titulo="Subrayado (Ctrl+U)" onClick={() => cmd('underline')}><u>U</u></Boton>
        <Boton titulo="Tachado" onClick={() => cmd('strikeThrough')}><s>S</s></Boton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />

        <div className="relative">
          <Boton titulo="Color del texto" onClick={() => setPanel(panel === 'color' ? null : 'color')} activo={panel === 'color'}>
            <span className="flex flex-col items-center leading-none"><span className="text-sm font-bold">A</span><span className="mt-0.5 h-1 w-4 rounded bg-gradient-to-r from-red-600 via-azul to-turquesa" /></span>
          </Boton>
          {panel === 'color' && (
            <div className="absolute left-0 top-9 z-10 grid grid-cols-4 gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {COLORES.map((c) => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (cmd('foreColor', c), setPanel(null))} className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <Boton titulo="Resaltar" onClick={() => setPanel(panel === 'resaltar' ? null : 'resaltar')} activo={panel === 'resaltar'}>
            <span className="rounded bg-yellow-200 px-1 text-sm font-bold">ab</span>
          </Boton>
          {panel === 'resaltar' && (
            <div className="absolute left-0 top-9 z-10 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {RESALTADOS.map((c) => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (cmd('hiliteColor', c), setPanel(null))} className="h-6 w-6 rounded-md ring-1 ring-black/10" style={{ background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff,#fff 3px,#e2e8f0 3px,#e2e8f0 6px)' : c }} aria-label={c === 'transparent' ? 'Quitar resaltado' : `Resaltar ${c}`} />
              ))}
            </div>
          )}
        </div>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />

        <label className="sr-only" htmlFor={`${id}-tam`}>Tamaño</label>
        <select id={`${id}-tam`} defaultValue="" onChange={(e) => (e.target.value && cmd('fontSize', e.target.value), (e.target.value = ''))} className="h-8 w-[6.5rem] rounded-lg border-0 bg-transparent py-0 pl-2 pr-7 text-xs font-semibold hover:bg-white focus:ring-0">
          <option value="" disabled>Tamaño</option>
          {TAMANOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <label className="sr-only" htmlFor={`${id}-letra`}>Tipo de letra</label>
        <select id={`${id}-letra`} defaultValue="x" onChange={(e) => (cmd('fontName', e.target.value || 'Plus Jakarta Sans, sans-serif'), (e.target.value = 'x'))} className="h-8 w-[6.5rem] rounded-lg border-0 bg-transparent py-0 pl-2 pr-7 text-xs font-semibold hover:bg-white focus:ring-0">
          <option value="x" disabled>Letra</option>
          {LETRAS.map(([v, t]) => <option key={t} value={v}>{t}</option>)}
        </select>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />

        <Boton titulo="Lista con viñetas" onClick={() => cmd('insertUnorderedList')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
        </Boton>
        <Boton titulo="Lista numerada" onClick={() => cmd('insertOrderedList')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 14.5a1 1 0 0 1 2 0c0 1-2 1.5-2 3h2" /></svg>
        </Boton>
        <Boton titulo="Quitar formato" onClick={() => cmd('removeFormat')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 5h12M12 5l-3 14M4 20 20 4" /></svg>
        </Boton>
      </div>
      <div className="relative">
        {vacio && <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-400">{placeholder}</span>}
        <div
          id={id}
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Descripción"
          onInput={emitir}
          onBlur={emitir}
          onPaste={(e) => {
            // Al pegar desde Word o una página, se deja solo el formato básico.
            const html = e.clipboardData.getData('text/html');
            if (!html) return;
            e.preventDefault();
            document.execCommand('insertHTML', false, sanitizarHtmlCliente(html));
            emitir();
          }}
          className="descripcion min-h-[120px] px-3 py-2.5 text-sm focus:outline-none"
        />
      </div>
    </div>
  );
}
