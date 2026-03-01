import type { StorageService } from '../storageService';

const TERABOX_UPLOAD_ENDPOINT = '/api/terabox/upload';
const TERABOX_DELETE_ENDPOINT = '/api/terabox/delete';

const EXTERNAL_UPLOADER_URL = import.meta.env.VITE_TERABOX_UPLOADER_URL as string | undefined;
const EXTERNAL_UPLOADER_TOKEN = import.meta.env.VITE_TERABOX_UPLOADER_TOKEN as string | undefined;

export const teraboxStorageService: StorageService = {
  async uploadFile(file: File) {
    // Caminho preferencial: uploader externo (VPS) com multipart/form-data
    if (EXTERNAL_UPLOADER_URL) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('remoteDir', '/multitracks');

      const headers: Record<string, string> = {};
      if (EXTERNAL_UPLOADER_TOKEN) {
        headers['x-upload-token'] = EXTERNAL_UPLOADER_TOKEN;
      }

      const response = await fetch(`${EXTERNAL_UPLOADER_URL.replace(/\/$/, '')}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || raw || 'Falha no upload para o uploader externo TeraBox.');
      }

      return {
        url: data.url as string,
        storagePath: (data.storagePath as string) || `/multitracks/${file.name}`,
      };
    }

    // Fallback legado: endpoint Vercel com base64 (limitado para arquivos grandes)
    const readerData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao processar arquivo para upload.'));
      reader.readAsDataURL(file);
    });

    const response = await fetch(TERABOX_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        base64: readerData,
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
        throw new Error('Arquivo muito grande para o endpoint atual. Configure VITE_TERABOX_UPLOADER_URL para usar o uploader no VPS.');
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
