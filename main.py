from datetime import date
from pathlib import Path
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .qr import generate_verification_qr
from .hashing import generate_certificate_hash
from .blockchain import (
    register_certificate_on_chain,
    get_certificate_from_chain,
    revoke_certificate_on_chain,
)

app = FastAPI(
    title="ProofPass API",
    description="Blockchain-backed certificate verification API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path(__file__).resolve().parents[2] / "public"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/", include_in_schema=False)
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "ProofPass API is running. Visit /docs for documentation."}

@app.get("/style.css", include_in_schema=False)
def serve_css():
    css_file = FRONTEND_DIR / "style.css"
    if css_file.exists():
        return FileResponse(css_file, media_type="text/css")
    return {"error": "Not found"}

@app.get("/app.js", include_in_schema=False)
def serve_js():
    js_file = FRONTEND_DIR / "app.js"
    if js_file.exists():
        return FileResponse(js_file, media_type="application/javascript")
    return {"error": "Not found"}


class Certificate(BaseModel):
    certificateId: str = Field(min_length=1)
    studentName: str = Field(min_length=1)
    courseName: str = Field(min_length=1)
    issuer: str = Field(min_length=1)
    issueDate: date


class CertificateRevocation(BaseModel):
    certificateId: str = Field(min_length=1)


router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/certificates/hash")
def create_certificate_hash(certificate: Certificate):
    data = certificate.model_dump(mode="json")
    certificate_hash = generate_certificate_hash(data)
    return {
        "certificateId": certificate.certificateId,
        "hash": certificate_hash,
        "algorithm": "SHA-256",
    }


@router.post("/certificates/register")
def register_certificate(certificate: Certificate):
    data = certificate.model_dump(mode="json")
    certificate_hash = generate_certificate_hash(data)
    blockchain_result = register_certificate_on_chain(
        certificate.certificateId,
        certificate_hash,
    )
    return {
        "certificateId": certificate.certificateId,
        "hash": certificate_hash,
        "algorithm": "SHA-256",
        "blockchain": blockchain_result,
    }


@router.post("/certificates/verify")
def verify_certificate(certificate: Certificate):
    data = certificate.model_dump(mode="json")
    submitted_hash = generate_certificate_hash(data)

    on_chain = get_certificate_from_chain(certificate.certificateId)

    if not on_chain["exists"]:
        return {
            "status": "NOT_FOUND",
            "certificateId": certificate.certificateId,
        }

    if on_chain["revoked"]:
        status = "REVOKED"
    elif submitted_hash != on_chain["certificateHash"]:
        status = "TAMPERED"
    else:
        status = "VALID"

    return {
        "status": status,
        "certificateId": certificate.certificateId,
        "submittedHash": submitted_hash,
        "storedHash": on_chain["certificateHash"],
        "issuer": on_chain["issuer"],
        "issuedAt": on_chain["issuedAt"],
        "revoked": on_chain["revoked"],
    }


@router.post("/certificates/revoke")
def revoke_certificate(certificate: CertificateRevocation):
    result = revoke_certificate_on_chain(certificate.certificateId)
    return {
        "status": "REVOKED",
        **result,
    }


@router.get("/verify/{certificate_id}")
def public_verify_certificate(certificate_id: str):
    on_chain = get_certificate_from_chain(certificate_id)

    if not on_chain["exists"]:
        return {
            "status": "NOT_FOUND",
            "certificateId": certificate_id,
        }

    if on_chain["revoked"]:
        status = "REVOKED"
    else:
        status = "REGISTERED"

    return {
        "status": status,
        "certificateId": certificate_id,
        "issuer": on_chain["issuer"],
        "issuedAt": on_chain["issuedAt"],
        "revoked": on_chain["revoked"],
    }


@router.get("/certificates/{certificate_id}/qr")
def create_certificate_qr(certificate_id: str):
    return generate_verification_qr(certificate_id)


# Include router both at root and under /api
app.include_router(router, prefix="")
app.include_router(router, prefix="/api")