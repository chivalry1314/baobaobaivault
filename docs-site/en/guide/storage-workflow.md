# Storage to Media Upload Workflow

This guide explains the full object-storage workflow in `sharefrontend`:

1. create a storage config
2. create namespaces
3. switch media storage
4. verify card upload, preview, and download

It applies to:

- Aliyun OSS
- Amazon S3
- MinIO
- Tencent COS

Aliyun OSS is used as the default example below.

## 1. Relationship Between the Pages

The pages work like this:

- `Storage Config`
  - defines how the backend connects to object storage
  - provider, endpoint, region, bucket, access key, secret key
- `Namespaces`
  - define logical isolation, path prefix, and quotas
  - each namespace can bind a storage config
- `Media Storage`
  - decides where newly uploaded share card covers and attachments are written
- `Card Upload`
  - validates whether the media pipeline is working

In short:

- storage config = where to connect
- namespace = how to partition
- media storage = where new files go

## 2. Step 1: Create a Storage Config

Go to:

- `System Management -> Storage Config`

Click:

- `New Config`

Typical Aliyun OSS values:

- `Name`
  - example: `Aliyun OSS Primary`
- `Provider`
  - choose `Aliyun OSS`
  - actual value: `oss`
- `Endpoint`
  - example: `oss-cn-hangzhou.aliyuncs.com`
- `Region`
  - example: `cn-hangzhou`
- `Bucket`
  - example: `my-share-assets`
- `Access Key`
  - your `AccessKey ID`
- `Secret Key`
  - your `AccessKey Secret`
- `Path Style`
  - usually off for Aliyun OSS
- `Set as default`
  - enable if this is your primary storage

Notes:

- `Access Key` = Aliyun `AccessKey ID`
- `Secret Key` = Aliyun `AccessKey Secret`
- prefer a RAM sub-account instead of the root account

## 3. Step 2: Create Namespaces

Go to:

- `System Management -> Namespaces`

Click:

- `New Namespace`

It is recommended to create at least two namespaces:

1. a cover namespace
2. an asset namespace

Recommended examples:

### Cover Namespace

- `Name`
  - `share-card-covers`
- `Description`
  - `card cover images`
- `Storage Config`
  - select the OSS config created above
- `Path Prefix`
  - `share/covers`
- `Max Storage`
  - optional
- `Max Files`
  - optional
- `Max File Size`
  - optional, usually smaller for covers

### Asset Namespace

- `Name`
  - `share-card-assets`
- `Description`
  - `card attachment files`
- `Storage Config`
  - select the same OSS config
- `Path Prefix`
  - `share/assets`
- `Max Storage`
  - optional
- `Max Files`
  - optional
- `Max File Size`
  - optional, usually larger for assets

Notes:

- `Path Prefix` is a logical object key prefix, not the bucket
- the bound storage config decides where the namespace actually writes

## 4. Step 3: Configure Media Storage

Go to:

- `System Management -> Media Storage`

You will see:

- `Storage Mode`
- `Local Fallback`
- `Cover Namespace`
- `Asset Namespace`

Recommended transition:

### Before switching

- `Storage Mode`: `local`
- `Local Fallback`: enabled

### Switch to OSS

- `Storage Mode`: `object_storage`
- `Local Fallback`: keep enabled
- `Cover Namespace`: select `share-card-covers`
- `Asset Namespace`: select `share-card-assets`

Then click:

- `Save Media Storage Settings`

### 4.1 Browser Direct-to-OSS Prerequisites

> Only relevant when `Storage mode` is `object_storage`.

The current `object_storage` mode uses browser direct upload to OSS: the backend returns a presign URL, the browser PUTs the file directly to OSS, and then calls the complete endpoint to persist metadata. In addition to the system management configuration, confirm the object-storage side:

- **Bucket CORS**
  - Production origin: `https://your-domain`
  - Local testing origin: `http://localhost:3002`
  - Allowed Methods: `GET`, `PUT`, `POST`, `HEAD`
  - Allowed Headers: `Content-Type`, `*`
  - Exposed Headers: `ETag`
  - Cache time: `300`
- **RAM permissions**
  - The backend RAM sub-account needs at least `oss:PutObject`, `oss:GetObject`, `oss:DeleteObject`, `oss:ListObjects`
- **IP whitelist**
  - If you restrict access with `acs:SourceIp`, whitelist both the backend server egress IP and your local development machine IP during local testing, otherwise direct uploads will return `403 AccessDenied`

See [Share Media Storage to OSS Guide](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md) for detailed examples.

## 5. Step 4: Validate the Object Pipeline

Use this order for testing.

### 5.1 Verify object upload first

Go to:

- `System Management -> Object Management`
- then click `Upload Object`

Test:

1. choose a namespace
2. upload a small file directly
3. return to the object list
4. confirm the object appears
5. click download
6. click versions
7. click presigned download

If this fails, the issue is usually:

- wrong AK/SK
- wrong endpoint
- wrong bucket
- insufficient OSS permission

### 5.2 Verify card cover upload

Create a new card with a cover.

Confirm:

- the card list shows the cover
- the card detail page previews the cover correctly

### 5.3 Verify card attachment upload

Upload one or more card attachments.

Confirm:

- upload succeeds
- download works
- detail page resources are accessible

## 6. Recommended Rollout Order

For the first OSS rollout, use this order:

1. create and verify storage config
2. create namespaces
3. upload a manual test object from object management
4. switch media storage to `object_storage`
5. upload new test cards
6. observe for a while before considering historical migration

## 7. Common Troubleshooting

### 7.1 Storage config saves, but object upload fails

Check first:

- endpoint
- bucket
- AK/SK
- OSS RAM permissions

### 7.2 Object upload works, but card cover still uses local storage

Check first:

- `System Management -> Media Storage` is actually saved as `object_storage`
- cover namespace is selected
- asset namespace is selected

### 7.3 Can old cards still work after switching to OSS

Yes, as long as:

- local files still exist
- `Local Fallback` is still enabled

### 7.4 Will editing OSS config wipe old credentials

No.

In `System Management -> Storage Config -> Edit`:

- empty `Access Key` = keep old value
- empty `Secret Key` = keep old value

### 7.5 Why does deleting a storage config say it is still in use

That is expected protection.

You need to:

1. unbind or rebind the related namespaces
2. delete the storage config afterwards

### 7.6 Direct OSS upload returns 403 AccessDenied after switching

Common causes:

- The RAM Policy `acs:SourceIp` only allows the backend server IP, not the local development machine IP
- The bucket CORS origin is wrong, e.g. local testing is missing `http://localhost:3002`
- The RAM sub-account is missing the `oss:PutObject` permission

### 7.7 Object uploads succeed but card preview returns 404

In the browser direct upload flow, if the backend does not successfully call complete, object metadata is not written to `objects` / `object_versions`, so previews return 404. Confirm:

- The frontend calls the complete endpoint after upload
- The complete endpoint returns success
- The backend version includes the object metadata finalize logic

## 8. Recommended Aliyun OSS Practice

Recommended:

- use a RAM sub-account
- scope permissions to the target bucket only
- do not use the root account AK/SK
- keep local fallback enabled during early rollout
- use separate namespaces for covers and assets

## 9. Suggested Supporting Docs

- [Minimal Production Checklist](./DEPLOY_CHECKLIST.en.md)
- [English Deployment Guide](./README.en.md)
- [Share Media Storage to OSS Guide](./backend/config/SHARE_MEDIA_STORAGE_OSS_DEPLOY.md)
- [Email Verification Guide](./backend/config/SHARE_AUTH_EMAIL_DEPLOY.md)
