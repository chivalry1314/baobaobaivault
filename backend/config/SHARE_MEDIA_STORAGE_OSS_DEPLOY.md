# Share Media Storage to OSS Guide

This guide explains how to move `sharefrontend` card covers and card attachments from local disk storage to object storage in a controlled way.

## 1. What This Switch Does

The media storage switch only affects newly uploaded share card media:

- card cover images
- card attachment files in fixed slots

It does not automatically migrate historical local files.

Existing files continue to be read according to the storage location recorded on each card or asset row:

- old local files still read from local disk
- new OSS files read from object storage

This design allows gradual rollout and rollback.

## 2. What You Need First

Before switching media writes to OSS, prepare these pieces:

1. A working object storage provider configuration in system management
2. At least one namespace for covers
3. At least one namespace for attachments
4. Backend file read/write still available for old local files during transition

In the current implementation, media storage mode is configured in the system management UI, not in `config.yaml`.

## 3. What Still Uses Local Config

Even though media mode is not stored in YAML, these backend config fields still matter:

```yaml
storage:
  default_provider: "local"
  temp_dir: "/tmp/baobaobaivault"
  max_file_size: 10737418240
```

Notes:

- `storage.temp_dir` is used when the backend temporarily buffers uploads before sending them to object storage
- `storage.max_file_size` still limits upload size behavior in the backend
- keep local backend storage mounted during rollout if you enable local fallback for historical files

## 4. Recommended Rollout Order

Recommended production order:

1. Keep the current local storage deployment unchanged
2. Add and verify your object storage config in `System Management -> Storage Config`
3. Create namespaces in `System Management -> Namespaces`
4. Open `System Management -> Media Storage`
5. Keep `Local fallback` enabled
6. Switch `Storage mode` from `local` to `object_storage`
7. Select:
   - one namespace for covers
   - one namespace for attachments
8. Save the settings
9. Upload a few new test cards and verify:
   - cover preview works
   - attachment download works
   - old cards still open correctly

## 5. Recommended Namespace Design

A practical layout is:

- cover namespace:
  - dedicated to smaller image files
  - can have stricter size limits
- attachment namespace:
  - used for share card slot files
  - can allow larger file sizes

You can use:

- separate namespaces on the same bucket
- or separate buckets or storage configs if your operations model prefers that

## 6. Current Backend Behavior

Current implementation behavior:

- new uploads write according to `System Management -> Media Storage`
- old records are read according to each row's recorded storage backend
- local files can still be used as fallback when enabled
- public media URLs remain unchanged
- frontend direct-to-OSS upload is not enabled yet
- downloads and previews are still streamed by the backend

That means you do not need to change share card URLs after switching.

## 7. System Page Fields

The new page is:

- `/system/media-storage`

Fields:

- `Storage mode`
  - `local`: new uploads keep writing to local disk
  - `object_storage`: new uploads write to object storage
- `Local fallback`
  - recommended `enabled` during migration period
  - allows old local files to continue serving if needed
- `Cover namespace`
  - namespace used for newly uploaded card covers
- `Asset namespace`
  - namespace used for newly uploaded card attachments

## 8. Rollback Strategy

If you want to stop writing new media to OSS:

1. Return to `System Management -> Media Storage`
2. Change `Storage mode` back to `local`
3. Save

Result:

- new uploads go back to local disk
- previously uploaded OSS files still remain readable
- historical local files are unaffected

This is possible because storage location is recorded per file row.

## 9. Deployment Notes

During the mixed local + OSS stage, keep these in place:

- backend local storage volume mount
- object storage config and credentials
- namespaces used by media storage

Do not remove local storage volume immediately after switching to OSS, because:

- historical local files may still exist
- rollback may require local writes again
- fallback reads may still be needed

## 10. Suggested Verification Checklist

After enabling object storage mode, verify all of the following:

1. Create a new card with a cover
2. Create a new card bundle with attachments
3. Open card detail page and preview the cover
4. Download one attachment
5. Reopen an old card created before the switch
6. Delete and replace one cover
7. Delete and replace one attachment

If all seven steps work, the first rollout is usually safe.

## 11. Historical File Migration

This first-stage implementation does not migrate historical local files automatically.

If you later want full migration, the next phase should include:

1. scan old local share card media rows
2. upload them to object storage
3. backfill storage backend / namespace / object key fields
4. verify media reads
5. optionally remove old local files in batches

It is safer to do that as a dedicated migration tool, not during normal upload requests.
