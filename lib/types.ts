export type Estado = 'por_hacer' | 'en_curso' | 'revision' | 'hecho';
export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';

export interface Perfil {
  id: string;
  email: string;
  nombre: string | null;
  avatar_url: string | null;
}

export interface Proyecto {
  id: string;
  workspace_id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  archivado: boolean;
  creado_en: string;
}

export interface Fase {
  id: string;
  proyecto_id: string;
  nombre: string;
  posicion: number;
}

export interface Tarea {
  id: string;
  workspace_id: string;
  proyecto_id: string;
  fase_id: string | null;
  titulo: string;
  descripcion: string | null;
  estado: Estado;
  prioridad: Prioridad;
  responsable_id: string | null;
  fecha_limite: string | null;
  posicion: number;
  creado_en: string;
  terminado_en: string | null;
}

export const ESTADOS: { id: Estado; nombre: string }[] = [
  { id: 'por_hacer', nombre: 'Por hacer' },
  { id: 'en_curso', nombre: 'En curso' },
  { id: 'revision', nombre: 'En revisión' },
  { id: 'hecho', nombre: 'Hecho' }
];

export const PRIORIDADES: { id: Prioridad; nombre: string }[] = [
  { id: 'baja', nombre: 'Baja' },
  { id: 'media', nombre: 'Media' },
  { id: 'alta', nombre: 'Alta' },
  { id: 'urgente', nombre: 'Urgente' }
];

export const COLORES_PROYECTO = ['#2246C4', '#20B7A9', '#7C3AED', '#D9703F', '#0F766E', '#182333'];
