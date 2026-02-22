/**
 * supabaseStorageService — Implementação do StorageService usando Supabase Storage.
 * Bucket: 'multitracks' (público para download).
 */
import { supabase } from '@/integrations/supabase/client';
import type { StorageService } from '../storageService';

export const supabaseStorageService: StorageService = {
  async uploadFile(file: File, path: string) {
    const { data, error } = await supabase.storage
      .from('multitracks')
      .upload(path, file, { upsert: false });

    if (error) throw new Error('Falha no upload do arquivo.');

    const { data: urlData } = supabase.storage
      .from('multitracks')
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, storagePath: data.path };
  },

  async deleteFile(storagePath: string) {
    const { error } = await supabase.storage
      .from('multitracks')
      .remove([storagePath]);

    if (error) throw new Error('Falha ao deletar o arquivo.');
  },

  async getDownloadUrl(storagePath: string) {
    const { data } = supabase.storage
      .from('multitracks')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  },
};
