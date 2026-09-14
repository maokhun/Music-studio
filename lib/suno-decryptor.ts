import crypto from 'crypto';

interface MangoRightsResponse {
  key: string;
  iv: string;
  glt: string;
}

/**
 * Decrypts Suno Mango DRM (AES-GCM unwrapping + AES-128-CTR stream decryption)
 * Node.js Native Crypto implementation - 100% zero external dependencies
 */
export async function decryptSunoMango(songId: string, encryptedBuffer: Buffer): Promise<Buffer> {
  // Check if buffer is already clean (starts with 'ftyp' or 'ID3')
  if (encryptedBuffer.length > 8) {
    const header = encryptedBuffer.subarray(4, 8).toString('ascii');
    if (header === 'ftyp' || encryptedBuffer.subarray(0, 3).toString('ascii') === 'ID3') {
      return encryptedBuffer; // Already decrypted or standard mp3
    }
  }

  // 1. Request Mango Rights from Suno Production API
  const rightsRes = await fetch('https://studio-api.prod.suno.com/api/mango/rights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': 'https://suno.com/',
      'Origin': 'https://suno.com'
    },
    body: JSON.stringify({
      content_params: {
        content_id: songId,
        content_type: 'clip'
      }
    }),
    cache: 'no-store'
  });

  if (!rightsRes.ok) {
    throw new Error(`Failed to obtain Suno Mango DRM license (HTTP ${rightsRes.status})`);
  }

  const rightsData: MangoRightsResponse = await rightsRes.json();
  const userKey = crypto.createHash('sha256').update(rightsData.glt).digest();

  // Helper to unwrap key / iv using AES-256-GCM
  const unwrapKey = (b64: string): Buffer => {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, 12);
    const ct = buf.subarray(12, buf.length - 16);
    const tag = buf.subarray(buf.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', userKey, iv);
    decipher.setAAD(Buffer.from(songId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  };

  const contentKey = unwrapKey(rightsData.key);
  const contentIv = unwrapKey(rightsData.iv);

  // Decrypt the audio stream using AES-128-CTR
  const decipherAudio = crypto.createDecipheriv('aes-128-ctr', contentKey, contentIv);
  return Buffer.concat([decipherAudio.update(encryptedBuffer), decipherAudio.final()]);
}
