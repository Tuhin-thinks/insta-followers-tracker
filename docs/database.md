# Database Schema

Complete SQLite database schema, design decisions, and query patterns.

## Database Overview

The application uses SQLite for persistent storage of scan history, follower data, diffs, and image cache metadata.

**Database File:** `data/app.db`

## Tables

### accounts

Legacy table for individual account records (currently unused for new features).

```sql
CREATE TABLE IF NOT EXISTS accounts (
    profile_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    create_date TEXT NOT NULL,
    is_private INTEGER NOT NULL,
    is_follower INTEGER NOT NULL,
    is_following INTEGER NOT NULL,
    reference_profile_id TEXT NOT NULL
);
```

| Column                 | Type    | Notes                           |
| ---------------------- | ------- | ------------------------------- |
| `profile_id`           | TEXT    | Instagram user ID (PRIMARY KEY) |
| `username`             | TEXT    | Instagram username              |
| `reference_profile_id` | TEXT    | Foreign key to scanned profile  |
| `is_private`           | INTEGER | 0 = public, 1 = private         |
| `is_follower`          | INTEGER | Currently unused                |
| `is_following`         | INTEGER | Currently unused                |

---

### scan_history

Metadata for each follower scan performed.

```sql
CREATE TABLE IF NOT EXISTS scan_history (
    scan_id TEXT PRIMARY KEY,
    app_user_id TEXT NOT NULL,
    reference_profile_id TEXT NOT NULL,
    scan_time TEXT NOT NULL
);
```

| Column                 | Type | Notes                                |
| ---------------------- | ---- | ------------------------------------ |
| `scan_id`              | TEXT | Unique scan identifier (PRIMARY KEY) |
| `app_user_id`          | TEXT | App user who ran the scan            |
| `reference_profile_id` | TEXT | Instagram profile being scanned      |
| `scan_time`            | TEXT | ISO 8601 timestamp                   |

**Indexes:**

```sql
-- Find latest scan for a profile
SELECT * FROM scan_history
WHERE reference_profile_id = ?
ORDER BY scan_time DESC
LIMIT 1;
```

---

### scanned_data

Individual follower records captured in each scan.

```sql
CREATE TABLE IF NOT EXISTS scanned_data (
    scan_id TEXT NOT NULL,
    app_user_id TEXT NOT NULL,
    reference_profile_id TEXT NOT NULL,
    fbid_v2 TEXT,
    full_name TEXT,
    profile_id TEXT,
    is_private INTEGER,
    is_verified INTEGER,
    profile_pic_id TEXT,
    profile_pic_url TEXT,
    username TEXT
);
```

| Column            | Type    | Notes                          |
| ----------------- | ------- | ------------------------------ |
| `scan_id`         | TEXT    | Foreign key to scan_history    |
| `profile_id`      | TEXT    | Follower's Instagram user ID   |
| `username`        | TEXT    | Follower's username            |
| `full_name`       | TEXT    | Follower's display name        |
| `fbid_v2`         | TEXT    | Internal Instagram ID          |
| `profile_pic_id`  | TEXT    | Profile picture ID             |
| `profile_pic_url` | TEXT    | URL to profile picture         |
| `is_private`      | INTEGER | 0 = public, 1 = private        |
| `is_verified`     | INTEGER | 0 = not verified, 1 = verified |

**Indexes:**

```sql
-- Find all followers in a scan
SELECT profile_id FROM scanned_data WHERE scan_id = ?;

-- Batch retrieve follower details
SELECT * FROM scanned_data
WHERE scan_id = ? AND profile_id IN (?, ?, ...);
```

---

### diff_records

Summary of changes between two scans.

```sql
CREATE TABLE IF NOT EXISTS diff_records (
    diff_id TEXT PRIMARY KEY,
    app_user_id TEXT NOT NULL,
    previous_scan_id TEXT NOT NULL,
    current_scan_id TEXT NOT NULL,
    reference_profile_id TEXT NOT NULL,
    follower_count INTEGER NOT NULL,
    unfollower_count INTEGER NOT NULL,
    diff_file_path TEXT NOT NULL,
    create_date TEXT NOT NULL
);
```

