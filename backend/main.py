import os
import uuid
import io
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from dotenv import load_dotenv
from pypdf import PdfReader

from llm_adapter import LLMAdapter
import database

load_dotenv()

app = FastAPI(title="Kio Personal AI Agent", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    database.init_db()

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Chat"

class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    images: Optional[List[str]] = [] # Base64 image data URLs
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None

@app.get("/")
def home():
    return {"message": "Kio backend running with Vision support"}

@app.get("/health")
def health():
    return {"status": "healthy", "service": "kio-core", "database": "sqlite-ready"}

@app.get("/api/conversations")
def list_conversations():
    return database.get_conversations()

@app.post("/api/conversations")
def create_new_conversation(req: CreateConversationRequest):
    new_id = str(uuid.uuid4())[:8]
    database.create_conversation(new_id, req.title or "New Chat")
    return {"id": new_id, "title": req.title or "New Chat"}

@app.delete("/api/conversations/{conv_id}")
def remove_conversation(conv_id: str):
    database.delete_conversation(conv_id)
    return {"success": True, "deleted": conv_id}

@app.get("/api/conversations/{conv_id}/messages")
def get_conversation_history(conv_id: str):
    return database.get_messages(conv_id)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_file"
    contents = await file.read()
    extracted_text = ""

    if filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(contents))
            extracted_text = "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF reading error: {str(e)}")
    else:
        try:
            extracted_text = contents.decode("utf-8", errors="replace")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"File error: {str(e)}")

    return {"filename": filename, "size": len(contents), "text": extracted_text[:25000]}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    base_url = req.base_url or os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
    model_name = req.model or os.getenv("OMNIROUTE_MODEL", "claude-haiku-4.5")
    api_key = req.api_key or os.getenv("OMNIROUTE_API_KEY", "")

    # Save user text message to database
    database.add_message(req.conversation_id, "user", req.message)

    history = database.get_messages(req.conversation_id)

    system_prompt = (
        "You are Kio, a warm, intelligent personal AI companion for Farhan (Faru). "
        "You have full multimodal vision capabilities. When an image is provided, carefully examine and describe it, answer questions about it, or extract details cleanly and accurately. "
        "Always talk naturally, warmly, and directly."
    )

    formatted = [{"role": "system", "content": system_prompt}]
    
    # Add past text history (skip last user message since we format it with vision blocks below)
    for m in history[:-1]:
        formatted.append({"role": m["role"], "content": m["content"]})

    # Build multimodal content block for the current prompt
    current_content: List[Dict[str, Any]] = [{"type": "text", "text": req.message or "What is in this image?"}]
    if req.images:
        for img_url in req.images:
            current_content.append({
                "type": "image_url",
                "image_url": {"url": img_url}
            })

    formatted.append({"role": "user", "content": current_content})

    adapter = LLMAdapter(base_url=base_url, api_key=api_key, model=model_name)
    try:
        reply = await adapter.chat(formatted)
        database.add_message(req.conversation_id, "assistant", reply)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
