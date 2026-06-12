import urllib.request
import json

BASE_URL = "http://localhost:8000"

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

print("Testing /api/github-mcp response wrapping...")
payload = {
    "method": "tools/call",
    "params": {
        "name": "list_repositories",
        "arguments": {}
    }
}
resp = post(f"{BASE_URL}/api/github-mcp", payload)
print("Response:", resp)

# Assert that github_result wrapper exists
assert "github_result" in resp, "Response must contain 'github_result' key"
print("Verification passed! Wrapped key is present.")
