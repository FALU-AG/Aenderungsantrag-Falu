# Production rollout and Change Request cleanup

This runbook removes the pre-rollout Change Request test population. It does **not** remove users, roles, authentication data, master data, application settings, approval delegations, unrelated audit history, or unrelated notifications.

## Data classification

| Class | Models/data | Treatment |
| --- | --- | --- |
| Transactional test data | `ChangeRequest`, `ChangeRequestMachineType`, `ChangeRequestReason`, `Approval`, `FinalApproval`, `TechnicalReview`, `AvorImpactReview`, `PurchasingReview`, `Task`, `Attachment`, `Comment`, request-linked `AuditEvent`, request/task-linked `EmailNotification`, and the completion/closing text stored on `ChangeRequest` | Deleted for every Change Request shown by the reviewed dry run |
| Master/configuration | `MachineType`, `ChangeReason`, `AppSetting` | Preserved |
| User/role/auth | `User`, `Role`, `UserRole`, `Session`, `PasswordResetToken`, `ApprovalDelegation` | Preserved. `User.externalId` remains the central-portal/SSO mapping; local users remain required by application relations and history. |
| Ambiguous/unowned | `AuditEvent` without a Change Request, `EmailNotification` without a Change Request or Task, unreferenced Storage objects, and `ChangeRequestCounter` rows for other years | Preserved and reported; never deleted automatically |

The cleanup deliberately selects all Change Requests in the database. It is suitable only for the controlled pre-go-live database after the dry-run list has been confirmed as test data. Never execute it after real requests have entered the system.

## Safety model

- Dry run is the default and performs no writes or Storage removal.
- Execution requires both `--execute` and the exact environment confirmation `PRODUCTION_CLEANUP_CONFIRM=DELETE_ALL_CHANGE_REQUESTS`.
- Every stored attachment key is validated against its exact request and attachment identifiers before any mutation.
- Supabase objects are removed only by their private, database-recorded key. Local objects are removed only by a validated basename through the existing attachment storage layer.
- Storage is processed before the database transaction so database rows are never deleted when an object cannot be removed. A partial Storage failure is reported explicitly; no database transaction starts. Already removed objects must be accounted for before retrying.
- Database deletion uses one serializable transaction, checks that the complete request snapshot has not changed, deletes children in foreign-key-safe order, verifies the exact request count, and only then resets numbering.
- After commit, the command verifies that no requests remain, the user count is unchanged, and the current-year counter is `1`.
- The command does not print secrets, credentials, signed URLs, or attachment contents.

## Numbering

Request numbers use the Zurich calendar year and the custom `ChangeRequestCounter.nextNumber` row, not a PostgreSQL sequence. The cleanup preserves counter rows for other years. For the current year it proposes and, only during guarded execution, sets `nextNumber` to `1` after proving that zero Change Requests remain. The next request is therefore `CR-<current year>-001`. Existing numbers are never reused while any request remains because the counter reset is refused in that state.

## Rollout procedure

### 1. Backup/checkpoint

1. Stop or block Change Request creation for the maintenance window.
2. Create and verify a restorable PostgreSQL backup/checkpoint.
3. Record the Supabase project and private attachment bucket, and ensure Storage recovery or backup is available.
4. Confirm the deployed revision contains this cleanup command.

### 2. Dry run

Run against the linked Railway production environment:

```powershell
railway run npm run production:cleanup -- --dry-run
```

The command is also dry-run-only when invoked without arguments. Save the output with the rollout evidence.

### 3. Review

Confirm all of the following before proceeding:

- Every listed request is test data and the count is expected.
- Dependent counts are plausible for approvals, reviews, tasks, comments, attachments, audit events, and notifications.
- Every listed Storage key belongs to a listed request.
- The preserved user count and SSO mapping indicators are plausible.
- Machine types, reasons, settings, roles, and delegations are listed as preserved.
- Ambiguous/unowned records have been reviewed and are intentionally retained.
- The proposed current-year counter is `1` and the proposed first number is correct.

If any item is uncertain, stop. Do not execute and do not manually delete rows.

### 4. Execute cleanup

Only after backup and dry-run approval:

```powershell
$env:PRODUCTION_CLEANUP_CONFIRM = "DELETE_ALL_CHANGE_REQUESTS"
railway run npm run production:cleanup -- --execute
```

Unset the confirmation immediately afterward:

```powershell
Remove-Item Env:PRODUCTION_CLEANUP_CONFIRM
```

Do not run this command while application users can create or update requests.

### 5. Storage verification

- Confirm the execution report states that all database-referenced attachment objects were removed.
- Verify the exact reported paths are absent from the private bucket.
- Do not bulk-delete the bucket or any unreferenced object; investigate those separately.
- If Storage removal partially fails, the database remains unchanged. Preserve the error output, resolve access/object issues, verify already removed paths, and run a new dry run before retrying.

### 6. Database integrity verification

- Run the command again in dry-run mode and confirm zero Change Requests and zero request-owned dependent records.
- Confirm users, role assignments, sessions, central `externalId` mappings, approval delegations, machine types, change reasons, and settings remain.
- Confirm no unrelated audit events or notifications were removed.
- Review application and database logs for integrity or Storage errors.

### 7. Numbering verification

- Confirm the dry-run report shows current-year `nextNumber: 1` and proposed first number `CR-<year>-001`.
- Do not edit PostgreSQL sequences; request numbering does not use one.

### 8. Final controlled workflow test

Before admitting real production traffic:

1. Create one clearly identified final test request and confirm it receives `CR-<year>-001`.
2. Verify attachments, both initial approvals, reviews, tasks, notifications, final approval, closure, and authenticated downloads through the complete workflow.
3. Keep creation blocked for everyone else.
4. Run a fresh cleanup dry run and confirm the final test request is the **only** request listed.
5. With a fresh backup and explicit approval, repeat the guarded cleanup execution to remove that final test request and its artifacts. Never repeat the cleanup if any real request exists.
6. Confirm the counter is again `1`; the first real request will receive `CR-<year>-001`.

### 9. Final readiness check

- Application health, login/SSO, authorization, private attachments, OpenAI features, Slack/email delivery, and scheduled jobs are operational.
- No Change Requests or request-owned Storage objects remain.
- Users and application roles are intact.
- Master/configuration data is intact.
- Current-year numbering is ready at `1`.
- Maintenance restrictions can be removed and company-wide use can begin.

## Recovery and stop conditions

Stop rollout on any Storage failure, database error, snapshot-change error, unexpected request, unexpected user/master-data count, or failed post-cleanup verification. Do not compensate with manual destructive SQL. Preserve logs, restore from the verified checkpoint when necessary, and investigate before another dry run.
