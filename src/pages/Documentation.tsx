import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import tidyimportLogo from '@/assets/tidyimport-logo.png';

export default function Documentation() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b bg-secondary sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <img src={tidyimportLogo} alt="TidyImport" className="h-10" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
              <Button onClick={handlePrint}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Print Header - only visible in print */}
      <div className="hidden print:block print:mb-8">
        <img src={tidyimportLogo} alt="TidyImport" className="h-12 mb-4" />
      </div>

      {/* Documentation Content */}
      <main className="container mx-auto px-6 py-8 max-w-4xl print:max-w-none print:px-0">
        <article className="prose prose-slate dark:prose-invert max-w-none print:prose-sm">
          <div className="flex items-center gap-3 mb-8 print:hidden">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold mb-1">Project Documentation</h1>
              <p className="text-muted-foreground">TidyImport - Data Cleaning Tool for CRM Import</p>
            </div>
          </div>

          {/* Title for Print */}
          <h1 className="hidden print:block text-2xl font-bold mb-2">TidyImport - Project Documentation</h1>
          <p className="hidden print:block text-sm text-gray-600 mb-6">Data Cleaning Tool for CRM Import • Generated: January 23, 2026</p>

          {/* Executive Summary */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Executive Summary</h2>
            <p className="mb-4">
              TidyImport is a professional-grade data cleaning tool designed for preparing client lists 
              for CRM import. It provides AI-powered header mapping, surgical per-cell data 
              cleaning, interactive issue resolution, and export capabilities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
              <div className="p-4 bg-muted rounded-lg print:border print:bg-white">
                <h4 className="font-semibold mb-2">Key Capabilities</h4>
                <ul className="text-sm space-y-1">
                  <li>• File Upload: CSV, XLS, XLSX (5,000 row limit)</li>
                  <li>• AI Header Mapping with confidence scores</li>
                  <li>• Surgical per-cell data cleaning</li>
                  <li>• Interactive issue resolution</li>
                  <li>• Secure CSV/Excel export</li>
                </ul>
              </div>
              <div className="p-4 bg-muted rounded-lg print:border print:bg-white">
                <h4 className="font-semibold mb-2">Technology Stack</h4>
                <ul className="text-sm space-y-1">
                  <li>• React 18.3 + TypeScript</li>
                  <li>• Vite + Tailwind CSS</li>
                  <li>• Lovable Cloud (Edge Functions)</li>
                  <li>• Google Gemini AI</li>
                  <li>• ExcelJS for file handling</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Target CRM Schema */}
          <section className="mb-8 print:break-before-page">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Target CRM Schema</h2>
            <p className="mb-4">The output file contains exactly these columns in order:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted print:bg-gray-100">
                    <th className="border px-3 py-2 text-left">Column</th>
                    <th className="border px-3 py-2 text-left">Required</th>
                    <th className="border px-3 py-2 text-left">Format / Constraints</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border px-3 py-2">Email</td><td className="border px-3 py-2">Yes</td><td className="border px-3 py-2">Valid email format (lowercase, no spaces)</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2 font-semibold">First Name</td><td className="border px-3 py-2 font-semibold">REQUIRED</td><td className="border px-3 py-2">Max 26 characters, Proper Case</td></tr>
                  <tr><td className="border px-3 py-2">Last Name</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Max 26 characters, Proper Case</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Phone</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Digits only (all formatting stripped)</td></tr>
                  <tr><td className="border px-3 py-2">Address</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Free text</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Birthday</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">MM/DD/YYYY format</td></tr>
                  <tr><td className="border px-3 py-2">Time Zone</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Must match valid timezone list (100+ values)</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Status</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Must be: Lead, Customer, or VIP</td></tr>
                  <tr><td className="border px-3 py-2">Tags</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Pipe-separated (tag1|tag2|tag3)</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Notes</td><td className="border px-3 py-2">No</td><td className="border px-3 py-2">Free text</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Cleaning Rules */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Data Cleaning Rules</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted print:bg-gray-100">
                    <th className="border px-3 py-2 text-left">Column</th>
                    <th className="border px-3 py-2 text-left">Cleaning Applied</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border px-3 py-2">Email</td><td className="border px-3 py-2">Lowercase, remove internal spaces</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Phone</td><td className="border px-3 py-2">Remove all non-digit characters</td></tr>
                  <tr><td className="border px-3 py-2">First Name / Last Name</td><td className="border px-3 py-2">Convert to Proper Case (JOHN → John)</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Birthday</td><td className="border px-3 py-2">Normalize to MM/DD/YYYY format</td></tr>
                  <tr><td className="border px-3 py-2">Time Zone</td><td className="border px-3 py-2">Alias mapping (PST → Pacific Time (US & Canada))</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">Status</td><td className="border px-3 py-2">Normalize case (lead → Lead)</td></tr>
                  <tr><td className="border px-3 py-2">Tags</td><td className="border px-3 py-2">Convert separators to pipe (comma/semicolon → |)</td></tr>
                  <tr className="bg-muted/50 print:bg-gray-50"><td className="border px-3 py-2">All Fields</td><td className="border px-3 py-2">Clear "N/A", "null", "undefined" → empty string</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Architecture */}
          <section className="mb-8 print:break-before-page">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Code Architecture</h2>
            <h3 className="text-lg font-semibold mb-3">Project Structure</h3>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:border">
{`├── src/
│   ├── pages/
│   │   └── Index.tsx              # Main application (3-step wizard)
│   ├── components/
│   │   ├── FileUpload.tsx         # Drag & drop file input
│   │   ├── MappingTable.tsx       # Header mapping UI
│   │   ├── DataPreview.tsx        # Editable data table
│   │   ├── CleaningSummary.tsx    # Cleaning statistics
│   │   ├── DuplicateResolver.tsx  # Email duplicate handler
│   │   ├── TimezoneResolver.tsx   # Missing timezone handler
│   │   ├── StatusResolver.tsx     # Missing status handler
│   │   ├── NameLengthResolver.tsx # Name length handler
│   │   └── DataIssuesResolver.tsx # Phone dupes & missing emails
│   ├── lib/
│   │   ├── cleaningEngine.ts      # Core cleaning logic
│   │   └── fileParser.ts          # File parsing & export
│   └── hooks/
│       └── useHeaderMapping.ts    # AI mapping state
├── supabase/
│   └── functions/
│       └── map-headers/           # AI header mapping edge function`}
            </pre>
          </section>

          {/* Data Flow */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Data Processing Pipeline</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <h4 className="font-semibold">File Parsing</h4>
                  <p className="text-sm text-muted-foreground">Parse CSV/Excel, extract headers and rows, validate 5,000 row limit</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <h4 className="font-semibold">AI Header Mapping</h4>
                  <p className="text-sm text-muted-foreground">Send headers to Gemini AI, receive mappings with confidence scores</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <h4 className="font-semibold">Data Processing</h4>
                  <p className="text-sm text-muted-foreground">Apply mappings, perform per-cell surgical cleaning, track modifications</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <h4 className="font-semibold">Issue Resolution</h4>
                  <p className="text-sm text-muted-foreground">Interactive resolvers for duplicates, timezones, status, name length</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">5</span>
                <div>
                  <h4 className="font-semibold">Preview & Edit</h4>
                  <p className="text-sm text-muted-foreground">Scrollable table with inline editing, row skipping, validation highlights</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg print:border print:bg-white">
                <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">6</span>
                <div>
                  <h4 className="font-semibold">Export</h4>
                  <p className="text-sm text-muted-foreground">Generate sanitized Excel/CSV, exclude skipped rows, download</p>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Reference */}
          <section className="mb-8 print:break-before-page">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Feature Reference</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">1. File Upload</h3>
            <ul className="list-disc list-inside text-sm space-y-1 mb-4">
              <li>Drag & drop or click to browse</li>
              <li>Supports CSV, XLS, XLSX formats</li>
              <li>5,000 row limit</li>
              <li>Privacy: Only headers sent to AI, not row data</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">2. AI Header Mapping</h3>
            <ul className="list-disc list-inside text-sm space-y-1 mb-4">
              <li>Powered by Google Gemini 2.5 Flash</li>
              <li>Confidence scores: Green (≥0.8), Yellow (0.5-0.79), Red (&lt;0.5)</li>
              <li>Manual override for any mapping</li>
              <li>Custom field support for non-standard columns</li>
              <li>Reset to AI suggestions button</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">3. Interactive Issue Resolvers</h3>
            <ul className="list-disc list-inside text-sm space-y-1 mb-4">
              <li><strong>DuplicateResolver:</strong> Handle email duplicates - select which to keep</li>
              <li><strong>TimezoneResolver:</strong> Bulk/individual timezone assignment</li>
              <li><strong>StatusResolver:</strong> Assign Lead, Customer, or VIP status</li>
              <li><strong>NameLengthResolver:</strong> Fix names exceeding 26 characters</li>
              <li><strong>DataIssuesResolver:</strong> Phone duplicates & missing emails</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">4. Export Options</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Excel (.xlsx) with formatted headers</li>
              <li>CSV (.csv) standard format</li>
              <li>CSV injection prevention (formula character escaping)</li>
              <li>Automatic exclusion of skipped rows</li>
            </ul>
          </section>

          {/* Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">Security Measures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg print:bg-white">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✓ Data Privacy</h4>
                <p className="text-sm">No data persistence - all processing happens client-side. Only column headers are sent to AI.</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg print:bg-white">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">✓ Export Security</h4>
                <p className="text-sm">CSV injection prevention - formula characters (=, +, -, @) are escaped with single quote prefix.</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-12 pt-4 border-t text-sm text-muted-foreground">
            <p>Generated by TidyImport Documentation System</p>
            <p>Version 2.0 • January 2026</p>
          </footer>
        </article>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in 0.5in 0.5in 0.5in;
            size: 8.5in 11in;
          }
          
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 10pt !important;
            line-height: 1.4 !important;
          }
          
          .prose {
            max-width: none !important;
            font-size: 10pt !important;
          }
          
          .prose h1 {
            font-size: 18pt !important;
            margin-bottom: 8pt !important;
          }
          
          .prose h2 {
            font-size: 14pt !important;
            margin-top: 12pt !important;
            margin-bottom: 6pt !important;
          }
          
          .prose h3 {
            font-size: 11pt !important;
            margin-top: 8pt !important;
            margin-bottom: 4pt !important;
          }
          
          .prose h4 {
            font-size: 10pt !important;
          }
          
          .prose p, .prose li {
            font-size: 9pt !important;
            margin-bottom: 4pt !important;
          }
          
          .prose table {
            font-size: 8pt !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          
          .prose table th,
          .prose table td {
            padding: 4pt 6pt !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          
          .prose pre {
            font-size: 7pt !important;
            padding: 8pt !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-x: hidden !important;
            max-width: 100% !important;
          }
          
          .prose ul {
            margin-top: 2pt !important;
            margin-bottom: 6pt !important;
          }
          
          section {
            page-break-inside: avoid;
          }
          
          .grid {
            display: block !important;
          }
          
          .grid > div {
            margin-bottom: 8pt !important;
            page-break-inside: avoid !important;
          }
          
          /* Ensure tables don't overflow */
          .overflow-x-auto {
            overflow: visible !important;
          }
          
          /* Pipeline steps - more compact */
          .space-y-3 > div {
            padding: 6pt !important;
            margin-bottom: 4pt !important;
          }
          
          .space-y-3 .text-sm {
            font-size: 8pt !important;
          }
          
          /* Numbered circles smaller */
          .w-6.h-6 {
            width: 16pt !important;
            height: 16pt !important;
            font-size: 8pt !important;
          }
          
          /* Footer */
          footer {
            margin-top: 16pt !important;
            font-size: 8pt !important;
          }
        }
      `}</style>
    </div>
  );
}
