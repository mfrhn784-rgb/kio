import httpx
from typing import Optional, Dict, Any

class LLMAdapter:
    def __init__(self, base_url: str = "http://localhost:11434/v1", api_key: Optional[str] = None, model: str = "llama3"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or "ollama"
        self.model = model

    async def test_connection(self) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        test_url = f"{self.base_url}/models"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(test_url, headers=headers)
                if res.status_code == 200:
                    return {"success": True, "message": f"Connected to {self.base_url}"}
                else:
                    return {"success": False, "message": f"HTTP {res.status_code}: {res.text[:100]}"}
        except httpx.ConnectError:
            return {
                "success": False, 
                "message": f"Cannot connect to {self.base_url}. Is your local model (e.g. Ollama) running?"
            }
        except Exception as e:
            return {"success": False, "message": str(e)}

    async def chat(self, messages: list) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if res.status_code != 200:
                raise Exception(f"Provider Error {res.status_code}: {res.text}")
            data = res.json()
            return data["choices"][0]["message"]["content"]
