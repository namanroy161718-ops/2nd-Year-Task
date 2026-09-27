import os
from dotenv import load_dotenv
from web3 import Web3
from fastapi import HTTPException

try:
    from .abi import REGISTRY_ABI
except ImportError:
    from app.abi import REGISTRY_ABI

load_dotenv()

DEFAULT_RPC_URL = "http://127.0.0.1:8545"
DEFAULT_CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
DEFAULT_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def get_web3_and_contract():
    rpc_url = os.getenv("RPC_URL", DEFAULT_RPC_URL)
    contract_addr = os.getenv("CONTRACT_ADDRESS", DEFAULT_CONTRACT)
    private_key = os.getenv("PRIVATE_KEY", DEFAULT_TEST_KEY)

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Unable to connect to blockchain RPC at '{rpc_url}'. "
                "For production / Vercel, set RPC_URL, CONTRACT_ADDRESS, and PRIVATE_KEY environment variables."
            )
        )

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_addr),
        abi=REGISTRY_ABI
    )

    account = w3.eth.account.from_key(private_key)

    return w3, contract, account, private_key


def register_certificate_on_chain(
    certificate_id: str,
    certificate_hash: str
):
    w3, contract, account, private_key = get_web3_and_contract()

    nonce = w3.eth.get_transaction_count(account.address)

    transaction = contract.functions.registerCertificate(
        certificate_id,
        bytes.fromhex(certificate_hash)
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 500000,
        "gasPrice": w3.eth.gas_price,
    })

    signed_transaction = w3.eth.account.sign_transaction(
        transaction,
        private_key
    )

    tx_hash = w3.eth.send_raw_transaction(
        signed_transaction.raw_transaction
    )

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "transactionHash": tx_hash.hex(),
        "blockNumber": receipt.blockNumber,
        "certificateId": certificate_id,
        "issuer": account.address,
    }


def get_certificate_from_chain(certificate_id: str):
    w3, contract, account, _ = get_web3_and_contract()

    result = contract.functions.getCertificate(certificate_id).call()

    return {
        "certificateHash": result[0].hex(),
        "issuer": result[1],
        "issuedAt": result[2],
        "revoked": result[3],
        "exists": result[4],
    }


def revoke_certificate_on_chain(certificate_id: str):
    w3, contract, account, private_key = get_web3_and_contract()

    nonce = w3.eth.get_transaction_count(account.address)

    transaction = contract.functions.revokeCertificate(
        certificate_id
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 500000,
        "gasPrice": w3.eth.gas_price,
    })

    signed_transaction = w3.eth.account.sign_transaction(
        transaction,
        private_key
    )

    tx_hash = w3.eth.send_raw_transaction(
        signed_transaction.raw_transaction
    )

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "transactionHash": tx_hash.hex(),
        "blockNumber": receipt.blockNumber,
        "certificateId": certificate_id,
        "revokedBy": account.address,
    }