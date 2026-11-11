/** A PUT that reports progress, which fetch() still cannot do for uploads. */
export function putBlob(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Required by the Blob service for a single-shot upload.
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status === 201
        ? resolve()
        : reject(new Error(`Storage answered ${xhr.status} while uploading.`));
    xhr.onerror = () => reject(new Error("The upload could not reach storage."));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    xhr.timeout = 9 * 60 * 1000; // under the ten-minute life of the URL
    xhr.send(file);
  });
}
