"""Open the existing Laravel SQLite file with a consistent startup backup."""
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote

DATABASE = Path('/data/database.sqlite')
BACKUPS = Path('/backups')


def main():
    if not DATABASE.is_file() or DATABASE.stat().st_size == 0:
        raise SystemExit('Existing database.sqlite is missing or empty. Run the application setup first; no new database was created.')
    with DATABASE.open('rb') as stream:
        if stream.read(16) != b'SQLite format 3\x00':
            raise SystemExit('database.sqlite is not a SQLite database.')
    BACKUPS.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / f'geekcalculus-{timestamp}-{uuid4().hex[:8]}.sqlite'
    source = sqlite3.connect(f'file:{quote(str(DATABASE))}?mode=ro', uri=True, timeout=5)
    target = sqlite3.connect(backup)
    try:
        target.execute('PRAGMA synchronous=FULL')
        source.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise SystemExit('Database backup failed its integrity check; UI was not started.')
    finally:
        target.close()
        source.close()
    os.chmod(backup, 0o600)
    print(f'Consistent backup created: {backup.name}', flush=True)

    import sqlite_web.sqlite_web as web
    from peewee import SqliteDatabase

    class ManagedDatabase(SqliteDatabase):
        def __init__(self, filename, *args, **kwargs):
            # The upstream image defaults to synchronous=OFF. Require durable
            # writes and foreign-key checks for every UI database connection.
            pragmas = dict(kwargs.pop('pragmas', {}) or {})
            pragmas.update(synchronous=2, foreign_keys=1, busy_timeout=5000)
            kwargs['pragmas'] = pragmas
            if not kwargs.get('uri'):
                filename = f'file:{quote(str(filename))}?mode=rw'
                kwargs['uri'] = True
            super().__init__(filename, *args, **kwargs)

    web.SqliteDatabase = ManagedDatabase
    sys.argv = ['sqlite_web', str(DATABASE), '--host', '0.0.0.0', '--port', '8080', '--no-browser']
    if os.environ.get('SQLITE_WEB_PASSWORD'):
        sys.argv.append('--password')
    web.main()


if __name__ == '__main__':
    main()
