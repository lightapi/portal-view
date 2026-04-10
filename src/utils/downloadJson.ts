export default function downloadJson(filename: string, data: string) {
  const blob = new Blob([data], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;

  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor.parentNode === document.body) {
      document.body.removeChild(anchor);
    }
    URL.revokeObjectURL(downloadUrl);
  }
}
