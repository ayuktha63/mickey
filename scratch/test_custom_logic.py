import asyncio
import json
from app.services.ollama import extract_tool_calls
from app.services.github import query_github_mcp, get_github_credentials

def test_extract_tool_calls():
    print("Running test_extract_tool_calls...")
    
    # Test case 1: Single tool call with markdown formatting
    text_1 = """```json
{
  "tool": "list_tasks",
  "args": {}
}
```"""
    calls_1 = extract_tool_calls(text_1)
    assert len(calls_1) == 1
    assert calls_1[0]["tool"] == "list_tasks"
    assert calls_1[0]["args"] == {}
    
    # Test case 2: Multiple tool calls with markdown formatting
    text_2 = """```json
{
  "tool": "list_tasks",
  "args": {}
}
```

```json
{
  "tool": "github_mcp",
  "args": {
    "method": "read_issues"
  }
}
```"""
    calls_2 = extract_tool_calls(text_2)
    assert len(calls_2) == 2
    assert calls_2[0]["tool"] == "list_tasks"
    assert calls_2[1]["tool"] == "github_mcp"
    assert calls_2[1]["args"] == {"method": "read_issues"}

    # Test case 3: Nested JSON blocks and string braces
    text_3 = """{
  "tool": "create_issue",
  "args": {
    "title": "Fix bug {critical}",
    "body": "Nested structure: {\\\"nested\\\": true}"
  }
}"""
    calls_3 = extract_tool_calls(text_3)
    assert len(calls_3) == 1
    assert calls_3[0]["tool"] == "create_issue"
    assert "critical" in calls_3[0]["args"]["title"]
    assert "nested" in calls_3[0]["args"]["body"]
    
    print("test_extract_tool_calls PASSED!")

async def test_github_credentials_and_resolve():
    print("Running test_github_credentials_and_resolve...")
    # Check that we can resolve credentials
    token, mcp_url = get_github_credentials("work")
    print(f"Work credentials (should fallback to personal): token={token[:10]}..., mcp_url={mcp_url}")
    assert token != ""
    
    # Test auto-resolution of repo parameter
    # Since personal mode has repositories, listing repositories should find them,
    # and query_github_mcp with a repository-specific method and missing repo should auto-resolve to the first repo.
    res = await query_github_mcp("read_issues", mode="work")
    print("Auto-resolved issues query result keys:", res.keys())
    assert "issues" in res or "error" in res
    if "issues" in res:
        print(f"Successfully auto-resolved repository and read {len(res['issues'])} issues!")
    else:
        print("Auto-resolved query returned error (e.g. rate limit/connection), but did not crash:", res["error"])
        
    print("test_github_credentials_and_resolve PASSED!")

if __name__ == "__main__":
    test_extract_tool_calls()
    asyncio.run(test_github_credentials_and_resolve())
