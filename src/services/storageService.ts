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

const teraboxWithFallbackService: StorageService = {
  async uploadFile(file: File, path: string) {
    try {
      return await teraboxStorageService.uploadFile(file, path);
    } catch (error) {
      console.warn('[storageService] TeraBox upload falhou, usando fallback Supabase.', error);
      return await supabaseStorageService.uploadFile(file, path);
    }
  },
  async deleteFile(storagePath: string) {
    // Tentativa no TeraBox; se falhar, tenta Supabase.
    try {
      await teraboxStorageService.deleteFile(storagePath);
      return;
    } catch {
      await supabaseStorageService.deleteFile(storagePath);
    }
  },
  async getDownloadUrl(storagePath: string) {
    if (storagePath.startsWith('http')) return storagePath;
    return await supabaseStorageService.getDownloadUrl(storagePath);
  },
};

// Exporta a implementação ativa por variável de ambiente.
// Valores suportados: "supabase" (default) | "terabox" (com fallback automático)
export const storageService: StorageService =
  provider === 'terabox' ? teraboxWithFallbackService : supabaseStorageService;
