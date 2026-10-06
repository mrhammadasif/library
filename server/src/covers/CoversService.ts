import type { IMembership } from '../auth/Access'
import type { IAppConfig } from '../config/AppConfig'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable } from '@nestjs/common'
import { requirePermission } from '../auth/Permissions'
import { DomainError } from '../common/DomainError'
import { APP_CONFIG } from '../config/AppConfig'

export function createS3Client(config: IAppConfig): S3Client | null {
  if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
    return null
  }
  return new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
    // Garage rejects the CRC32 checksum params newer SDKs add to presigned PUTs (InvalidDigest).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

/** Cover keys are {libraryId}/{bookId}-{timestamp}.jpg: a new key per upload so cached images refresh. */
export function coverKey(libraryId: string, bookId: string, now = Date.now()): string {
  return `${libraryId}/${bookId}-${now}.jpg`
}

@Injectable()
export class CoversService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
    @Inject(S3Client) private readonly s3: S3Client | null,
  ) {}

  /** A 5-minute URL the app PUTs the JPEG to directly; the API never handles image bytes. */
  async presign(m: IMembership, bookId: string): Promise<{ uploadUrl: string, key: string, publicUrl: string }> {
    if (!m.permissions.includes('books.add')) {
      requirePermission(m, 'books.edit')
    }
    if (!this.s3 || !this.config.COVERS_PUBLIC_URL) {
      throw new DomainError(409, 'storage_not_configured', 'Cover uploads aren\'t set up on this server')
    }
    const key = coverKey(m.libraryId, bookId)
    const uploadUrl = await getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key, ContentType: 'image/jpeg' }), { expiresIn: 300 })
    return { uploadUrl, key, publicUrl: `${this.config.COVERS_PUBLIC_URL.replace(/\/+$/, '')}/${key}` }
  }
}
