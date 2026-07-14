export default function downloadText(
  filename: string,
  data: string,
  contentType = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([data], { type: contentType });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;

  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor.parentNode === document.body) document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  }
}

