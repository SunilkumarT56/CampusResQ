import os
import socket
import urllib.request
import urllib.error
import json
from typing import Optional, List
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Network Router 1")

ROUTER_ID = os.getenv("ROUTER_ID", "router-1")


class ForwardRequest(BaseModel):
    target: str
    source: Optional[str] = ""
    payload: Optional[str] = "ping"
    hops: Optional[List[str]] = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "routerId": ROUTER_ID}


@app.get("/info")
def info() -> dict[str, str]:
    return {"id": ROUTER_ID, "name": "Router 1", "type": "ROUTER"}


@app.get("/test-direct/{target}")
def test_direct(target: str, port: int = 8000, timeout: float = 0.5) -> dict:
    """Test direct TCP connection from router to target."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((target, port))
        s.close()
        return {"source": ROUTER_ID, "target": target, "connected": True}
    except Exception as e:
        return {"source": ROUTER_ID, "target": target, "connected": False, "error": str(e)}


@app.post("/forward")
def forward(req: ForwardRequest) -> dict:
    """Router receives a message from a star spoke host and forwards it to the target host."""
    hops = list(req.hops or [])
    if not hops and req.source:
        hops.append(req.source)
    hops.append(ROUTER_ID)

    target_url = f"http://{req.target}:8000/receive"
    data = json.dumps({
        "source": req.source,
        "target": req.target,
        "hops": hops,
        "payload": req.payload,
    }).encode("utf-8")

    req_obj = urllib.request.Request(target_url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req_obj, timeout=1.5) as resp:
            resp_data = json.loads(resp.read().decode())
            return {
                "status": "routed",
                "router": ROUTER_ID,
                "source": req.source,
                "destination": req.target,
                "hops": hops + [req.target],
                "response": resp_data,
            }
    except Exception as e:
        # Fallback to health check if /receive fails
        try:
            health_url = f"http://{req.target}:8000/health"
            with urllib.request.urlopen(health_url, timeout=1.5) as resp:
                resp_data = json.loads(resp.read().decode())
                return {
                    "status": "routed",
                    "router": ROUTER_ID,
                    "source": req.source,
                    "destination": req.target,
                    "hops": hops + [req.target],
                    "response": resp_data,
                }
        except Exception as inner_e:
            return {
                "status": "routing_failed",
                "router": ROUTER_ID,
                "source": req.source,
                "destination": req.target,
                "hops": hops,
                "error": str(inner_e),
            }
