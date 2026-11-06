import sqlite3
import sys
import os
import uuid
from datetime import datetime

sys.path.insert(0, os.path.abspath('sentinel-backend'))
from app.core.security import hash_password

users_to_seed = [
    ('admin@cybertech.ai', 'Lead Administrator', 'CyberTech2026!', 'admin', 'local'),
    ('evaluator@cybertech.ai', 'Faculty Evaluator', 'DemoPassword2026!', 'admin', 'local'),
    ('moderator@cybertech.ai', 'Safety Moderator', 'Moderator2026!', 'moderator', 'local'),
    ('admin@sentinel.ai', 'Platform Administrator', 'Password123!', 'admin', 'local'),
    ('demo@sentinel.ai', 'Demo Moderator', 'Password123!', 'moderator', 'local'),
    ('test@sentinel.ai', 'Test User', 'Password123!', 'moderator', 'local'),
    ('evaluator.google@cybertech.ai', 'Dr. Rajesh Kumar (Faculty Evaluator)', '', 'admin', 'google'),
]

for db_path in ['sentinel.db', 'sentinel-backend/sentinel.db']:
    if not os.path.exists(db_path):
        continue
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cols = [c[1] for c in cur.execute('PRAGMA table_info(users)').fetchall()]
    if 'auth_provider' not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local'")
    if 'google_id' not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN google_id VARCHAR(100)")
    
    for email, name, pwd, role, auth_prov in users_to_seed:
        hp = hash_password(pwd) if pwd else ''
        existing = cur.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            cur.execute(
                'UPDATE users SET name = ?, hashed_password = ?, role = ?, auth_provider = ?, is_active = 1 WHERE email = ?',
                (name, hp, role, auth_prov, email)
            )
        else:
            cur.execute(
                'INSERT INTO users (id, email, name, hashed_password, preferred_language, role, is_active, auth_provider, google_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (str(uuid.uuid4()), email, name, hp, 'en', role, 1, auth_prov, None if auth_prov != 'google' else 'google-demo-id-123456', datetime.utcnow().isoformat())
            )
    conn.commit()
    print(f'Successfully updated users in {db_path}')
    all_users = cur.execute('SELECT email, role, auth_provider FROM users').fetchall()
    print('Current users:', len(all_users))
    conn.close()
