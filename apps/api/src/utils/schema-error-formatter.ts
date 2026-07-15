import type { FastifySchemaValidationError } from 'fastify';

type SchemaErrorDataVar = 'body' | 'headers' | 'params' | 'querystring';

// Turns "organizationSlug" / "/organizationSlug" into "Organization slug".
function humanizeField(path: string): string {
  const raw = path.replace(/^\//, '').replace(/\//g, '.');
  if (!raw) return 'Value';
  const spaced = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function describe(error: FastifySchemaValidationError, dataVar: SchemaErrorDataVar): string {
  const field = humanizeField(
    error.keyword === 'required' ? String(error.params.missingProperty ?? '') : error.instancePath
  );

  switch (error.keyword) {
    case 'required':
      return `${field} is required`;
    case 'minLength':
      return `${field} must be at least ${error.params.limit} character${error.params.limit === 1 ? '' : 's'} long`;
    case 'maxLength':
      return `${field} must be at most ${error.params.limit} characters long`;
    case 'minItems':
      return `${field} must have at least ${error.params.limit} item${error.params.limit === 1 ? '' : 's'}`;
    case 'maxItems':
      return `${field} must have at most ${error.params.limit} items`;
    case 'pattern':
      return `${field} contains characters that aren't allowed`;
    case 'format':
      return error.params.format === 'email'
        ? `${field} must be a valid email address`
        : `${field} must be a valid ${error.params.format}`;
    case 'type':
      return `${field} must be a ${error.params.type}`;
    case 'enum': {
      const allowed = Array.isArray(error.params.allowedValues) ? error.params.allowedValues.join(', ') : '';
      return `${field} must be one of: ${allowed}`;
    }
    default:
      return `${dataVar}${error.instancePath} ${error.message ?? 'is invalid'}`;
  }
}

// Fastify's default formatter surfaces raw Ajv text (e.g. `body/slug must match
// pattern "^[a-z0-9-]+$"`) straight into the API response. This produces the
// same friendly, field-first phrasing the client-side Zod validation already shows.
export function formatSchemaErrors(errors: FastifySchemaValidationError[], dataVar: SchemaErrorDataVar): Error {
  return new Error(errors.map((error) => describe(error, dataVar)).join('; '));
}
