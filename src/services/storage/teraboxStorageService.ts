import type { StorageService } from '../storageService';

const TERABOX_UPLOAD_ENDPOINT = '/api/terabox/upload';
const TERABOX_DELETE_ENDPOINT = '/api/terabox/delete';

async function toBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao processar arquivo para upload.'));
    reader.readAsDataURL(file);
  });
}

export const teraboxStorageService: StorageService = {
  async uploadFile(file: File) {
    const base64 = await toBase64(file);

    const response = await fetch(TERABOX_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        base64,
        remoteDir: '/multitracks',
      }),
    });

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok || !data?.url) {
      const lowerRaw = (raw || '').toLowerCase();
      if (response.status === 413 || lowerRaw.includes('request entity too large')) {
        throw new Error('Arquivo muito grande para o endpoint atual. Tente um arquivo menor ou use upload em partes (multipart/chunked).');
      }

      throw new Error(data?.error || raw || 'Falha no upload para o TeraBox.');
    }

    return {
      url: data.url as string,
      storagePath: (data.storagePath as string) || `/multitracks/${file.name}`,
    };
  },

  async deleteFile(storagePath: string) {
    const response = await fetch(TERABOX_DELETE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath }),
    });

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.error || raw || 'Falha ao deletar arquivo no TeraBox.');
    }
  },

  async getDownloadUrl(storagePath: string) {
    // Para o TeraBox MVP, o app usa diretamente storage_url salvo no banco.
    // Este método existe apenas para compatibilidade de interface.
    if (storagePath.startsWith('http')) return storagePath;
    throw new Error('Use storage_url para download no provider TeraBox.');
  },
};
