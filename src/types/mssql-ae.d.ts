// types/mssql-ae.d.ts
export {}; // ensure this file is treated as a module

// Augment the mssql typings so we can pass AE options through to Tedious
declare module "mssql" {
  interface IOptions {
    /** Enable SQL Server Always Encrypted on the client */
    columnEncryption?: boolean;

    /** Pass-through provider used by Tedious AE to talk to Azure Key Vault */
    keyVaultProvider?: unknown;

    /** Useful to set explicitly when hardening TLS */
    trustServerCertificate?: boolean;

    /** Make timeouts explicit during AE handshakes */
    requestTimeout?: number;
  }

  // (Optional) allow AAD auth config on the top-level pool config
  interface config {
    authentication?: unknown; // we set { type: "azure-active-directory-default", options: {} }
  }
}
