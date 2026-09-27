import { expect } from "chai";
import { network } from "hardhat";

describe("CertificateRegistry", function () {

    async function deployContract() {
        const { ethers } = await network.create();

        const [admin, issuer, randomUser] =
            await ethers.getSigners();

        const registry =
            await ethers.deployContract("CertificateRegistry");

        await registry.waitForDeployment();

        return {
            ethers,
            registry,
            admin,
            issuer,
            randomUser
        };
    }

    const certificateId = "EVN-26-7F92A1";

    const certificateHash =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

    it("should assign admin as the default issuer", async function () {

        const {
            registry,
            admin
        } = await deployContract();

        expect(
            await registry.hasIssuerRole(admin.address)
        ).to.equal(true);
    });

    it("should authorize a new issuer", async function () {

        const {
            registry,
            issuer
        } = await deployContract();

        await registry.authorizeIssuer(issuer.address);

        expect(
            await registry.hasIssuerRole(issuer.address)
        ).to.equal(true);
    });

    it("should allow an authorized issuer to register a certificate", async function () {

        const {
            registry,
            admin
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        const certificate =
            await registry.getCertificate(certificateId);

        expect(certificate[0]).to.equal(certificateHash);
        expect(certificate[1]).to.equal(admin.address);
        expect(certificate[3]).to.equal(false);
        expect(certificate[4]).to.equal(true);
    });

    it("should reject an unauthorized user", async function () {

        const {
            ethers,
            registry,
            randomUser
        } = await deployContract();

        await expect(
            registry
                .connect(randomUser)
                .registerCertificate(
                    certificateId,
                    certificateHash
                )
        ).to.be.revert(ethers);
    });

    it("should verify a certificate with the correct hash", async function () {

        const {
            registry,
            admin
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        const result =
            await registry.verifyCertificate(
                certificateId,
                certificateHash
            );

        expect(result[0]).to.equal(true);
        expect(result[1]).to.equal(false);
        expect(result[2]).to.equal(admin.address);
    });

    it("should reject a certificate with an incorrect hash", async function () {

        const {
            registry
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        const modifiedHash =
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

        const result =
            await registry.verifyCertificate(
                certificateId,
                modifiedHash
            );

        expect(result[0]).to.equal(false);
        expect(result[1]).to.equal(false);
    });

    it("should reject duplicate certificate IDs", async function () {

        const {
            ethers,
            registry
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        await expect(
            registry.registerCertificate(
                certificateId,
                certificateHash
            )
        ).to.be.revert(ethers);
    });

    it("should revoke a certificate", async function () {

        const {
            registry
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        await registry.revokeCertificate(
            certificateId
        );

        const certificate =
            await registry.getCertificate(certificateId);

        expect(certificate[3]).to.equal(true);
    });

    it("should make a revoked certificate invalid", async function () {

        const {
            registry
        } = await deployContract();

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        await registry.revokeCertificate(
            certificateId
        );

        const result =
            await registry.verifyCertificate(
                certificateId,
                certificateHash
            );

        expect(result[0]).to.equal(false);
        expect(result[1]).to.equal(true);
    });

    it("should not allow a different issuer to revoke the certificate", async function () {

        const {
            ethers,
            registry,
            issuer
        } = await deployContract();

        await registry.authorizeIssuer(
            issuer.address
        );

        await registry.registerCertificate(
            certificateId,
            certificateHash
        );

        await expect(
            registry
                .connect(issuer)
                .revokeCertificate(certificateId)
        ).to.be.revert(ethers);
    });
});