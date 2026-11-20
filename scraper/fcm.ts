/**
 * FCM HTTP v1 topic push from Node (GitHub Actions). Free, no Cloud Functions needed.
 * Needs env FIREBASE_SERVICE_ACCOUNT = the service-account JSON of the Khaleej Rozgar Firebase project.
 */
import { createSign } from 'node:crypto';

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

let token: { value: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64url(sig)}` }),
  });
  if (!r.ok) throw new Error(`oauth ${r.status} ${await r.text()}`);
  const d = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return token.value;
}

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

export interface Push { topic: string; title: string; body: string; data: Record<string, string>; channel: string }

export async function sendPush(sa: ServiceAccount, p: Push): Promise<void> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: p.topic,
        notification: { title: p.title, body: p.body },
        data: p.data,
        android: {
          priority: 'high',
          ttl: '86400s',
          notification: { channel_id: p.channel, color: '#0B6E4F', icon: 'notification_icon', tag: p.data.jobId ?? p.topic },
        },
      },
    }),
  });
  if (!r.ok) throw new Error(`fcm ${p.topic} ${r.status} ${await r.text()}`);
}
