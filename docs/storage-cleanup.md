# Storage cleanup

Files in Supabase Storage were never deleted, so deleted cases, replaced avatars and retried uploads
kept counting against the Free plan's 1 GB. A file is only treated as unused when no text, array or
JSON column in the public schema links to it and it is more than 7 days old.

## Apply

1. Run `supabase/migrations/202610070002_storage_cleanup.sql` in the Supabase SQL Editor.
2. Deploy the application. Deleting a case from the profile screen now also deletes its images,
   except images something else still links to, such as a Live Aunt Minnie prompt.

## Remove files left behind

The script needs the project's service role (secret) key. Copy it from Project Settings → API Keys
into the current terminal session only. Never save it in `.env.local` or commit it.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = '<service role key>'
node --env-file=.env.local scripts/storage-cleanup.mjs
```

This is a dry run. It prints storage used per bucket and writes the full list of unused files to
`security-artifacts.local/`. Review the list, then run the delete command it prints, which includes
a fingerprint of that exact list. If anything changed in between, the script stops without deleting.

Only image buckets are cleaned by default. Add `--include-records` to also clean endorsement and
census attachments. Deleted files cannot be recovered, so download anything you want to keep first.
