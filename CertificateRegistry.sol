// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CertificateRegistry is AccessControl {

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Certificate {
        bytes32 certificateHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
        bool exists;
    }

    mapping(string => Certificate) private certificates;

    event CertificateIssued(
        string indexed certificateId,
        bytes32 certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );

    event CertificateRevoked(
        string indexed certificateId,
        address indexed issuer,
        uint256 revokedAt
    );

    event IssuerAuthorized(
        address indexed issuer
    );

    event IssuerRemoved(
        address indexed issuer
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    function authorizeIssuer(
        address issuer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {

        require(
            issuer != address(0),
            "Invalid issuer"
        );

        _grantRole(ISSUER_ROLE, issuer);

        emit IssuerAuthorized(issuer);
    }

    function removeIssuer(
        address issuer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {

        _revokeRole(ISSUER_ROLE, issuer);

        emit IssuerRemoved(issuer);
    }

    function registerCertificate(
        string calldata certificateId,
        bytes32 certificateHash
    ) external onlyRole(ISSUER_ROLE) {

        require(
            bytes(certificateId).length > 0,
            "Invalid certificate ID"
        );

        require(
            certificateHash != bytes32(0),
            "Invalid certificate hash"
        );

        require(
            !certificates[certificateId].exists,
            "Certificate already exists"
        );

        certificates[certificateId] = Certificate({
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revoked: false,
            exists: true
        });

        emit CertificateIssued(
            certificateId,
            certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    function revokeCertificate(
        string calldata certificateId
    ) external onlyRole(ISSUER_ROLE) {

        require(
            certificates[certificateId].exists,
            "Certificate does not exist"
        );

        require(
            certificates[certificateId].issuer == msg.sender,
            "Not certificate issuer"
        );

        require(
            !certificates[certificateId].revoked,
            "Certificate already revoked"
        );

        certificates[certificateId].revoked = true;

        emit CertificateRevoked(
            certificateId,
            msg.sender,
            block.timestamp
        );
    }

    function getCertificate(
        string calldata certificateId
    )
        external
        view
        returns (
            bytes32 certificateHash,
            address issuer,
            uint256 issuedAt,
            bool revoked,
            bool exists
        )
    {
        Certificate memory certificate = certificates[certificateId];

        return (
            certificate.certificateHash,
            certificate.issuer,
            certificate.issuedAt,
            certificate.revoked,
            certificate.exists
        );
    }

    function verifyCertificate(
        string calldata certificateId,
        bytes32 submittedHash
    )
        external
        view
        returns (
            bool valid,
            bool revoked,
            address issuer,
            uint256 issuedAt
        )
    {
        Certificate memory certificate = certificates[certificateId];

        if (!certificate.exists) {
            return (
                false,
                false,
                address(0),
                0
            );
        }

        bool hashMatches =
            certificate.certificateHash == submittedHash;

        bool validCertificate =
            hashMatches && !certificate.revoked;

        return (
            validCertificate,
            certificate.revoked,
            certificate.issuer,
            certificate.issuedAt
        );
    }

    function hasIssuerRole(
        address account
    ) external view returns (bool) {

        return hasRole(
            ISSUER_ROLE,
            account
        );
    }
}