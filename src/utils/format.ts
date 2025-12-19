export const formatFileSize = (bytes: number): string => {
  const sizeKB = (bytes / 1024).toFixed(1)
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${sizeKB} KB`
}

