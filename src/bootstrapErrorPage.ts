export function renderConfigurationError(error: unknown): void {
  const root = document.getElementById("root");
  if (!root) return;

  const title = document.createElement("h1");
  title.textContent = "Portal configuration error";
  const message = document.createElement("p");
  message.textContent = error instanceof Error ? error.message : String(error);
  const hint = document.createElement("p");
  hint.textContent = "Check portal-config.json for this deployment.";
  root.replaceChildren(title, message, hint);
}
