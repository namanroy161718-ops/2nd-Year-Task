import { network } from "hardhat";

const { ethers } = await network.create();

const registry = await ethers.deployContract("CertificateRegistry");

await registry.waitForDeployment();

console.log("CertificateRegistry deployed to:");
console.log(await registry.getAddress());