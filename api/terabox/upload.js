import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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

function extractFsId(fileDetails) {
  if (!fileDetails) return null;
  if (fileDetails.fs_id) return String(fileDetails.fs_id);
  if (Array.isArray(fileDetails.info) && fileDetails.info[0]?.fs_id) return String(fileDetails.info[0].fs_id);
  if (Array.isArray(fileDetails.list) && fileDetails.list[0]?.fs_id) return String(fileDetails.list[0].fs_id);
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let tempFile = null;

  try {
    const { fileName, base64, remoteDir = '/multitracks' } = req.body || {};

    if (!fileName || !base64) {
      return res.status(400).json({ error: 'fileName and base64 are required' });
    }

    const uploader = getUploader();

    const cleanName = path.basename(fileName);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbx-'));
    tempFile = path.join(tempDir, cleanName);

    const rawBase64 = String(base64).replace(/^data:.*;base64,/, '');
    fs.writeFileSync(tempFile, Buffer.from(rawBase64, 'base64'));

    const uploadResult = await uploader.uploadFile(tempFile, null, remoteDir);

    if (!uploadResult?.success) {
      return res.status(500).json({ error: uploadResult?.message || 'Upload failed on TeraBox' });
    }

    const fileDetails = uploadResult.fileDetails;
    const fsId = extractFsId(fileDetails);

    if (!fsId) {
      return res.status(500).json({ error: 'Upload succeeded but fs_id was not returned.' });
    }

    const dlinkResult = await uploader.downloadFile(fsId);
    const downloadUrl = dlinkResult?.downloadLink || dlinkResult?.link || dlinkResult?.dlink || null;

    if (!downloadUrl) {
      return res.status(500).json({ error: 'Could not generate download URL for uploaded file.' });
    }

    const storagePath = fileDetails.path || `${remoteDir}/${cleanName}`;

    return res.status(200).json({
      ok: true,
      url: downloadUrl,
      storagePath,
      providerMeta: {
        fsId,
        raw: fileDetails,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected upload error' });
  } finally {
    if (tempFile) {
      try { fs.unlinkSync(tempFile); } catch {}
      try { fs.rmdirSync(path.dirname(tempFile)); } catch {}
    }
  }
}
