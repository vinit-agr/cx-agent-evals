## ADDED Requirements

### Requirement: POST /api/discover-dimensions endpoint
The API SHALL accept a JSON body `{ url: string }` and return `{ dimensions: Array<{ name: string, description: string, values: string[] }> }`. It SHALL use the backend library's `discoverDimensions()` function with a temporary output path.

#### Scenario: Successful discovery
- **WHEN** POST `/api/discover-dimensions` with `{ "url": "https://example.com" }`
- **THEN** response is 200 with discovered dimensions array

#### Scenario: Missing URL
- **WHEN** POST `/api/discover-dimensions` with no URL
- **THEN** response is 400 with `{ "error": "url is required" }`

#### Scenario: Missing OPENAI_API_KEY
- **WHEN** the `OPENAI_API_KEY` environment variable is not set
- **THEN** response is 500 with `{ "error": "OPENAI_API_KEY environment variable is required" }`

#### Scenario: Discovery failure
- **WHEN** the website cannot be fetched or LLM fails
- **THEN** response is 500 with `{ "error": "<descriptive message>" }`
