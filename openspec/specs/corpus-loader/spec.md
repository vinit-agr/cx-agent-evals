## ADDED Requirements

### Requirement: Folder path input for corpus loading
The UI SHALL provide a text input where the user enters an absolute folder path. A "Load" button SHALL trigger loading all markdown files from that folder via the backend API.

#### Scenario: Valid folder with markdown files
- **WHEN** user enters a valid folder path containing `.md` files and clicks "Load"
- **THEN** the system loads the corpus and displays a list of document filenames with their content length

#### Scenario: Empty or invalid folder
- **WHEN** user enters a path that does not exist or contains no markdown files
- **THEN** the system displays an error message indicating no documents were found

### Requirement: Corpus loader layout
The corpus loader controls SHALL be laid out to fit within a narrow sidebar. The folder path input SHALL take full width, with Browse and Load buttons stacked below it side-by-side. This prevents button overflow in constrained layouts.

#### Scenario: Buttons visible in narrow sidebar
- **WHEN** the corpus loader is rendered in a 320px sidebar
- **THEN** the input, Browse, and Load buttons are all fully visible without overflow

### Requirement: Folder browser UI
The UI SHALL provide a "Browse" button next to the folder path input. Clicking it SHALL open a modal or inline panel that displays the server filesystem as a navigable directory tree. The modal SHALL render above the sticky header (z-index higher than header) and be positioned below the header bar so it is not occluded. The user SHALL be able to click into directories and see their contents (subdirectories and `.md` files). A "Select" button SHALL confirm the current directory as the corpus folder path and populate the text input. The browser SHALL show the current path as a breadcrumb for easy navigation up the tree.

#### Scenario: Open folder browser
- **WHEN** user clicks the "Browse" button
- **THEN** a folder browser panel opens showing the contents of the default starting directory

#### Scenario: Navigate into subdirectory
- **WHEN** user clicks a directory name in the browser
- **THEN** the browser navigates into that directory and displays its contents

#### Scenario: Navigate up via breadcrumb
- **WHEN** user clicks a parent segment in the breadcrumb path
- **THEN** the browser navigates to that parent directory

#### Scenario: Select folder and close browser
- **WHEN** user clicks "Select this folder" in the browser
- **THEN** the browser closes, the folder path input is populated with the selected absolute path, and the corpus is loaded automatically

### Requirement: Document list display
After loading, the UI SHALL display all documents in the corpus as a scrollable list. Each item SHALL show the document ID (filename) and a preview of the first 200 characters.

#### Scenario: Documents displayed after loading
- **WHEN** corpus is loaded with 5 markdown files
- **THEN** all 5 documents appear in the list with their filename and content preview

### Requirement: Remember last folder path
The system SHALL persist the last successfully loaded folder path in localStorage and pre-fill the input on subsequent visits.

#### Scenario: Path remembered across sessions
- **WHEN** user loads a corpus from `/Users/me/docs`, closes the tab, and reopens the app
- **THEN** the folder input is pre-filled with `/Users/me/docs`
