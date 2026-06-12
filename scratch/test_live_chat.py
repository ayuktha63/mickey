import asyncio
import httpx

async def main():
    print("Sending live chat request to http://localhost:8000/api/chat...")
    url = "http://localhost:8000/api/chat"
    payload = {
        "message": "waht are my todo and any github updates?",
        "conversation_id": None,
        "model_name": None
    }
    headers = {
        "x-workspace-mode": "work"
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                print(f"Status Code: {response.status_code}")
                async for chunk in response.aiter_text():
                    print(chunk, end="", flush=True)
                print()
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
