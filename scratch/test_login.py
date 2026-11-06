import urllib.request
import json

def test_login(email, password):
    data = json.dumps({'email': email, 'password': password}).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:8001/api/auth/login',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            print(f'SUCCESS: {email} -> Logged in as {res.get("user", {}).get("name")}')
    except Exception as e:
        print(f'FAILED: {email} -> {e}')

test_login('admin@cybertech.ai', 'CyberTech2026!')
test_login('evaluator@cybertech.ai', 'DemoPassword2026!')
test_login('moderator@cybertech.ai', 'Moderator2026!')
test_login('admin@sentinel.ai', 'Password123!')
