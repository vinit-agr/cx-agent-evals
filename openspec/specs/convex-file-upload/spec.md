## ADDED Requirements

### Requirement: Generate upload URL mutation
The system SHALL provide a Convex mutation `documents.generateUploadUrl` that calls `ctx.storage.generateUploadUrl()` and returns a short-lived upload URL. The mutation SHALL require authentication.

#### Scenario: Authenticated user gets upload URL
- **WHEN** an authenticated user calls `documents.generateUploadUrl`
- **THEN** the system SHALL return a temporary upload URL valid for file upload

### Requirement: Browser file upload flow
The frontend SHALL provide a file upload UI where users can select multiple `.md` files (via file picker or drag-and-drop). For each file, the browser SHALL: (1) call `generateUploadUrl` mutation to get a temporary URL, (2) POST the file to the URL to get a `storageId`, (3) call a `documents.create` mutation with the `storageId`, filename, and `kbId`.

#### Scenario: Upload single markdown file
- **WHEN** a user selects a `.md` file and uploads it to a knowledge base
- **THEN** the file SHALL be stored in Convex file storage, and a document record SHALL be created with the file's content extracted

#### Scenario: Upload multiple files
- **WHEN** a user selects 10 `.md` files and uploads them
- **THEN** all 10 files SHALL be uploaded to Convex storage, and 10 document records SHALL be created in the knowledge base

#### Scenario: Non-markdown file rejected
- **WHEN** a user attempts to upload a `.pdf` or `.txt` file
- **THEN** the upload SHALL be rejected with an error indicating only `.md` files are accepted

### Requirement: Document creation mutation with content extraction
The system SHALL provide a Convex mutation `documents.create` that accepts `kbId`, `storageId`, and `title` (filename). The mutation SHALL read the file content from storage via `ctx.storage.getUrl(storageId)` followed by `fetch(url)` to get the text content (note: `ctx.storage.get()` returning a Blob is only available in actions, not mutations). It SHALL insert a document record with `docId` (derived from filename), `title`, `content`, `fileId`, `contentLength`, `orgId` (from auth), and `createdAt`.

#### Scenario: Document content extracted from uploaded file
- **WHEN** `documents.create` is called with a valid storage ID for a markdown file
- **THEN** the document record SHALL contain the full text content of the file, and `contentLength` SHALL equal the content's character count

#### Scenario: DocId derived from filename
- **WHEN** uploading a file named `getting-started.md`
- **THEN** the document's `docId` SHALL be `"getting-started.md"` (or a sanitized derivative)

### Requirement: Knowledge base creation
The system SHALL provide a Convex mutation `knowledgeBases.create` that accepts `name`, optional `description`, and optional `metadata`. It SHALL create a knowledge base record scoped to the authenticated user's organization.

#### Scenario: Create knowledge base
- **WHEN** an authenticated user calls `knowledgeBases.create` with name "Support Docs v2"
- **THEN** a knowledge base record SHALL be created with `orgId` from the user's active org, `name: "Support Docs v2"`, and `createdBy` set to the user's ID

### Requirement: List knowledge bases query
The system SHALL provide a Convex query `knowledgeBases.list` that returns all knowledge bases for the authenticated user's organization, ordered by creation date descending.

#### Scenario: List org knowledge bases
- **WHEN** an authenticated user calls `knowledgeBases.list`
- **THEN** the query SHALL return all knowledge bases where `orgId` matches the user's active org

### Requirement: List documents query
The system SHALL provide a Convex query `documents.listByKb` that accepts a `kbId` and returns all documents in that knowledge base. The query SHALL verify the knowledge base belongs to the user's organization before returning results.

#### Scenario: List documents in knowledge base
- **WHEN** calling `documents.listByKb` with a valid `kbId`
- **THEN** the query SHALL return all documents in that knowledge base with `docId`, `title`, `contentLength`, and `createdAt`

#### Scenario: Access denied for other org's knowledge base
- **WHEN** calling `documents.listByKb` with a `kbId` belonging to a different organization
- **THEN** the query SHALL throw an authorization error
