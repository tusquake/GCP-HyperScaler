# GCS Resumable Upload & Pause/Resume Protocol Specification

This document details the technical implementation, protocol headers, byte offset calculations, and architectural flow of the 1.5GB+ Google Cloud Storage (GCS) Resumable Upload engine used in the Secure Enterprise File Vault.

---

## 1. Executive Protocol Overview

Standard web uploads send files in a single monolithic HTTP request. If network connectivity drops or stalls during a large upload (e.g. 1.5GB+), the connection terminates and the user is forced to restart from byte 0.

The Resumable Upload Protocol addresses this by registering a persistent upload session with Google Cloud Storage that tracks received byte ranges. If an upload is paused or interrupted, the client queries GCS to retrieve the last saved byte index, slices the remaining un-uploaded file bytes via JavaScript Blob API (`file.slice()`), and resumes transmission without data loss.

---

## 2. End-to-End Sequence Diagram

```
   Client Browser                    Backend API                        GCS Storage
        |                                 |                                  |
 1.     +--- POST /generate-upload-url -->|                                  |
        |    (filename, size, type)       |-- createResumableUpload() ------>|
        |                                 |<-- Session Upload URL -----------|
        |<-- Return Session URL ----------+                                  |
        |                                                                    |
 2.     +--- HTTP PUT Session URL ------------------------------------------>|
        |    Header: Content-Type: application/octet-stream                  |
        |    Body: File Stream (bytes 0 -> total)                            |
        |                                                                    |
        | === USER CLICKS PAUSE / NETWORK DROPS ===                          |
 3.     |  xhr.abort() cancels active socket connection                      |
        |                                                                    |
        | === USER CLICKS RESUME ===                                         |
 4.     +--- HTTP PUT Session URL (Query Status) --------------------------->|
        |    Header: Content-Range: bytes */[TotalSizeBytes]                 |
        |                                                                    |
        |<-- HTTP 308 Resume Incomplete -------------------------------------+
        |    Header: Range: bytes=0-[LastSavedByte]                          |
        |                                                                    |
 5.     +--- HTTP PUT Session URL (Resume Transfer) ------------------------>|
        |    Header: Content-Range: bytes [LastSavedByte+1]-[Total-1]/[Total]|
        |    Body: file.slice(LastSavedByte + 1)                             |
        |                                                                    |
        |<-- HTTP 200 OK (Upload Complete!) ---------------------------------+
```

---

## 3. Detailed Protocol Phases

### Phase 1: Upload Session Creation
1. Client issues a `POST /api/files/generate-upload-url` request specifying target `folder_id`, `file_name`, `file_size_bytes`, and `content_type`.
2. Backend authenticates user permissions in PostgreSQL (`user_folder_permissions.can_upload = TRUE`).
3. Backend invokes `@google-cloud/storage` `file.createResumableUpload()` using the active Cloud Run IAM Service Account identity (`file-vault-backend-sa`).
4. GCS registers an upload URI and returns a unique, long-lived Resumable Upload Session URL to the client.

### Phase 2: Direct Chunk Streaming
1. Client initializes an `XMLHttpRequest` using HTTP `PUT` targeting the GCS Resumable Upload Session URL.
2. HTTP Request Headers:
   - `Content-Type`: File MIME type (e.g. `application/pdf` or `application/octet-stream`)
3. The browser streams file data directly to `storage.googleapis.com`. `xhr.upload.onprogress` computes real-time transfer speed (`MB/s`) and percentage progress.

### Phase 3: Pause & Interruption Handling
1. When a user clicks **Pause** or network connectivity drops, `xhr.abort()` is executed.
2. The active socket connection is closed immediately on the client side. GCS retains all byte ranges received up to the moment of disconnection.

### Phase 4: Status Query & Resume Protocol
When a user clicks **Resume**:

1. **Status Check Request**:
   The client sends an empty HTTP `PUT` request to the GCS Resumable Session URL with the following header:
   ```http
   Content-Range: bytes */157286400
   ```
   *(where `157286400` represents total file size in bytes).*

2. **GCS Range Response**:
   GCS returns **HTTP Status 308 (Resume Incomplete)** containing a `Range` header specifying the last contiguous byte range stored:
   ```http
   HTTP/1.1 308 Resume Incomplete
   Range: bytes=0-52428799
   ```
   This indicates GCS holds bytes 0 through 52,428,799. The next required byte is index `52428800`.

3. **Blob Slicing & Transfer Resume**:
   The client slices the un-uploaded portion of the file using JavaScript:
   ```js
   const remainingFileChunk = file.slice(52428800);
   ```
   The client sends a `PUT` request with the remaining chunk and range headers:
   ```http
   Content-Range: bytes 52428800-157286399/157286400
   ```

4. **Upload Confirmation**:
   Once GCS receives the final byte of the range, it responds with **HTTP Status 200 OK** (or **201 Created**).
   The frontend then invokes `POST /api/files/confirm-upload` to record file metadata in PostgreSQL.

---

## 4. Resilience Fallback Architecture

If a client browser environment or network proxy restricts direct CORS `PUT` requests to `storage.googleapis.com`, `LargeFileUploader` catches `xhr.onerror` and automatically triggers an API Stream Fallback:

- Endpoint: `POST /api/files/upload-direct`
- Stream Mechanism: Uses HTTP chunked transfer encoding (`req.pipe(gcsFile.createWriteStream())`) through the Express backend directly to GCS, ensuring zero upload failures under all enterprise network configurations.