| Column                 | Type    | Notes                                      |
| ---------------------- | ------- | ------------------------------------------ |
| `diff_id`              | TEXT    | Unique diff identifier (PRIMARY KEY)       |
| `app_user_id`          | TEXT    | App user                                   |
| `previous_scan_id`     | TEXT    | Earlier scan (can be empty for first scan) |
| `current_scan_id`      | TEXT    | Latest scan                                |
| `reference_profile_id` | TEXT    | Instagram profile being analyzed           |
| `follower_count`       | INTEGER | Count of new followers                     |
| `unfollower_count`     | INTEGER | Count of unfollowers                       |
| `diff_file_path`       | TEXT    | Path to JSON file with full diff           |
| `create_date`          | TEXT    | ISO 8601 timestamp                         |

**Indexes:**

```sql
-- Find latest diff for a profile
SELECT * FROM diff_records
WHERE reference_profile_id = ?
ORDER BY create_date DESC
LIMIT 1;
```

---

### image_cache

Metadata for cached profile pictures.

```sql
CREATE TABLE IF NOT EXISTS image_cache (
    profile_id TEXT NOT NULL,
    image_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    create_date TEXT NOT NULL
);
```

| Column        | Type | Notes                                                         |
| ------------- | ---- | ------------------------------------------------------------- |
| `profile_id`  | TEXT | Follower's Instagram user ID                                  |
| `image_id`    | TEXT | Hash-based ID combining profile_id + image hash (PRIMARY KEY) |
| `url`         | TEXT | Original Instagram URL                                        |
| `local_path`  | TEXT | Disk location of cached image                                 |
| `create_date` | TEXT | ISO 8601 timestamp                                            |

**Design Notes:**

- `image_id` = `{profile_id}_{url_hash[:16]}`
- Allows multiple images per profile (pic changes)
- Enables tracking picture updates without losing old caches

**Indexes:**

```sql
-- Find cached image for a profile
SELECT local_path FROM image_cache WHERE profile_id = ?;

-- Find specific image by hash
SELECT * FROM image_cache WHERE image_id = ?;
```

---

### profile_audience_events

Event tracking for profile changes (currently unused).

```sql
CREATE TABLE IF NOT EXISTS profile_audience_events (
    profile_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    create_date TEXT NOT NULL,
    event_data TEXT
);
```

| Column       | Type | Notes              |
| ------------ | ---- | ------------------ |
| `profile_id` | TEXT | Profile affected   |
| `event_type` | TEXT | Type of event      |
| `event_data` | TEXT | JSON event details |

---

## Data Flow & Queries

### Scanning Flow

```
1. Create scan_history entry
   INSERT INTO scan_history (scan_id, app_user_id, reference_profile_id, scan_time)
   VALUES (?, ?, ?, CURRENT_TIMESTAMP);

2. Insert follower records
   INSERT INTO scanned_data (scan_id, app_user_id, ..., username, ...)
   VALUES (?, ?, ..., ?, ...);

3. Fetch previous scan
   SELECT scan_id FROM scan_history
   WHERE reference_profile_id = ? AND scan_id != ?
   ORDER BY scan_time DESC LIMIT 1;

4. Compute diff
   SELECT profile_id FROM scanned_data WHERE scan_id = ?;
   -- Compare sets to find new/unfollowers

5. Insert diff record
   INSERT INTO diff_records (...) VALUES (...);
```

### Diff Computation

```sql
-- New followers = current - previous
SELECT * FROM scanned_data sd1
WHERE sd1.scan_id = ? AND NOT EXISTS (
    SELECT 1 FROM scanned_data sd2
    WHERE sd2.scan_id = ? AND sd2.profile_id = sd1.profile_id
);

-- Unfollowers = previous - current
SELECT * FROM scanned_data sd1
WHERE sd1.scan_id = ? AND NOT EXISTS (
    SELECT 1 FROM scanned_data sd2
    WHERE sd2.scan_id = ? AND sd2.profile_id = sd1.profile_id
);
```

