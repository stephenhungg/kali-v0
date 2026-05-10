/**
 * Side-effect-only module that imports every connector so it self-registers
 * with the connector registry. Import this once at startup.
 *
 * Each connector module ends with `ensureRegistered()`, which is safe to
 * call repeatedly — the registry guards against double registration.
 */

import "../connectors/bloomerang";
import "../connectors/salesforce";
import "../connectors/m365";
import "../connectors/zoom";
import "../connectors/sharepoint";
import "../connectors/instrumentl";
import "../connectors/quickbooks";
import "../connectors/solana";
import "../connectors/powerbi";
import "../connectors/powerautomate";
import "../connectors/knowbe4";
import "../connectors/x402";
import "../connectors/causecoin";
import "../context/entity";
