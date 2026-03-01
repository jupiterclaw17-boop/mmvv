/**
 * StorageService — Interface abstraída para upload/download/deleção de arquivos.
 * Para trocar o provider, altere a implementação exportada neste arquivo.
 * Nenhum outro arquivo da aplicação deve importar o Supabase Storage diretamente.
 */

export interface StorageService {
  uploadFile(file: File, path: string): Promise<{ url: string; storagePath: string }>;
  deleteFile(storagePath: string): Promise<void>;
  getDownloadUrl(storagePath: string): Promise<string>;
}

import { supabaseStorageService } from './storage/supabaseStorageService';
import { teraboxStorageService } from './storage/teraboxStorageService';

const provider = import.meta.env.VITE_STORAGE_PROVIDER;

// Exporta a implementação ativa por variável de ambiente.
// Valores suportados: "supabase" (default) | "terabox"
export const storageService: StorageService =
  provider === 'terabox' ? teraboxStorageService : supabaseStorageService;
