## MODIFIED Requirements

### Requirement: Folder path input for corpus loading
The UI SHALL replace the folder path input and Browse button with a file upload interface. Users SHALL upload `.md` files directly via file picker or drag-and-drop into a selected knowledge base. The system SHALL NO LONGER access the local filesystem for corpus loading.

#### Scenario: Upload markdown files to knowledge base
- **WHEN** user selects multiple `.md` files and uploads them to a knowledge base
- **THEN** the system loads each file's content via Convex file storage and creates document records in the knowledge base

#### Scenario: No filesystem access
- **WHEN** the corpus loader UI is rendered
- **THEN** there SHALL be no folder path input, no Browse button, and no filesystem browsing capability

### Requirement: Folder browser UI
**REMOVED**

### Requirement: Document list display
After uploading, the UI SHALL display all documents in the knowledge base as a scrollable list. Each item SHALL show the document ID (filename) and a preview of the first 200 characters. Documents SHALL be loaded via `useQuery(api.documents.listByKb, { kbId })`.

#### Scenario: Documents displayed after upload
- **WHEN** 5 markdown files are uploaded to a knowledge base
- **THEN** all 5 documents appear in the list with their filename and content preview, updating in real-time as uploads complete

### Requirement: Remember last folder path
**REMOVED** — No longer applicable since corpus loading is via file upload, not filesystem path.

## REMOVED Requirements

### Requirement: Folder browser UI
**Reason**: Filesystem browsing requires server-side access to the local filesystem, which is incompatible with cloud deployment. Replaced by direct file upload.
**Migration**: Use the file upload interface to select and upload `.md` files instead of browsing server folders.

### Requirement: Remember last folder path
**Reason**: No longer applicable since corpus loading is via file upload to Convex storage, not local filesystem paths.
**Migration**: Knowledge bases persist in Convex DB — users select from existing knowledge bases instead of re-entering folder paths.
