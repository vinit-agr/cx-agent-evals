## Purpose

Frontend UI for uploading generated synthetic questions with ground truth to LangSmith as a dataset.

## Requirements

### Requirement: Upload button in QuestionList footer
The QuestionList component SHALL display a sticky footer with an "Upload to LangSmith" button. The footer SHALL appear only when generated questions exist and generation is not in progress. The button SHALL be styled consistently with the existing design system (dark theme, accent color).

#### Scenario: Footer appears after generation completes
- **WHEN** question generation finishes and questions are displayed in the list
- **THEN** a sticky footer with the "Upload to LangSmith" button SHALL appear at the bottom of the QuestionList panel

#### Scenario: Footer hidden during generation
- **WHEN** question generation is in progress
- **THEN** the upload footer SHALL NOT be displayed

#### Scenario: Footer hidden when no questions
- **WHEN** no questions have been generated
- **THEN** the upload footer SHALL NOT be displayed

### Requirement: Upload confirmation modal with editable dataset name
Clicking the upload button SHALL open a modal showing a pre-filled dataset name and a generation summary. The dataset name SHALL be auto-generated from the current strategy, corpus folder name, question count, and date in the format `{strategy}_{corpus-folder}_{count}q_{YYYY-MM-DD}`. Strategy names SHALL be shortened: `simple` → `simple`, `dimension-driven` → `dim-driven`, `real-world-grounded` → `rwg`. The user SHALL be able to edit the name before confirming.

#### Scenario: Default dataset name generated
- **WHEN** user clicks "Upload to LangSmith" with dimension-driven strategy, corpus at `/data/product-faq`, and 47 questions
- **THEN** the modal shows an editable name field pre-filled with `dim-driven_product-faq_47q_2026-02-05`

#### Scenario: Summary displays generation context
- **WHEN** the upload modal opens
- **THEN** it SHALL display: number of questions, number of source documents, strategy used, and corpus folder name

#### Scenario: User edits dataset name
- **WHEN** user modifies the dataset name in the input field and clicks Upload
- **THEN** the upload SHALL use the user-edited name

### Requirement: Upload progress bar
After the user confirms the upload, the modal SHALL transition to an uploading state showing a progress bar. The progress bar SHALL update after each batch of examples is successfully uploaded. The progress display SHALL show the count of uploaded examples out of the total (e.g., "40/47 uploaded") and the count of failed examples.

#### Scenario: Progress updates after each batch
- **WHEN** a batch of 20 examples is successfully uploaded
- **THEN** the progress bar advances and the uploaded count increases by the batch size

#### Scenario: Failed examples shown during upload
- **WHEN** a batch fails after all retry attempts
- **THEN** the failed count increments and is displayed alongside the progress bar

### Requirement: Upload completion with LangSmith link
When the upload finishes, the modal SHALL transition to a completion state showing the final count of uploaded and failed examples, the dataset name, and a clickable link that opens the LangSmith dataset page in a new browser tab.

#### Scenario: Successful upload completion
- **WHEN** all 47 examples upload successfully
- **THEN** the modal shows "47 uploaded, 0 failed" and a "View in LangSmith" link

#### Scenario: Partial upload completion
- **WHEN** 45 of 47 examples upload and 2 fail after retries
- **THEN** the modal shows "45 uploaded, 2 failed" and a "View in LangSmith" link to the partial dataset

#### Scenario: LangSmith link opens in new tab
- **WHEN** user clicks "View in LangSmith"
- **THEN** the LangSmith dataset page SHALL open in a new browser tab

### Requirement: Upload operates on currently visible questions
The upload SHALL always send the current `questions` state — the exact set of questions visible in the QuestionList at the time the upload button is clicked. If the user re-generates questions with a different strategy before uploading, the upload SHALL reflect the new questions, strategy, and corpus context.

#### Scenario: Re-generated questions replace previous data
- **WHEN** user generates 47 questions with dimension-driven, then re-generates 20 with simple, then clicks Upload
- **THEN** the upload sends 20 questions and the dataset name uses `simple` as the strategy prefix

### Requirement: Upload dataset API endpoint
The frontend SHALL call `POST /api/upload-dataset` with the questions, dataset name, and generation metadata. The endpoint SHALL respond with an SSE stream emitting progress events (`{ type: "progress", uploaded, total, failed }`) after each batch, a done event (`{ type: "done", datasetName, datasetUrl, uploaded, failed }`) on completion, or an error event (`{ type: "error", error }`) on failure.

#### Scenario: SSE progress events streamed
- **WHEN** the upload endpoint processes 47 examples in batches of 20
- **THEN** it emits at least 3 progress events (after batches of 20, 20, 7) and one done event

#### Scenario: Missing LANGSMITH_API_KEY
- **WHEN** `LANGSMITH_API_KEY` is not set in the environment
- **THEN** the endpoint SHALL return an error response before attempting upload
