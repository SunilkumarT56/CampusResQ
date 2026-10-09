import os
import socket
import urllib.request
import urllib.error
import json
from typing import Optional, List
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Network Router Host Agent")

HOST_ID = os.getenv("HOST_ID", "host-unknown")
HOST_NAME = os.getenv("HOST_NAME", "Unknown Host")
PRIORITY = os.getenv("PRIORITY", "LOW")

# Ring order: host-1 <-> host-2 <-> host-3 <-> host-4 <-> host-5 <-> host-1
RING_ORDER = ["host-1", "host-2", "host-3", "host-4", "host-5"]


def get_ring_next_hop(current: str, target: str) -> str:
    """Find the next hop in the ring towards the target host."""
    if current not in RING_ORDER or target not in RING_ORDER:
        return target
    curr_idx = RING_ORDER.index(current)
    targ_idx = RING_ORDER.index(target)
    n = len(RING_ORDER)
    # Clockwise distance
    cw_dist = (targ_idx - curr_idx) % n
    # Counter-clockwise distance
    ccw_dist = (curr_idx - targ_idx) % n
    if cw_dist <= ccw_dist:
        next_idx = (curr_idx + 1) % n
    else:
        next_idx = (curr_idx - 1) % n
    return RING_ORDER[next_idx]


class MessagePayload(BaseModel):
    target: str
    source: Optional[str] = None
    payload: Optional[str] = "ping"
    hops: Optional[List[str]] = None
    topology: Optional[str] = "auto"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "hostId": HOST_ID}


@app.get("/info")
def info() -> dict[str, str]:
    return {"id": HOST_ID, "name": HOST_NAME, "priority": PRIORITY}


@app.get("/test-direct/{target}")
def test_direct(target: str, port: int = 8000, timeout: float = 0.5) -> dict:
    """Test direct TCP connection to target host and port."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((target, port))
        s.close()
        return {"source": HOST_ID, "target": target, "connected": True}
    except Exception as e:
        return {"source": HOST_ID, "target": target, "connected": False, "error": str(e)}


@app.get("/test-http/{target}")
def test_http(target: str, port: int = 8000, timeout: float = 0.8) -> dict:
    """Test direct HTTP GET to target host's /health endpoint."""
    url = f"http://{target}:{port}/health"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
            return {"source": HOST_ID, "target": target, "reachable": True, "data": data}
    except Exception as e:
        return {"source": HOST_ID, "target": target, "reachable": False, "error": str(e)}


@app.post("/receive")
def receive(data: dict) -> dict:
    return {"status": "received", "hostId": HOST_ID, "data": data}


@app.post("/forward")
def forward_message(msg: MessagePayload) -> dict:
    hops = list(msg.hops or [])
    if not hops and msg.source:
        hops.append(msg.source)
    hops.append(HOST_ID)

    if msg.target == HOST_ID:
        return {
            "status": "delivered",
            "destination": HOST_ID,
            "hops": hops,
            "payload": msg.payload,
        }

    # Ring forwarding: determine next hop
    next_hop = get_ring_next_hop(HOST_ID, msg.target)
    url = f"http://{next_hop}:8000/forward"
    req_body = json.dumps({
        "target": msg.target,
        "source": msg.source or HOST_ID,
        "payload": msg.payload,
        "hops": hops,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=req_body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {
            "status": "forward_failed",
            "at": HOST_ID,
            "nextHop": next_hop,
            "target": msg.target,
            "error": str(e),
            "hops": hops,
        }


@app.post("/send")
def send_message(msg: MessagePayload) -> dict:
    source = msg.source or HOST_ID
    target = msg.target
    topology = (msg.topology or "auto").upper()

    if target == HOST_ID:
        return {"status": "delivered", "hops": [HOST_ID]}

    if topology == "STAR":
        # Send via router-1
        router_url = "http://router-1:8000/forward"
        req_body = json.dumps({
            "target": target,
            "source": source,
            "payload": msg.payload,
            "hops": [source],
        }).encode("utf-8")
        req = urllib.request.Request(router_url, data=req_body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            return {"status": "star_send_failed", "source": source, "target": target, "error": str(e)}

    # Otherwise ring or auto forwarding
    next_hop = get_ring_next_hop(HOST_ID, target)
    url = f"http://{next_hop}:8000/forward"
    req_body = json.dumps({
        "target": target,
        "source": source,
        "payload": msg.payload,
        "hops": [source],
    }).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"status": "ring_send_failed", "source": source, "target": target, "error": str(e)}
