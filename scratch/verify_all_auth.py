import urllib.request
import json

def test_endpoint(url, data=None, origin='http://172.26.161.68:5173'):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8') if data else b'{}',
        headers={
            'Content-Type': 'application/json',
            'Origin': origin
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            headers = dict(resp.headers)
            res = json.loads(resp.read().decode('utf-8'))
            cors = headers.get('access-control-allow-origin')
            print(f"OK ({resp.status}) {url} | CORS Origin: {cors} | User: {res.get('user', {}).get('name')}")
    except Exception as e:
        print(f"FAILED {url}: {e}")

print("--- Testing Google Demo Auth ---")
test_endpoint('http://127.0.0.1:8001/api/auth/google/demo')

print("--- Testing Password Logins ---")
test_endpoint('http://127.0.0.1:8001/api/auth/login', {'email': 'evaluator@cybertech.ai', 'password': 'DemoPassword2026!'})
test_endpoint('http://127.0.0.1:8001/api/auth/login', {'email': 'admin@cybertech.ai', 'password': 'CyberTech2026!'})
test_endpoint('http://127.0.0.1:8001/api/auth/login', {'email': 'moderator@cybertech.ai', 'password': 'Moderator2026!'})
test_endpoint('http://127.0.0.1:8001/api/auth/login', {'email': 'admin@sentinel.ai', 'password': 'Password123!'})
