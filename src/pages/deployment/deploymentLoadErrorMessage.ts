function errorDetail(error: unknown): string {
  const objectValue = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : undefined;
  const nestedError = objectValue?.error && typeof objectValue.error === 'object'
    ? objectValue.error as Record<string, unknown>
    : undefined;
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : [
          nestedError?.description,
          nestedError?.message,
          objectValue?.description,
          objectValue?.message,
        ].find((value): value is string => typeof value === 'string' && Boolean(value.trim())) ?? '';
}

function deploymentLoadErrorMessage(error: unknown, adminPage: string, entities: string): string {
  const detail = errorDetail(error);
  if (detail.toLowerCase().includes('access denied')) {
    return `Access denied. ${adminPage} requires the admin, deployment-admin, or deployment-viewer role on the selected host. Sign out and back in after the role is granted.`;
  }
  return detail.trim()
    ? `Unable to load ${entities}: ${detail.trim()}`
    : `Unable to load ${entities}. The server did not provide an error message.`;
}

export function platformLoadErrorMessage(error: unknown): string {
  return deploymentLoadErrorMessage(error, 'Platform Admin', 'platforms');
}

export function pipelineLoadErrorMessage(error: unknown): string {
  return deploymentLoadErrorMessage(error, 'Pipeline Admin', 'pipelines');
}
