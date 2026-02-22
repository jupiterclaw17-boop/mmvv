/** Enum de tons para song_key */
export const SONG_KEYS_MAJOR = [
  'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B',
] as const;

export const SONG_KEYS_MINOR = [
  'Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm', 'Am', 'A#m/Bbm', 'Bm',
] as const;

export const ALL_SONG_KEYS = [...SONG_KEYS_MAJOR, ...SONG_KEYS_MINOR] as const;
export type SongKey = (typeof ALL_SONG_KEYS)[number];

/** Formatos de arquivo aceitos */
export const ACCEPTED_FILE_FORMATS = ['.mp3', '.wav', '.zip', '.m4a'];
export const ACCEPTED_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'application/zip', 'audio/mp4', 'audio/x-m4a'];
export const MAX_FILE_SIZE_MB = 500;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Paginação */
export const PAGE_SIZE = 20;

/** Períodos */
export const PERIODS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
] as const;

/** Role labels */
export const ROLE_OPTIONS = [
  { value: 'ministro_guia', label: 'Ministro Guia' },
  { value: 'dm', label: 'DM' },
  { value: 'admin', label: 'Admin' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
] as const;

export const TEAM_STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
] as const;