### Image Caching

```sql
-- Cache image reference
INSERT OR REPLACE INTO image_cache
(profile_id, image_id, url, local_path, create_date)
VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);

-- Retrieve cached image
SELECT local_path FROM image_cache
WHERE profile_id = ? LIMIT 1;

-- Find all images for profile (multiple pics)
SELECT * FROM image_cache WHERE profile_id = ?;
```

---

## Directory Structure

Complementing the database, disk storage:

```
data/
├── app.db                          # Main SQLite database
├── diffs/
│   └── {reference_profile_id}_{scan_id}_diff.json
├── scans/
│   └── {reference_profile_id}/
│       └── {scan_id}.jsonl
├── image_cache/
│   └── {profile_id}_{hash}.jpg
└── users/
    ├── app_users.json              # App user metadata
    └── {app_user_id}/
        ├── instagram_users.json    # Instagram accounts
        ├── state.json              # User session state
        └── profiles/
            └── {profile_id}/
                ├── data/
                └── scans/
```

---

## Performance Characteristics

| Operation             | Typical Time | Row Estimate   |
| --------------------- | ------------ | -------------- |
| Insert 5K followers   | 50ms         | 5,000 rows     |
| Compute diff          | 100ms        | Set operations |
| Count followers       | 10ms         | COUNT(\*)      |
| Batch fetch followers | 30ms         | 100-1000 rows  |

---

## Maintenance

### Export Data

```bash
# Dump database
sqlite3 data/app.db .dump > backup.sql

# Export table as CSV
sqlite3 data/app.db "SELECT * FROM scanned_data;" | \
  tr '|' ',' > followers.csv
```

### Query Database Directly

```bash
sqlite3 data/app.db

# List tables
.tables

# Schema for table
.schema scanned_data

# Count followers in latest scan
SELECT COUNT(*) FROM scanned_data WHERE scan_id = '...';

# Find followers who followed between two scans
SELECT sd1.* FROM scanned_data sd1
WHERE sd1.scan_id = 'scan_new'
  AND NOT EXISTS (
    SELECT 1 FROM scanned_data sd2
    WHERE sd2.scan_id = 'scan_old'
      AND sd2.profile_id = sd1.profile_id
  );
```

### Cleanup

```python
# Delete old scans (keep last 50)
import sqlite3
conn = sqlite3.connect('data/app.db')
cursor = conn.cursor()

cursor.execute("""
    DELETE FROM scanned_data WHERE scan_id IN (
        SELECT scan_id FROM scan_history
        WHERE reference_profile_id = ?
        ORDER BY scan_time DESC
        LIMIT -1 OFFSET 50
    )
""", (profile_id,))

conn.commit()
conn.close()
```

---

## Design Decisions

### Why Separate scanned_data and diff_records?

- **scanned_data**: Raw snapshot of each scan (immutable history)
- **diff_records**: Computed deltas (for quick trending)

Allows efficient re-computation and debugging.

### Why image_id vs just profile_id?

- **Single image per profile**: Fast lookup, latest picture
- **Multiple images per profile**: Detect picture changes, track history

Using `image_id` with hash enables both patterns.

### Why store diff as JSON file?

- Full diff details (all fields) can be large
- JSON format is human-readable
- Can be archived or deleted independently
- DB record just stores reference

### Thread Safety

SQLite is single-writer by default. The backend uses thread-local connections:

```python
_thread_local = threading.local()

def get_worker_db():
    existing = getattr(_thread_local, "db", None)
    if existing:
        return existing
    _thread_local.db = SqliteDBHandler(path)
    return _thread_local.db
```

This prevents connection conflicts in concurrent scans.

---

Next: [Backend API](backend.md) or [Development](development.md)
