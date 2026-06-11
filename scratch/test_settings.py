import urllib.request
import json

BASE_URL = "http://localhost:8000"

def get(url, headers=None):
    req = urllib.request.Request(url, method="GET")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def post(url, body, headers=None):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=data, 
        method="POST"
    )
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

print("1. Updating settings in 'work' mode...")
payload = {
    "system_name": "MickeyTest",
    "assistant_name": "CookieTest"
}
res = post(f"{BASE_URL}/api/settings", payload, headers={"X-Workspace-Mode": "work"})
print("Save response in work mode:", res)

print("\n2. Fetching settings in 'work' mode...")
work_settings = get(f"{BASE_URL}/api/settings", headers={"X-Workspace-Mode": "work"})
print("Work mode system_name:", work_settings.get("system_name"))
print("Work mode assistant_name:", work_settings.get("assistant_name"))

print("\n3. Fetching settings in 'personal' mode...")
personal_settings = get(f"{BASE_URL}/api/settings", headers={"X-Workspace-Mode": "personal"})
print("Personal mode system_name:", personal_settings.get("system_name"))
print("Personal mode assistant_name:", personal_settings.get("assistant_name"))
