import base64
import io
import os
import qrcode

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")


def generate_verification_qr(certificate_id: str):
    verification_url = f"{BASE_URL}/verify/{certificate_id}"

    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=4,
    )

    qr.add_data(verification_url)
    qr.make(fit=True)

    image = qr.make_image()

    file_path = f"/tmp/qr_{certificate_id}.png"
    try:
        image.save(file_path)
    except OSError:
        pass

    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{img_b64}"

    return {
        "certificateId": certificate_id,
        "verificationUrl": verification_url,
        "file": file_path,
        "dataUrl": data_url,
    }