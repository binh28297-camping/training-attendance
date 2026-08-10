# Training Attendance — Netlify Project

This project implements the attendance flow discussed:

- Reception gives each teacher an unused 8-digit code.
- The first time a code is used, the teacher enters their full name.
- The code then becomes permanently linked to that teacher.
- For later sessions, the teacher only enters the same 8-digit code.
- A code can check in only once per session.
- Admin can create/switch sessions, generate code batches, view attendance, and export CSV files that open in Excel.
- The check-in QR can stay the same because it points to `/`.

## Important security model

The system is designed so that the QR does not identify a teacher. The 8-digit code identifies the participant after first registration.

If Teacher A sends the QR to Teacher B, B cannot use A's code because the code is already linked to A. If B has not registered a code yet, B still needs a valid unused code from reception.

For a stronger anti-sharing setup, GPS or an on-site Wi-Fi check can be added later.

## Deploy to Netlify

1. Create a new Netlify site from this folder/repository.
2. Set these environment variables in Netlify:
   - `ADMIN_PASSWORD` — choose a strong admin password.
   - `SESSION_SECRET` — choose a long random secret string.
3. Deploy.
4. Open `/admin.html`.
5. Log in.
6. Create the first session.
7. Generate a batch of 8-digit codes.
8. Download/print the codes and give one code to each teacher.
9. Display the QR generated in the Admin page. It points to the site's home page.
10. Teachers scan the QR and check in.

## Important note about Excel

The export buttons produce CSV files. Excel opens CSV directly. This avoids requiring a separate spreadsheet service.

## First registration

If code `38172946` is unused/unregistered:
- Teacher enters name + code.
- The server stores the association:
  `38172946 -> Teacher Name`

Later:
- Teacher enters only `38172946`.
- The system retrieves the stored name.
- The teacher cannot change the name associated with the code.

## Session behavior

Create a new session in Admin before each training session. The same teacher code can then be used again in the new session.

Example:
- Session 01: code 38172946 -> present
- Session 02: code 38172946 -> present
- Session 02 second attempt -> rejected

## Current limitations

- This starter version uses Netlify Blobs as storage.
- For very large/high-stakes deployments, a relational database with transactional uniqueness is preferable.
- Admin authentication is a simple environment-password/token scheme; use HTTPS and a strong secret.


## v2 additions

- Admin page now has a visible Used / Unused code table.
- Downloadable code-list CSV includes status and teacher name.
- `Reset Current Session` deletes only attendance for the active session and keeps code-to-teacher registrations.
- `Reset Everything` deletes all codes, registrations, attendance, and the active session. It requires typing `RESET ALL`.
- A sample CSV file `sample-code-list.csv` is included so you can see the intended code list format.


## Final v3 setup

Only one Netlify environment variable is required: `ADMIN_PASSWORD`. No `SESSION_SECRET` is needed.
