# TidyImport - Project Documentation
## Data Cleaning Tool for CRM Import

**Version:** 2.0  
**Generated:** January 23, 2026  
**Platform:** Lovable (React + Vite + TypeScript + Tailwind CSS)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Requirements Specification](#requirements-specification)
3. [Code Architecture](#code-architecture)
4. [Data Flow](#data-flow)
5. [Feature Reference](#feature-reference)
6. [Technical Reference](#technical-reference)

---

## Executive Summary

TidyImport is a professional-grade data cleaning tool designed for preparing client lists for CRM import. It provides AI-powered header mapping, surgical per-cell data cleaning, interactive issue resolution, and export capabilities.

### Key Capabilities
- **File Upload**: CSV, XLS, XLSX with 5,000 row limit
- **AI Header Mapping**: Uses Lovable AI (Google Gemini 2.5 Flash) for intelligent column matching
- **Name Splitting**: Automatically detects and splits combined "Full Name" columns
- **Address Consolidation**: Combines separate address components into a single field
- **Birthday Format Detection**: Identifies date formats for accurate parsing
- **Surgical Cleaning**: Per-cell transformations preserving valid data
- **Quality Validation**: Duplicate detection, missing field alerts, format validation
- **Interactive Resolvers**: UI for handling duplicates, timezones, status (with bulk approval), names, birthdays, and data issues
- **Secure Export**: CSV injection prevention, formatted output

### Data Privacy
- **All data processing happens in the browser** - actual row data never leaves the client
- **Only column headers are sent to AI** for mapping suggestions
- No data persistence - everything is processed client-side

---

## Requirements Specification

### Original Requirements
Build a web-based app where users can drag and drop any client export file (CSV or XLSX). The app uses AI to automatically map headers from the source file to a specific CRM format and performs "surgical" cleaning to remove formatting errors while never deleting actual client data.

### Target CRM Schema
The output file must contain exactly these columns, in this order:

| Column | Required | Format/Constraints |
|--------|----------|-------------------|
| Email | Yes | Valid email format (lowercase, no spaces) |
| First Name | **REQUIRED** | Max 26 characters, Proper Case |
| Last Name | No | Max 26 characters, Proper Case |
| Phone | No | Digits only (all formatting stripped) |
| Address | No | Free text |
| Birthday | No | MM/DD/YYYY format |
| Time Zone | No | Must match vcita timezone list (100+ valid values) |
| Status | No | Must be: Lead, Customer, or VIP |
| Tags | No | Pipe-separated format (tag1\|tag2\|tag3) |
| Notes | No | Free text |

### Business Rules

#### File Constraints
- Maximum 5,000 rows per import
- Maximum 1MB file size
- Supported formats: CSV, XLS, XLSX
- Headers must be in first row

#### Cleaning Rules
1. **Email**: Lowercase, remove internal spaces
2. **Phone**: Strip all non-numeric characters, international support
3. **Names**: Convert to Proper Case (JOHN → John)
4. **Birthday**: Normalize to MM/DD/YYYY from various input formats
5. **Time Zone**: Smart alias mapping (PST → Pacific Time (US & Canada))
6. **Status**: Normalize case (lead → Lead)
7. **Tags**: Convert separators to pipes (comma/semicolon → |)
8. **Empty Values**: Clear "N/A", "null", "undefined" → empty string
9. **CSV Injection**: Prefix formula characters (=, +, -, @) with single quote

#### Validation Rules
- First Name is required (flagged if missing)
- Names must be ≤26 characters
- Email duplicates are flagged for resolution
- Invalid timezone values are flagged
- Invalid status values are flagged (with bulk approval option)

---

## Code Architecture

### Project Structure

```
├── src/
│   ├── pages/
│   │   ├── Index.tsx              # Main application (5-step wizard)
│   │   └── Documentation.tsx      # Documentation viewer with PDF export
│   ├── components/
│   │   ├── FileUpload.tsx         # Drag & drop file input
│   │   ├── MappingTable.tsx       # Header mapping UI with confidence
│   │   ├── DataPreview.tsx        # Editable data table
│   │   ├── CleaningSummary.tsx    # Cleaning statistics display
│   │   ├── StepIndicator.tsx      # Progress indicator
│   │   ├── NameSplitterResolver.tsx    # Full name splitting handler
│   │   ├── AddressConsolidatorResolver.tsx # Address component combiner
│   │   ├── BirthdayFormatResolver.tsx  # Birthday format detection
│   │   ├── DuplicateResolver.tsx  # Email duplicate handler
│   │   ├── TimezoneResolver.tsx   # Missing timezone handler
│   │   ├── StatusResolver.tsx     # Missing/invalid status handler with bulk approval
│   │   ├── NameLengthResolver.tsx # Name character limit handler
│   │   ├── DataIssuesResolver.tsx # Phone duplicates & missing emails
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── cleaningEngine.ts      # Core cleaning logic (1200+ lines)
│   │   ├── fileParser.ts          # File parsing & export
│   │   └── utils.ts               # Utility functions
│   ├── hooks/
│   │   └── useHeaderMapping.ts    # AI mapping state management
│   └── assets/
│       └── tidyimport-logo.png    # TidyImport brand logo
├── supabase/
│   └── functions/
│       └── map-headers/
│           └── index.ts           # AI header mapping edge function
└── docs/
    └── PROJECT_DOCUMENTATION.md   # This file
```

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                      Index.tsx (Main)                        │
│                   State Management Hub                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐
│  Step 1       │  │  Step 2       │  │  Step 3-5           │
│  FileUpload   │  │  MappingTable │  │  Preview & Export   │
└───────────────┘  └───────────────┘  └─────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐
│ Pre-Mapping   │  │ useHeader     │  │ Issue Resolvers     │
│ Resolvers:    │  │ Mapping.ts    │  │ ├─ DuplicateResolver│
│ ├─ NameSplit  │  │ (AI Hook)     │  │ ├─ TimezoneResolver │
│ └─ AddressCon │  └───────────────┘  │ ├─ StatusResolver   │
└───────────────┘          │          │ ├─ NameLengthRes... │
                           ▼          │ ├─ BirthdayFormat...|
                   ┌───────────────┐  │ └─ DataIssuesRes... │
                   │ Edge Function │  └─────────────────────┘
                   │ map-headers   │            │
                   └───────────────┘            ▼
                                      ┌─────────────────────┐
                                      │ DataPreview         │
                                      │ (Editable Table)    │
                                      └─────────────────────┘
```

### Key Modules

#### `cleaningEngine.ts` (Core)
- **Constants**: TARGET_HEADERS, MAX_NAME_LENGTH (26), VALID_STATUSES, VALID_TIME_ZONES, TIMEZONE_ALIASES
- **Types**: HeaderMapping, CleaningStats, RowValidation, DuplicateGroup, AddressComponent, NameSplitDetection, BirthdayFormat
- **Name Handling**: splitFullName(), detectFullNameColumn()
- **Address Handling**: detectAddressComponentColumns(), consolidateAddress()
- **Cleaners**: cleanEmail, cleanPhone, cleanStatus, cleanTags, cleanTimeZone, cleanBirthday, toProperCase
- **Validators**: validateEmailFormat, validateStatus, validateTimeZone, validateRows
- **Processors**: processData, detectDuplicates, getRowsWithMissingTimezone, getRowsWithMissingStatus, getRowsWithInvalidStatus, getRowsWithNameTooLong
- **Security**: sanitizeForExport (CSV injection prevention)

#### `fileParser.ts`
- **parseFile()**: Handles CSV and Excel files with smart delimiter detection
- **generateExcel()**: Creates formatted .xlsx output
- **generateCSV()**: Creates sanitized .csv output
- **sanitizeData()**: Applies phone formatting and CSV injection prevention

#### `useHeaderMapping.ts` (Hook)
- **getMappingsFromAI()**: Calls edge function for AI mapping
- **fallbackMapping()**: Keyword-based matching if AI fails
- **updateMapping()**: Manual mapping updates
- **addCustomField()**: User-defined additional fields
- **resetToOriginal()**: Restore AI suggestions
- **addressComponents**: Detected address component columns
- **nameSplitColumn**: Detected combined name column

#### `map-headers/index.ts` (Edge Function)
- Uses Lovable AI Gateway (Google Gemini 2.5 Flash)
- Returns confidence scores (0-1) for each mapping
- Detects address component columns for consolidation
- Detects combined name columns for splitting
- Handles rate limits (429) and credit exhaustion (402)

---

## Data Flow

### Complete Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT                                   │
│  User uploads CSV/XLSX file (max 1MB, 5000 rows)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: FILE PARSING                                           │
│  ├─ parseFile() reads CSV or Excel                              │
│  ├─ Extracts headers and rows                                   │
│  ├─ Validates row count (max 5,000) and file size (max 1MB)     │
│  └─ Generates sample data for each header                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1.5: PRE-MAPPING RESOLUTION                               │
│  ├─ NameSplitterResolver: Split "Full Name" → First + Last      │
│  └─ AddressConsolidatorResolver: Combine address components     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: AI HEADER MAPPING                                      │
│  ├─ Send ONLY HEADERS to map-headers edge function              │
│  ├─ AI suggests target mappings with confidence                 │
│  ├─ User reviews and adjusts mappings                           │
│  └─ Optional: Add custom fields                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: DATA PROCESSING                                        │
│  ├─ processData() applies header mappings                       │
│  ├─ cleanCell() performs per-cell surgical cleaning             │
│  ├─ Tracks CleaningStats (modifications made)                   │
│  └─ validateRows() runs quality checks                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: ISSUE RESOLUTION (Sequential)                          │
│  ├─ 1. DuplicateResolver → Remove email duplicates              │
│  ├─ 2. TimezoneResolver → Assign missing timezones              │
│  ├─ 3. StatusResolver → Assign missing/invalid statuses         │
│  │      └─ Bulk approval for non-standard statuses              │
│  ├─ 4. NameLengthResolver → Fix names > 26 chars                │
│  ├─ 5. BirthdayFormatResolver → Confirm date format             │
│  └─ 6. DataIssuesResolver → Phone dupes & missing emails        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: PREVIEW & MANUAL EDITING                               │
│  ├─ DataPreview shows scrollable table (10 rows default)        │
│  ├─ Inline editing for any cell                                 │
│  ├─ Toggle rows to skip from export                             │
│  └─ Real-time validation highlighting                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: EXPORT                                                 │
│  ├─ sanitizeData() prevents CSV injection                       │
│  ├─ formatPhoneNumber() applies XXX-XXX-XXXX format             │
│  ├─ Format: Excel (.xlsx) or CSV (.csv)                         │
│  ├─ Includes all edits, excludes skipped rows                   │
│  └─ Download: cleaned_{original_filename}.{format}              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Reference

### 1. File Upload
- **Drag & drop** or click to browse
- Supports CSV, XLS, XLSX
- **5,000 row limit**
- **1MB file size limit**
- Immediate parsing feedback with toast notifications
- **Privacy**: Only headers sent to AI (not row data)
- Loading state shows "Thinking..." during processing

### 2. Name Splitting (Pre-Mapping)
- **Automatic detection** of combined name columns (Full Name, Name, Client Name, etc.)
- **AI-assisted** detection via edge function
- **Fallback** keyword detection if AI unavailable
- **Interactive preview** showing how names will be split
- **Options**: Split names, keep original column, or skip
- Uses intelligent splitting algorithm handling:
  - Standard "First Last" format
  - "Last, First" format (comma-separated)
  - Multiple middle names
  - Suffixes (Jr., Sr., III, etc.)

### 3. Address Consolidation (Pre-Mapping)
- **Automatic detection** of address component columns
- Detects: Street, Address Line 2, City, State, Zip, Country
- **Customizable separator** (default: ", ")
- **Preview** of consolidated addresses
- **Options**: Consolidate, keep separate, or skip
- Logical ordering: street → street2 → city → state → zip → country

### 4. AI-Powered Header Mapping
- Uses **Google Gemini 2.5 Flash** via Lovable AI Gateway
- Returns confidence scores (0.0 - 1.0)
- **Color-coded confidence**: Green (≥0.8), Yellow (0.5-0.79), Red (<0.5)
- Manual override for any mapping
- **Custom field support**: Add non-standard columns
- **Reset to AI** button to restore original suggestions
- Shows sample data (3 values) for each source header
- **Data Privacy**: Only column headers are sent to AI

### 5. Surgical Data Cleaning Engine
Per-cell transformations by column type:

| Column | Cleaning Applied |
|--------|-----------------|
| Email | Lowercase, remove spaces |
| Phone | Remove all non-digits (formatting applied on export) |
| First Name | Proper Case |
| Last Name | Proper Case |
| Birthday | Normalize to MM/DD/YYYY |
| Time Zone | Alias mapping (PST → Pacific Time) |
| Status | Normalize case (lead → Lead) |
| Tags | Convert separators to pipe (\|) |
| All | Clear N/A, null, undefined values |

### 6. Data Validation & Quality Warnings

| Issue Type | Detection Logic |
|------------|----------------|
| Missing First Name | Required field empty |
| Invalid Email | Fails regex validation |
| Email Duplicates | Same email in multiple rows |
| Phone Duplicates | Same phone in multiple rows |
| Name Too Long | First/Last Name > 26 chars |
| Invalid Timezone | Not in valid timezone list |
| Invalid Status | Not Lead/Customer/VIP (can be bulk approved) |
| Missing Timezone | Empty timezone field |
| Missing Status | Empty status field |

### 7. Interactive Issue Resolvers

#### NameSplitterResolver (Pre-Mapping)
- Detects combined name columns
- Shows preview of split results
- Options to split or keep original

#### AddressConsolidatorResolver (Pre-Mapping)
- Detects address component columns
- Customizable separator
- Preview of consolidated addresses

#### BirthdayFormatResolver
- Detects birthday column format
- Supports: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
- Shows sample values for confirmation
- Accurate parsing based on confirmed format

#### DuplicateResolver
- Groups rows by duplicate email
- User selects which row to keep
- Others removed from export
- "Keep All" option available

#### TimezoneResolver
- Lists clients with missing timezone
- Bulk assign from dropdown
- Individual assignment supported
- Skip to leave empty

#### StatusResolver
- Lists clients with missing OR invalid status
- **Bulk approval for non-standard statuses**: Click to approve all instances of a custom status (e.g., "Prospect")
- Assign Lead, Customer, or VIP for missing
- Individual or bulk assignment
- Dynamic counter updates when items are resolved

#### NameLengthResolver
- Shows names exceeding 26 characters
- Inline editing to shorten
- Mark rows to skip from export
- Live character count

#### DataIssuesResolver
- Phone duplicate handling
- Missing email flagging
- Inline editing for fixes

### 8. Data Preview & Manual Editing
- **Scrollable table** with sticky header row
- Default view: 10 rows (expandable to all)
- **Inline editing**: Click any cell to modify
- **Row skipping**: Toggle checkbox to exclude
- **Real-time stats**: Total rows, skipped count
- **Validation highlighting**: Yellow for warnings

### 9. Export Options
- **Excel (.xlsx)**: Formatted with styled headers
- **CSV (.csv)**: Standard comma-separated
- **Phone formatting**: Applied on export (XXX-XXX-XXXX)
- **Includes**: All edits, custom fields
- **Excludes**: Skipped rows
- **Security**: CSV injection prevention (prefix formula chars)

### 10. User Experience
- **5-step wizard** with visual progress
- **TidyImport branding** with centered logo
- **Start Over** button (resets all state)
- **Toast notifications** for all actions
- **Loading states** during processing ("Thinking...")
- **Privacy notice** on upload step
- **Documentation page** at /docs with PDF export

---

## Technical Reference

### Dependencies
- **React 18.3** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **ExcelJS** - Excel file handling
- **Supabase** - Edge functions (Lovable Cloud)
- **Sonner** - Toast notifications
- **Lucide React** - Icons
- **date-fns** - Date formatting

### Valid Time Zones (100+)
The system supports a comprehensive timezone list including:
- US: Eastern, Central, Mountain, Pacific, Alaska, Hawaii, Arizona, Indiana
- Canada: Atlantic, Newfoundland, Saskatchewan
- Europe: London, Paris, Berlin, Rome, Madrid, Amsterdam, etc.
- Asia: Tokyo, Beijing, Singapore, Hong Kong, Bangkok, etc.
- Pacific: Sydney, Auckland, Fiji, etc.
- And many more...

### Timezone Aliases
Common abbreviations are automatically converted:
- EST/EDT/ET → Eastern Time (US & Canada)
- CST/CDT/CT → Central Time (US & Canada)
- MST/MDT/MT → Mountain Time (US & Canada)
- PST/PDT/PT → Pacific Time (US & Canada)
- GMT/BST → London
- JST → Tokyo
- AEST/AEDT → Sydney
- etc.

### Security Measures
1. **No data persistence** - All processing client-side
2. **Headers only to AI** - Row data never leaves browser
3. **CSV injection prevention** - Formula characters escaped
4. **Sanitized exports** - All values validated before download
5. **Input validation** - File type and size limits enforced

### State Management
- React useState for local component state
- useMemo for computed values (duplicates, validations)
- useCallback for memoized handlers
- Custom hook (useHeaderMapping) for AI mapping state

---

## Appendix: CleaningStats Interface

```typescript
interface CleaningStats {
  totalRows: number;
  emailsCleaned: number;
  phonesNormalized: number;
  emptyValuesCleared: number;
  namesToProperCase: number;
  totalCellsModified: number;
  statusValidated: number;
  timeZoneValidated: number;
  tagsFormatted: number;
  birthdayFormatted: number;
}
```

## Appendix: Supported Birthday Formats

```typescript
type BirthdayFormat = 
  | 'MM/DD/YYYY'   // 01/15/1990
  | 'DD/MM/YYYY'   // 15/01/1990
  | 'YYYY-MM-DD'   // 1990-01-15
  | 'MM-DD-YYYY'   // 01-15-1990
  | 'DD-MM-YYYY';  // 15-01-1990
```

---

*Generated by TidyImport Documentation System*
