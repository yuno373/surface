// R2 S3互換クライアント — Render から Cloudflare R2 に接続
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

let client: S3Client | null = null

function getConfig() {
  const accountId = process.env.CF_ACCOUNT_ID
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY
  const bucket = process.env.CF_R2_BUCKET || 'jochu-kokuban-files'
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('環境変数 CF_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY が必要です')
  }
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

function getClient(): S3Client {
  if (client) return client
  const { accountId, accessKeyId, secretAccessKey } = getConfig()
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  })
  return client
}

export function createR2Client() {
  const { bucket } = getConfig()

  return {
    async put(key: string, data: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }, customMetadata?: Record<string, string> }) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(data),
        ContentType: options?.httpMetadata?.contentType,
        Metadata: options?.customMetadata
      })
      await getClient().send(cmd)
    },

    async get(key: string) {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
      const result = await getClient().send(cmd)
      if (!result.Body) return null

      return {
        body: result.Body as any,
        writeHttpMetadata(headers: Headers) {
          if (result.ContentType) headers.set('Content-Type', result.ContentType)
          if (result.ContentLength) headers.set('Content-Length', String(result.ContentLength))
          if (result.ContentDisposition) headers.set('Content-Disposition', result.ContentDisposition)
          if (result.CacheControl) headers.set('Cache-Control', result.CacheControl)
          if (result.ETag) headers.set('ETag', result.ETag)
          if (result.LastModified) headers.set('Last-Modified', result.LastModified.toUTCString())
        }
      }
    },

    async delete(key: string) {
      const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key })
      await getClient().send(cmd)
    }
  }
}
