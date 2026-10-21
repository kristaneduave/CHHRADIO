# Archive cases to Google Drive

Archiving a case keeps its PDF export in the department Google Drive and removes the case's images
from Supabase Storage. The case text stays in the app. Images that something else still uses, such
as a quiz or Live Aunt Minnie prompt built from the case, are kept. Archive PDFs use resized JPEG
images (up to 2000 px); if any image cannot be loaded, that case is not archived.

The PDFs contain patient details (initials, age, sex). Keep the Drive folder private to the
department account; do not share it with "Anyone with the link".

## Without any Google setup (manual upload)

Only needs the database step below.

1. **Profile → Archive Cases to Drive** (admins only). Optionally set **Uploaded up to**, then
   **Select all**.
2. **Save PDFs to a folder** and choose an empty folder on this computer (Chrome or Edge; other
   browsers download the files one by one). Files are named `upload-date title (case-id).pdf`.
3. Upload that folder to the department Google Drive and open a few PDFs to check them.
4. Back in the app, **Remove images of N saved cases**. Those cases then show "Images archived" and
   the PDF's file name, so staff can find it in Drive.

Keep the tab open while it runs. Saved-but-not-removed cases keep their images; if you close the
page, select them again and save again before removing.

## Direct upload to Drive (optional)

Steps 2–4 below connect the app to the department Drive so PDFs upload by themselves, owners can
archive their own cases, and **Export PDF** downloads the archived copy. Turn it on by also setting
`VITE_CASE_DRIVE_ARCHIVE=on` in Vercel.

## 1. Database

In the Supabase SQL Editor, run in this order:

1. `supabase/migrations/202610070002_storage_cleanup.sql` (if not applied yet)
2. `supabase/migrations/202610210001_case_drive_archive.sql`

The second one uses `public.is_admin()`. If it fails because that function does not exist, stop
and check the role setup before going further.

## 2. Google Cloud (signed in as the department Google account)

1. Go to https://console.cloud.google.com and create a project, for example "CHH Radiology Archive".
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose **Internal** if the department account is
   Google Workspace, otherwise **External**. Fill in the app name and contact email. Add the scope
   `.../auth/drive.file`.
4. If you chose External, set **Publishing status** to **In production**. In "Testing" mode Google
   expires the sign-in after 7 days and archiving stops working. The `drive.file` scope does not
   need Google's review.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app**.
   Copy the client ID and client secret.

## 3. Connect the department Drive

In a terminal in this project (PowerShell):

```powershell
$env:GOOGLE_DRIVE_CLIENT_ID = '<client id>'
$env:GOOGLE_DRIVE_CLIENT_SECRET = '<client secret>'
node scripts/google-drive-setup.mjs
```

Open the printed link and sign in with the **department** account. Google may warn that the app
is unverified: choose **Advanced → Go to ...** (it is your own app). The script creates the folder
"CHH Radiology Case Archive" and prints four values. Nothing is saved to disk.

## 4. Vercel

In Vercel → Project → Settings → Environment Variables (Production), add:

| Name | Value |
|---|---|
| `GOOGLE_DRIVE_CLIENT_ID` | from step 2 |
| `GOOGLE_DRIVE_CLIENT_SECRET` | from step 2 |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | printed by the script |
| `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID` | printed by the script |

Also add `VITE_CASE_DRIVE_ARCHIVE` = `on`, then deploy the application.

## 5. Try one case first

1. Open a case with images and choose **Archive to Google Drive**.
2. Check the PDF appears in the Drive folder and opens with every image.
3. Back in the app, **Download archived PDF** should give the same file.
4. In Supabase → Storage, the case's images should be gone.

Then archive in bulk from **Profile → Archive Cases to Drive**. Keep the tab open until it finishes.
A case that fails keeps its images and can be retried.

## Troubleshooting

- *"Case archiving is not set up yet."*: a Vercel variable is missing; add it and redeploy.
- *"Google Drive refused the department account."*: the sign-in expired or was revoked (often the
  7-day "Testing" limit). Fix step 2.4, run step 3 again and update `GOOGLE_DRIVE_REFRESH_TOKEN`.
- *"Some images could not be removed yet"*: the case is archived; `scripts/storage-cleanup.mjs`
  removes the leftover files later.
