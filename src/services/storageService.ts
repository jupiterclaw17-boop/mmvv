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

// Exporta a implementação ativa (Supabase Storage no MVP)
export { supabaseStorageService as storageService } from './storage/supabaseStorageService';
