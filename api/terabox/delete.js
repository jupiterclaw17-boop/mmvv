import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TeraboxUploader = require('terabox-upload-tool');

function getUploader() {
  const ndus = process.env.TERABOX_NDUS;
  const jsToken = process.env.TERABOX_JS_TOKEN;
  const appId = process.env.TERABOX_APP_ID || '250528';
  const bdstoken = process.env.TERABOX_BDSTOKEN || '';
  const browserId = process.env.TERABOX_BROWSER_ID || '';

  if (!ndus || !jsToken || !appId) {
    throw new Error('Missing TeraBox credentials. Configure TERABOX_NDUS, TERABOX_JS_TOKEN, TERABOX_APP_ID.');
  }

  return new TeraboxUploader({ ndus, jsToken, appId, bdstoken, browserId });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { storagePath } = req.body || {};

    if (!storagePath) {
      return res.status(400).json({ error: 'storagePath is required' });
    }

    const uploader = getUploader();
    const result = await uploader.deleteFiles([storagePath]);

    if (!result?.success) {
      return res.status(500).json({ error: result?.message || 'Delete failed on TeraBox' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected delete error' });
  }
}
