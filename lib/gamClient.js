import { JWT } from "google-auth-library";

// Google Ad Manager's Reporting API is SOAP-based — there is no official
// Node.js client library, so this module talks to it directly over HTTPS
// using the OAuth2 access token as a Bearer header (supported by GAM's
// SOAP endpoints alongside the legacy SOAP AuthenticationHeader).
//
// Docs: https://developers.google.com/ad-manager/api/soap_xml
//
// NOTE: Google revises the Ad Manager API version quarterly and retires old
// versions. Confirm GAM_API_VERSION against the current supported versions
// list before deploying, and re-check this file against the live WSDL for
// that version — element names occasionally shift between versions.

const GAM_API_VERSION = process.env.GAM_API_VERSION || "v202408";
const GAM_NAMESPACE = `https://www.google.com/apis/ads/publisher/${GAM_API_VERSION}`;
const GAM_SOAP_ENDPOINT = `https://ads.google.com/apis/ads/publisher/${GAM_API_VERSION}`;
const GAM_SCOPE = "https://www.googleapis.com/auth/dfp";
const APPLICATION_NAME = process.env.GAM_APPLICATION_NAME || "AdStreamHQ";

let cachedJwtClient = null;

function loadServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable. Set it to the full " +
        "service account JSON key (as a single-line JSON string)."
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key.");
  }

  return credentials;
}

function getJwtClient() {
  if (cachedJwtClient) return cachedJwtClient;

  const credentials = loadServiceAccountCredentials();
  cachedJwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GAM_SCOPE],
  });

  return cachedJwtClient;
}

/**
 * Returns a valid OAuth2 access token for calling the Ad Manager API.
 * google-auth-library caches and refreshes the underlying token internally.
 */
export async function getAccessToken() {
  const client = getJwtClient();
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error("Failed to obtain a Google access token for Ad Manager.");
  }

  return token;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function extractFault(xml) {
  return extractTag(xml, "faultstring");
}

function buildSoapEnvelope({ networkCode, bodyXml }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="${GAM_NAMESPACE}">
  <soap-env:Header>
    <ns1:RequestHeader soap-env:actor="http://schemas.xmlsoap.org/soap/actor/next" soap-env:mustUnderstand="0">
      <ns1:networkCode>${escapeXml(networkCode)}</ns1:networkCode>
      <ns1:applicationName>${escapeXml(APPLICATION_NAME)}</ns1:applicationName>
    </ns1:RequestHeader>
  </soap-env:Header>
  <soap-env:Body>
    ${bodyXml}
  </soap-env:Body>
</soap-env:Envelope>`;
}

async function soapRequest({ service, soapAction, accessToken, networkCode, bodyXml }) {
  if (!networkCode) {
    throw new Error("networkCode is required to call the Ad Manager API.");
  }

  const envelope = buildSoapEnvelope({ networkCode, bodyXml });

  let response;
  try {
    response = await fetch(`${GAM_SOAP_ENDPOINT}/${service}`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction,
        Authorization: `Bearer ${accessToken}`,
      },
      body: envelope,
    });
  } catch (err) {
    throw new Error(`Network error calling Ad Manager ${service}.${soapAction}: ${err.message}`);
  }

  const text = await response.text();

  if (!response.ok || /<[\w-]*:?Fault>/i.test(text)) {
    const fault = extractFault(text) || `HTTP ${response.status}`;
    throw new Error(`Ad Manager ${service}.${soapAction} error: ${fault}`);
  }

  return text;
}

/**
 * Creates a report job in Ad Manager. `reportQueryXml` should be the inner
 * <reportQuery> field XML (dimensions, columns, date range, etc.).
 * Returns the numeric report job id as a string.
 */
export async function runReportJob({ accessToken, networkCode, reportQueryXml }) {
  const bodyXml = `<runReportJob xmlns="${GAM_NAMESPACE}">
      <reportJob>
        <reportQuery>${reportQueryXml}</reportQuery>
      </reportJob>
    </runReportJob>`;

  const xml = await soapRequest({
    service: "ReportService",
    soapAction: "runReportJob",
    accessToken,
    networkCode,
    bodyXml,
  });

  const jobId = extractTag(xml, "id");
  if (!jobId) {
    throw new Error("Ad Manager did not return a report job id.");
  }

  return jobId;
}

/**
 * Returns one of: IN_PROGRESS, COMPLETED, FAILED (per Ad Manager's
 * ReportJobStatus enum).
 */
export async function getReportJobStatus({ accessToken, networkCode, reportJobId }) {
  const bodyXml = `<getReportJobStatus xmlns="${GAM_NAMESPACE}">
      <reportJobId>${escapeXml(reportJobId)}</reportJobId>
    </getReportJobStatus>`;

  const xml = await soapRequest({
    service: "ReportService",
    soapAction: "getReportJobStatus",
    accessToken,
    networkCode,
    bodyXml,
  });

  const status = extractTag(xml, "rval") || extractTag(xml, "getReportJobStatusReturn");
  if (!status) {
    throw new Error("Ad Manager did not return a report job status.");
  }

  return status;
}

/**
 * Polls getReportJobStatus until the job reaches a terminal state, or
 * throws once timeoutMs has elapsed.
 */
export async function waitForReportCompletion({
  accessToken,
  networkCode,
  reportJobId,
  pollIntervalMs = 5000,
  timeoutMs = 5 * 60 * 1000,
}) {
  const startedAt = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getReportJobStatus({ accessToken, networkCode, reportJobId });

    if (status === "COMPLETED") return status;
    if (status === "FAILED") {
      throw new Error(`Ad Manager report job ${reportJobId} failed.`);
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for Ad Manager report job ${reportJobId} to complete.`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Returns a signed, time-limited URL the completed report can be downloaded
 * from, in the given export format (defaults to gzip-compressed CSV).
 */
export async function getReportDownloadUrl({
  accessToken,
  networkCode,
  reportJobId,
  exportFormat = "CSV_DUMP",
}) {
  const bodyXml = `<getReportDownloadURL xmlns="${GAM_NAMESPACE}">
      <reportJobId>${escapeXml(reportJobId)}</reportJobId>
      <exportFormat>${escapeXml(exportFormat)}</exportFormat>
    </getReportDownloadURL>`;

  const xml = await soapRequest({
    service: "ReportService",
    soapAction: "getReportDownloadURL",
    accessToken,
    networkCode,
    bodyXml,
  });

  const url = extractTag(xml, "rval") || extractTag(xml, "getReportDownloadURLReturn");
  if (!url) {
    throw new Error("Ad Manager did not return a report download URL.");
  }

  return url;
}

/**
 * Retries a transient-failure-prone async operation with exponential
 * backoff. Used for the network calls that make up a report sync (job
 * creation, status polling, download) so a single flaky request doesn't
 * fail an entire sync.
 */
export async function withRetry(fn, { retries = 3, baseDelayMs = 1000, label = "operation" } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[gamClient] ${label} failed (attempt ${attempt}/${retries}): ${error.message}. Retrying in ${delay}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label} failed after ${retries} attempts: ${lastError.message}`);
}

/**
 * Downloads and gunzips the CSV_DUMP report, returning it as a UTF-8 string.
 */
export async function downloadReportCsv(downloadUrl) {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Ad Manager report: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { gunzipSync } = await import("node:zlib");
  return gunzipSync(buffer).toString("utf-8");
}
