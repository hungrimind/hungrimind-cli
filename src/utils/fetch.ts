import { Command } from '@oclif/core';

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface FetchResult {
  response: Response;
  responseText?: string; // Response body text if read during verbose logging
}

/**
 * Wraps the native fetch function to add conditional verbose logging
 * for requests and responses, including masking sensitive headers.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options (method, headers, body, etc.).
 * @param verbose - Boolean flag to enable/disable verbose logging.
 * @param logFn - The logging function (e.g., command.log.bind(command)).
 * @returns A promise resolving to an object containing the Response object
 *          and the response body text if it was read during verbose logging.
 */
export async function fetchWithVerboseLogging(
  url: string,
  options: FetchOptions,
  verbose: boolean,
  logFn: Command['log'] // Use the type from Command['log']
): Promise<FetchResult> {
  const headers = options.headers || {};

  if (verbose) {
    logFn('--- Verbose Request Details ---');
    logFn(`Making API call to: ${url}`);
    // Mask sensitive headers like 'x-auth-token'
    const headersToLog = { ...headers };
    if (headersToLog['x-auth-token']) {
      headersToLog['x-auth-token'] = `*** MASKED (first 4 chars: ${headersToLog['x-auth-token'].slice(0, 4)}...) ***`;
    }
    // Mask Authorization header if it exists
    if (headersToLog['Authorization']) {
        headersToLog['Authorization'] = '*** MASKED ***';
    }

    const requestOptionsToLog = {
        ...options,
        headers: headersToLog,
    };
    // Avoid logging large bodies if necessary (optional)
    // if (requestOptionsToLog.body && typeof requestOptionsToLog.body === 'string' && requestOptionsToLog.body.length > 1000) {
    //   requestOptionsToLog.body = requestOptionsToLog.body.substring(0, 1000) + '... [Truncated]';
    // }
    logFn(`Request Options:`, requestOptionsToLog);
    logFn('-------------------------------');
  }

  const response = await fetch(url, options as RequestInit); // Cast back to RequestInit for fetch

  let responseText: string | undefined;

  if (verbose) {
    logFn('--- Response Details ---');
    logFn(`Status: ${response.status}`);
    const responseHeaders = Object.fromEntries(response.headers);
    // Mask sensitive response headers if needed (e.g., set-cookie)
    // if (responseHeaders['set-cookie']) responseHeaders['set-cookie'] = '*** MASKED ***';
    logFn(`Headers: ${JSON.stringify(responseHeaders)}`);
    try {
      // Clone the response to read the text without consuming the body for later .json() calls
      const clonedResponse = response.clone();
      responseText = await clonedResponse.text(); // Store original text for return

      // Attempt to parse and mask sensitive fields for logging
      try {
        const data = JSON.parse(responseText);
        // Mask downloadUrl if it exists
        if (data && typeof data === 'object' && data.downloadUrl) {
          data.downloadUrl = '*** MASKED ***';
        }
        // Add more fields to mask here if needed
        logFn(`Body: ${JSON.stringify(data, null, 2)}`); // Log potentially masked data
      } catch (parseError) {
        // If parsing fails, log the raw text
        logFn(`Body (raw, JSON parse failed): ${responseText}`);
      }
    } catch (error) {
      logFn(`Warning: Could not read response body for verbose logging: ${error}`);
      // responseText remains undefined or holds the raw text from the failed clone/text() attempt
    }
    logFn('-------------------------------');
  }

  return { response, responseText }; // Return the original response and potentially original text
} 