// Live check against the home server's Garage (needs server/.env.garage; skipped otherwise). Uploads one tiny test
// object with a presigned PUT exactly like the app will, reads it back, then deletes it.
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/AppConfig'
import { coverKey, createS3Client } from '../../src/covers/CoversService'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const ENV_FILE = join(__dirname, '../../.env.garage')
const env = existsSync(ENV_FILE)
  ? Object.fromEntries(readFileSync(ENV_FILE, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
  : null

describe.skipIf(!env)('garage presigned upload (live)', () => {
  it('PUTs via a presigned URL with the app\'s headers and reads it back', async () => {
    const config = loadConfig({
      ...env,
      DATABASE_URL: 'postgresql://unused@localhost/x',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost',
      AI_KEYS_KEY: Buffer.alloc(32).toString('base64'),
    })
    const s3 = createS3Client(config)!
    const key = coverKey('smoke-test', 'presign')
    const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, ContentType: 'image/jpeg' }), { expiresIn: 300 })
    const body = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]) // smallest JPEG-ish payload; Garage doesn't inspect it
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body })
    expect(put.status, await put.text()).toBe(200)
    const got = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
    expect(got.ContentType).toBe('image/jpeg')
    expect(Buffer.from(await got.Body!.transformToByteArray())).toEqual(body)
    await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
  })
})
