import hashlib
import json


def canonicalize_certificate(certificate: dict) -> str:
    return json.dumps(
        certificate,
        sort_keys=True,
        separators=(",", ":")
    )


def generate_certificate_hash(certificate: dict) -> str:
    canonical_data = canonicalize_certificate(certificate)

    return hashlib.sha256(
        canonical_data.encode("utf-8")
    ).hexdigest()