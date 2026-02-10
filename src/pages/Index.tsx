import { useState, useCallback, useMemo, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MappingTable } from '@/components/MappingTable';
import { DataPreview } from '@/components/DataPreview';
import { StepIndicator } from '@/components/StepIndicator';
import { CleaningSummary } from '@/components/CleaningSummary';
import { DuplicateResolver } from '@/components/DuplicateResolver';
import { TimezoneResolver } from '@/components/TimezoneResolver';
import { StatusResolver } from '@/components/StatusResolver';
import { NameLengthResolver } from '@/components/NameLengthResolver';
import { DataIssuesResolver } from '@/components/DataIssuesResolver';
import { AddressConsolidatorResolver } from '@/components/AddressConsolidatorResolver';
import { NameSplitterResolver } from '@/components/NameSplitterResolver';
import { BirthdayFormatResolver, type BirthdayFormat } from '@/components/BirthdayFormatResolver';
import { Button } from '@/components/ui/button';
import { 
  parseFile, 
  generateExcel, 
  generateCSV,
  type ParsedFile,
  type ExportFormat 
} from '@/lib/fileParser';
import { 
  processData, 
  TARGET_HEADERS, 
  getSampleValues,
  validateRows,
  detectDuplicates,
  getRowsWithMissingTimezone,
  getRowsWithMissingStatus,
  getRowsWithInvalidStatus,
  getRowsWithNameTooLong,
  reformatBirthdays,
  MAX_NAME_LENGTH,
  type CleaningStats,
  type RowValidation,
  type DuplicateGroup
} from '@/lib/cleaningEngine';
import { useHeaderMapping } from '@/hooks/useHeaderMapping';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Download, Shield } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import intandemLogo from '@/assets/intandem-logo.svg';
import tidyImportLogo from '@/assets/tidyimport-logo.png';

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Map Headers' },
  { id: 3, label: 'Preview & Export' },
];

// Internal step mapping: 
// step 2 = name splitting, step 3 = address consolidation, step 4 = header mapping review, step 5+ = preview & export
const getDisplayStep = (internalStep: number) => {
  if (internalStep === 1) return 1;
  if (internalStep === 2 || internalStep === 3 || internalStep === 4) return 2; // Name split, address consolidation, and header mapping show as "Map Headers"
  return 3; // Preview & Export
};

const MAX_ROWS = 5000;

export default function Index() {
  const [step, setStep] = useState(1);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [cleanedData, setCleanedData] = useState<Record<string, string>[]>([]);
  const [cleaningStats, setCleaningStats] = useState<CleaningStats | null>(null);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, string[]>>({});
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [duplicatesResolved, setDuplicatesResolved] = useState(false);
  const [timezonesResolved, setTimezonesResolved] = useState(false);
  const [statusResolved, setStatusResolved] = useState(false);
  const [nameLengthResolved, setNameLengthResolved] = useState(false);
  const [dataIssuesResolved, setDataIssuesResolved] = useState(false);
  const [addressConsolidationResolved, setAddressConsolidationResolved] = useState(false);
  const [addressesConsolidatedCount, setAddressesConsolidatedCount] = useState(0);
  const [birthdayFormatResolved, setBirthdayFormatResolved] = useState(false);
  const [nameSplitResolved, setNameSplitResolved] = useState(false);
  const [rowsToSkip, setRowsToSkip] = useState<Set<number>>(new Set());
  
  // Export options
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  
  const { 
    mappings,
    setMappings,
    getMappingsFromAI, 
    updateMapping, 
    resetToOriginal,
    renameSourceHeader,
    hasBeenModified,
    isLoading: isMappingLoading,
    customFields,
    addCustomField,
    addressComponents,
    clearAddressComponents,
    nameSplitColumn,
    clearNameSplitColumn,
  } = useHeaderMapping();

  // Calculate rows with missing timezone (excluding already skipped rows)
  const rowsWithMissingTimezone = useMemo(() => {
    return getRowsWithMissingTimezone(cleanedData).filter(idx => !rowsToSkip.has(idx));
  }, [cleanedData, rowsToSkip]);

  // Calculate rows with missing or invalid status (excluding already skipped rows)
  const rowsWithMissingStatus = useMemo(() => {
    return getRowsWithMissingStatus(cleanedData).filter(idx => !rowsToSkip.has(idx));
  }, [cleanedData, rowsToSkip]);
  
  const rowsWithInvalidStatus = useMemo(() => {
    return getRowsWithInvalidStatus(cleanedData).filter(idx => !rowsToSkip.has(idx));
  }, [cleanedData, rowsToSkip]);
  
  // Combined list: missing + invalid statuses for the resolver
  const rowsWithStatusIssues = useMemo(() => {
    const combined = new Set([...rowsWithMissingStatus, ...rowsWithInvalidStatus]);
    return Array.from(combined).sort((a, b) => a - b);
  }, [rowsWithMissingStatus, rowsWithInvalidStatus]);

  // Calculate rows with names too long
  const rowsWithNameTooLong = useMemo(() => {
    return getRowsWithNameTooLong(cleanedData);
  }, [cleanedData]);

  // Auto-advance from step 2 (name split) to step 3 (address consolidation) when no name split needed
  useEffect(() => {
    if (step === 2 && parsedFile && (!nameSplitColumn || nameSplitResolved)) {
      setStep(3);
    }
  }, [step, parsedFile, nameSplitColumn, nameSplitResolved]);

  // Auto-advance from step 3 (address consolidation) to step 4 (mapping) when no address components need consolidation
  useEffect(() => {
    if (step === 3 && parsedFile && (addressComponents.length < 2 || addressConsolidationResolved)) {
      setStep(4);
    }
  }, [step, parsedFile, addressComponents.length, addressConsolidationResolved]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessingFile(true);
    
    try {
      const parsed = await parseFile(file);
      
      // Hard limit: 5,000 rows for vcita
      if (parsed.rows.length > MAX_ROWS) {
        toast.error(
          `File has ${parsed.rows.length.toLocaleString()} rows. inTandem allows a maximum of ${MAX_ROWS.toLocaleString()} clients per import.`,
          { duration: 7000 }
        );
        setIsProcessingFile(false);
        return;
      }
      
      setParsedFile(parsed);
      
      // Generate sample data for each header
      const samples: Record<string, string[]> = {};
      parsed.headers.forEach(header => {
        samples[header] = getSampleValues(parsed.rows, header, 3);
      });
      setSampleData(samples);
      
      toast.success(`Loaded ${parsed.rows.length} rows from ${file.name}`);
      
      // Get AI mappings
      await getMappingsFromAI(parsed.headers);
      
      // Move to name split step (or auto-advance if no name split needed)
      setStep(2);
    } catch (error) {
      console.error('Failed to parse file:', error);
      toast.error('Failed to parse file. Please check the format.');
    } finally {
      setIsProcessingFile(false);
    }
  }, [getMappingsFromAI]);

  // Handler to rename source header - updates both mappings and parsed file data
  const handleRenameSourceHeader = useCallback((oldHeader: string, newHeader: string) => {
    // Update mappings via hook
    renameSourceHeader(oldHeader, newHeader);
    
    // Update parsed file headers and row keys
    if (parsedFile) {
      const updatedHeaders = parsedFile.headers.map(h => h === oldHeader ? newHeader : h);
      const updatedRows = parsedFile.rows.map(row => {
        const newRow: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          newRow[key === oldHeader ? newHeader : key] = value;
        });
        return newRow;
      });
      setParsedFile({
        ...parsedFile,
        headers: updatedHeaders,
        rows: updatedRows,
      });
      
      // Update sample data keys
      setSampleData(prev => {
        const updated: Record<string, string[]> = {};
        Object.entries(prev).forEach(([key, value]) => {
          updated[key === oldHeader ? newHeader : key] = value;
        });
        return updated;
      });
    }
  }, [parsedFile, renameSourceHeader]);

  const handleProcess = useCallback(() => {
    if (!parsedFile) return;
    
    const { data, stats } = processData(parsedFile.rows, mappings);
    
    setCleanedData(data);
    // Merge in the addresses consolidated count from the address consolidation step
    setCleaningStats({
      ...stats,
      addressesConsolidated: addressesConsolidatedCount,
    });
    
    // Run validation and duplicate detection
    const rowValidations = validateRows(data);
    const duplicateGroups = detectDuplicates(data);
    setValidations(rowValidations);
    setDuplicates(duplicateGroups);
    
    setStep(5);
    
    toast.success(`Cleaned ${data.length} rows successfully!`);
  }, [parsedFile, mappings, addressesConsolidatedCount]);

  const handleDownload = useCallback(async () => {
    if (cleanedData.length === 0) return;
    
    // Filter out rows that should be skipped (names too long)
    const exportData = cleanedData.filter((_, idx) => !rowsToSkip.has(idx));
    
    if (exportData.length === 0) {
      toast.error('No valid rows to export');
      return;
    }
    
    // Include standard headers + custom fields
    const headers = [...TARGET_HEADERS, ...customFields];
    const blob = exportFormat === 'xlsx' 
      ? await generateExcel(exportData, headers)
      : await generateCSV(exportData, headers);
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = parsedFile?.fileName.replace(/\.[^/.]+$/, '') || 'data';
    a.download = `cleaned_${baseName}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const skippedCount = rowsToSkip.size;
    if (skippedCount > 0) {
      toast.success(`File downloaded! (${skippedCount} rows skipped due to name length)`);
    } else {
      toast.success('File downloaded!');
    }
  }, [cleanedData, parsedFile, exportFormat, customFields, rowsToSkip]);

  const handleReset = useCallback(() => {
    setStep(1);
    setParsedFile(null);
    setCleanedData([]);
    setCleaningStats(null);
    setValidations([]);
    setDuplicates([]);
    setSampleData({});
    setExportFormat('xlsx');
    setDuplicatesResolved(false);
    setTimezonesResolved(false);
    setStatusResolved(false);
    setNameLengthResolved(false);
    setDataIssuesResolved(false);
    setAddressConsolidationResolved(false);
    setBirthdayFormatResolved(false);
    setNameSplitResolved(false);
    setRowsToSkip(new Set());
    clearAddressComponents();
    clearNameSplitColumn();
  }, [clearAddressComponents, clearNameSplitColumn]);

  // Handle name split resolution
  const handleNameSplitResolved = useCallback((
    updatedData: Record<string, any>[],
    originalHeader: string
  ) => {
    // Update parsedFile with new data and headers
    setParsedFile(prev => {
      if (!prev) return prev;
      
      // Add First Name and Last Name to headers if not present
      let newHeaders = [...prev.headers];
      if (!newHeaders.some(h => h.toLowerCase() === 'first name')) {
        newHeaders = ['First Name', ...newHeaders];
      }
      if (!newHeaders.some(h => h.toLowerCase() === 'last name')) {
        const firstNameIdx = newHeaders.findIndex(h => h.toLowerCase() === 'first name');
        newHeaders.splice(firstNameIdx + 1, 0, 'Last Name');
      }
      
      // Remove the original combined name column from headers
      newHeaders = newHeaders.filter(h => h !== originalHeader);
      
      return {
        ...prev,
        rows: updatedData,
        headers: newHeaders,
      };
    });
    
    // Update sample data
    setSampleData(prev => {
      const next = { ...prev };
      delete next[originalHeader];
      next['First Name'] = getSampleValues(updatedData, 'First Name', 3);
      next['Last Name'] = getSampleValues(updatedData, 'Last Name', 3);
      return next;
    });
    
    // Update mappings - remove original column mapping and add First/Last Name mappings
    setMappings(prev => {
      const filtered = prev.filter(m => m.sourceHeader !== originalHeader);
      
      // Add First Name mapping if not present
      const hasFirstName = filtered.some(m => m.sourceHeader === 'First Name');
      const hasLastName = filtered.some(m => m.sourceHeader === 'Last Name');
      
      const newMappings = [...filtered];
      if (!hasFirstName) {
        newMappings.unshift({
          sourceHeader: 'First Name',
          targetHeader: 'First Name' as const,
          confidence: 1,
        });
      }
      if (!hasLastName) {
        const firstNameIdx = newMappings.findIndex(m => m.sourceHeader === 'First Name');
        newMappings.splice(firstNameIdx + 1, 0, {
          sourceHeader: 'Last Name',
          targetHeader: 'Last Name' as const,
          confidence: 1,
        });
      }
      
      return newMappings;
    });
    
    setNameSplitResolved(true);
    clearNameSplitColumn();
    toast.success('Names split into First Name and Last Name columns');
    setStep(3); // Move to address consolidation
  }, [clearNameSplitColumn]);

  // Skip name split
  const handleNameSplitSkipped = useCallback(() => {
    setNameSplitResolved(true);
    clearNameSplitColumn();
    setStep(3); // Move to address consolidation
  }, [clearNameSplitColumn]);

  // Handle birthday format resolution
  const handleBirthdayFormatResolved = useCallback((format: BirthdayFormat) => {
    const reformattedData = reformatBirthdays(cleanedData, format);
    
    // Count how many birthdays were actually reformatted
    let birthdaysChanged = 0;
    cleanedData.forEach((row, idx) => {
      const originalBirthday = row['Birthday'] || '';
      const newBirthday = reformattedData[idx]?.['Birthday'] || '';
      if (originalBirthday && newBirthday && originalBirthday !== newBirthday) {
        birthdaysChanged++;
      }
    });
    
    setCleanedData(reformattedData);
    setBirthdayFormatResolved(true);
    
    // Update stats if birthdays were changed
    if (birthdaysChanged > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        birthdayFormatted: prev.birthdayFormatted + birthdaysChanged,
        totalCellsModified: prev.totalCellsModified + birthdaysChanged
      } : prev);
    }
    
    toast.success(`Birthdays formatted as ${format}`);
  }, [cleanedData, cleaningStats]);

  // Skip birthday format (use default)
  const handleBirthdayFormatSkipped = useCallback(() => {
    setBirthdayFormatResolved(true);
  }, []);

  // Handle duplicate resolution - remove selected duplicates from data
  const handleDuplicatesResolved = useCallback((indicesToRemove: Set<number>) => {
    const filteredData = cleanedData.filter((_, idx) => !indicesToRemove.has(idx));
    setCleanedData(filteredData);
    setDuplicates([]); // Clear duplicates after resolution
    setDuplicatesResolved(true);
    
    // Update stats to reflect removed rows
    if (indicesToRemove.size > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        totalRows: prev.totalRows - indicesToRemove.size
      } : prev);
    }
    
    // Re-run validation on filtered data
    const newValidations = validateRows(filteredData);
    setValidations(newValidations);
    
    toast.success(`Removed ${indicesToRemove.size} duplicate rows`);
  }, [cleanedData, cleaningStats]);

  // Skip duplicate resolution - keep all
  const handleDuplicatesSkipped = useCallback(() => {
    setDuplicatesResolved(true);
  }, []);

  // Handle timezone resolution - apply timezone assignments
  const handleTimezonesResolved = useCallback((timezoneAssignments: Map<number, string>) => {
    const updatedData = cleanedData.map((row, idx) => {
      if (timezoneAssignments.has(idx)) {
        return { ...row, 'Time Zone': timezoneAssignments.get(idx)! };
      }
      return row;
    });
    setCleanedData(updatedData);
    setTimezonesResolved(true);
    
    // Update the cleaning stats to reflect added timezones
    if (timezoneAssignments.size > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        timeZoneValidated: prev.timeZoneValidated + timezoneAssignments.size,
        totalCellsModified: prev.totalCellsModified + timezoneAssignments.size
      } : prev);
    }
    
    // Re-run validation on updated data
    const newValidations = validateRows(updatedData);
    setValidations(newValidations);
    
    if (timezoneAssignments.size > 0) {
      toast.success(`Assigned time zones to ${timezoneAssignments.size} clients`);
    }
  }, [cleanedData, cleaningStats]);

  // Skip timezone resolution
  const handleTimezonesSkipped = useCallback(() => {
    setTimezonesResolved(true);
  }, []);

  // Handle status resolution - apply status assignments
  const handleStatusResolved = useCallback((statusAssignments: Map<number, string>) => {
    const updatedData = cleanedData.map((row, idx) => {
      if (statusAssignments.has(idx)) {
        return { ...row, 'Status': statusAssignments.get(idx)! };
      }
      return row;
    });
    setCleanedData(updatedData);
    setStatusResolved(true);
    
    // Update the cleaning stats to reflect added statuses
    if (statusAssignments.size > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        statusValidated: prev.statusValidated + statusAssignments.size,
        totalCellsModified: prev.totalCellsModified + statusAssignments.size
      } : prev);
    }
    
    // Re-run validation on updated data
    const newValidations = validateRows(updatedData);
    setValidations(newValidations);
    
    if (statusAssignments.size > 0) {
      toast.success(`Assigned status to ${statusAssignments.size} clients`);
    }
  }, [cleanedData, cleaningStats]);

  // Skip status resolution
  const handleStatusSkipped = useCallback(() => {
    setStatusResolved(true);
  }, []);

  // Handle manual data edits from the preview table
  const handleDataChange = useCallback((updatedData: Record<string, string>[]) => {
    setCleanedData(updatedData);
    
    // Re-run validation on updated data
    const newValidations = validateRows(updatedData);
    setValidations(newValidations);
    
    // Re-run duplicate detection
    const newDuplicates = detectDuplicates(updatedData);
    setDuplicates(newDuplicates);
    
    toast.success('Data updated');
  }, []);

  // Toggle skip for rows with name too long
  const handleToggleSkipRow = useCallback((rowIndex: number) => {
    setRowsToSkip(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  }, []);

  // Auto-skip all rows with names too long
  const handleSkipAllLongNames = useCallback(() => {
    setRowsToSkip(new Set(rowsWithNameTooLong));
    setNameLengthResolved(true);
  }, [rowsWithNameTooLong]);

  // Handle name length resolution - apply edits and set skipped rows
  const handleNameLengthResolved = useCallback((
    updates: Map<number, { firstName?: string; lastName?: string }>,
    skippedRows: Set<number>
  ) => {
    // Count how many name fields were actually changed
    let namesChanged = 0;
    
    // Apply the name updates to cleanedData
    const updatedData = cleanedData.map((row, idx) => {
      if (updates.has(idx)) {
        const update = updates.get(idx)!;
        if (update.firstName !== undefined && update.firstName !== row['First Name']) {
          namesChanged++;
        }
        if (update.lastName !== undefined && update.lastName !== row['Last Name']) {
          namesChanged++;
        }
        return {
          ...row,
          'First Name': update.firstName ?? row['First Name'],
          'Last Name': update.lastName ?? row['Last Name']
        };
      }
      return row;
    });
    setCleanedData(updatedData);
    setRowsToSkip(skippedRows);
    setNameLengthResolved(true);
    
    // Update stats to reflect name changes
    if (namesChanged > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        namesToProperCase: prev.namesToProperCase + namesChanged,
        totalCellsModified: prev.totalCellsModified + namesChanged
      } : prev);
    }
    
    // Re-run validation on updated data
    const newValidations = validateRows(updatedData);
    setValidations(newValidations);
    
    const fixedCount = updates.size;
    const skippedCount = skippedRows.size;
    if (fixedCount > 0 || skippedCount > 0) {
      toast.success(`Name issues resolved: ${fixedCount} fixed, ${skippedCount} skipped`);
    }
  }, [cleanedData, cleaningStats]);

  // Handle data issues resolution (phone duplicates, missing emails)
  const handleDataIssuesResolved = useCallback((updates: Map<number, { email?: string; phone?: string }>) => {
    if (updates.size === 0) {
      setDataIssuesResolved(true);
      return;
    }
    
    // Count email and phone changes
    let emailsChanged = 0;
    let phonesChanged = 0;
    
    const updatedData = cleanedData.map((row, idx) => {
      if (updates.has(idx)) {
        const update = updates.get(idx)!;
        if (update.email !== undefined && update.email !== row['Email']) {
          emailsChanged++;
        }
        if (update.phone !== undefined && update.phone !== row['Phone']) {
          phonesChanged++;
        }
        return {
          ...row,
          'Email': update.email ?? row['Email'],
          'Phone': update.phone ?? row['Phone']
        };
      }
      return row;
    });
    setCleanedData(updatedData);
    setDataIssuesResolved(true);
    
    // Update stats to reflect changes
    const totalChanges = emailsChanged + phonesChanged;
    if (totalChanges > 0 && cleaningStats) {
      setCleaningStats(prev => prev ? {
        ...prev,
        emailsCleaned: prev.emailsCleaned + emailsChanged,
        phonesNormalized: prev.phonesNormalized + phonesChanged,
        totalCellsModified: prev.totalCellsModified + totalChanges
      } : prev);
    }
    
    // Re-run validation on updated data
    const newValidations = validateRows(updatedData);
    setValidations(newValidations);
    
    toast.success(`Updated ${updates.size} client${updates.size > 1 ? 's' : ''}`);
  }, [cleanedData, cleaningStats]);

  // Skip data issues resolution
  const handleDataIssuesSkipped = useCallback(() => {
    setDataIssuesResolved(true);
  }, []);

  // Skip address consolidation
  const handleAddressConsolidationSkipped = useCallback(() => {
    setAddressConsolidationResolved(true);
  }, []);

  // Count duplicates (email only now)
  const emailDuplicates = duplicates.filter(d => d.field === 'Email');


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-secondary sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <img 
              src={intandemLogo} 
              alt="inTandem" 
              className="h-10"
            />
            
            {step > 1 && (
              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  onClick={() => setStep(step - 1)}
                  className="gap-1 bg-foreground text-background hover:bg-foreground/90"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="bg-foreground text-background border-foreground hover:bg-foreground/90"
                >
                  Start Over
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logo */}
      <div className="container mx-auto px-6 pt-8 pb-4 flex justify-center">
        <img 
          src={tidyImportLogo} 
          alt="TidyImport" 
          className="h-40"
        />
      </div>

      {/* Progress */}
      <div className="container mx-auto px-6 pb-8">
        <StepIndicator steps={STEPS} currentStep={getDisplayStep(step)} />
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 pb-24">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Upload Your Client List</h2>
              <p className="text-muted-foreground text-lg">
                Drop a CSV or Excel file to start cleaning up your client list for import
              </p>
            </div>
            
            <FileUpload 
              onFileSelect={handleFileSelect} 
              isProcessing={isProcessingFile || isMappingLoading}
            />
            
            {/* Privacy notice */}
            <div className="flex items-center justify-center gap-2 mt-8 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-primary" />
              <span>Your data stays private. Only column headers are sent for AI mapping.</span>
            </div>
          </div>
        )}

        {/* Step 2: Name Splitting (part of Map Headers) */}
        {step === 2 && parsedFile && nameSplitColumn && !nameSplitResolved && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Review Header Mapping</h2>
              <p className="text-muted-foreground text-lg">
                Split combined name fields into separate First Name and Last Name columns.
              </p>
            </div>

            <div className="mb-8">
              <NameSplitterResolver
                sourceHeader={nameSplitColumn}
                data={parsedFile.rows}
                onResolve={handleNameSplitResolved}
                onSkip={handleNameSplitSkipped}
              />
            </div>
          </div>
        )}

        {/* Step 3: Address Consolidation (part of Map Headers) */}
        {step === 3 && parsedFile && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Review Header Mapping</h2>
              <p className="text-muted-foreground text-lg">
                Combine address fields into a single column for inTandem import.
              </p>
            </div>

            {addressComponents.length >= 2 && !addressConsolidationResolved ? (
              <div className="mb-8">
                <AddressConsolidatorResolver
                  addressComponents={addressComponents}
                  data={parsedFile.rows}
                  onResolve={(consolidatedData, componentsToRemove) => {
                    const removeSet = new Set(componentsToRemove.map(h => h.toLowerCase()));
                    
                    setParsedFile(prev => {
                      if (!prev) return prev;
                      const filteredHeaders = prev.headers.filter(h => !removeSet.has(h.toLowerCase()));
                      const hasAddress = filteredHeaders.some(h => h.toLowerCase() === 'address');
                      const headers = hasAddress 
                        ? filteredHeaders.map(h => h.toLowerCase() === 'address' ? 'Address' : h)
                        : [...filteredHeaders, 'Address'];

                      return {
                        ...prev,
                        rows: consolidatedData,
                        headers,
                      };
                    });

                    setSampleData(prev => {
                      const next = { ...prev };
                      componentsToRemove.forEach(h => {
                        Object.keys(next).forEach(k => {
                          if (k.toLowerCase() === h.toLowerCase()) delete next[k];
                        });
                      });
                      next['Address'] = getSampleValues(consolidatedData, 'Address', 3);
                      return next;
                    });

                    setMappings(prev => {
                      const filtered = prev.filter(m => !removeSet.has(m.sourceHeader.toLowerCase()));
                      const hasAddressMapping = filtered.some(m => m.sourceHeader.toLowerCase() === 'address');
                      
                      if (hasAddressMapping) {
                        return filtered.map(m => 
                          m.sourceHeader.toLowerCase() === 'address'
                            ? { ...m, sourceHeader: 'Address', targetHeader: 'Address' as const, confidence: 1 }
                            : m
                        );
                      } else {
                        return [...filtered, {
                          sourceHeader: 'Address',
                          targetHeader: 'Address' as const,
                          confidence: 1,
                        }];
                      }
                    });

                    setAddressConsolidationResolved(true);
                    setAddressesConsolidatedCount(consolidatedData.length);
                    toast.success(`Combined ${componentsToRemove.length} address fields into a single Address column`);
                    setStep(4); // Move to header mapping review
                  }}
                  onSkip={() => {
                    handleAddressConsolidationSkipped();
                    setStep(4); // Move to header mapping review
                  }}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Step 4: Header Mapping Review (part of Map Headers) */}
        {step === 4 && parsedFile && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Review Header Mapping</h2>
              <p className="text-muted-foreground text-lg">
                AI has suggested mappings to inTandem fields. Review and adjust as needed.
              </p>
            </div>

            <MappingTable 
              mappings={mappings} 
              onUpdateMapping={updateMapping}
              onResetMappings={resetToOriginal}
              hasBeenModified={hasBeenModified}
              sampleData={sampleData}
              customFields={customFields}
              onAddCustomField={addCustomField}
              onRenameSourceHeader={handleRenameSourceHeader}
            />

            <div className="flex justify-center gap-4 mt-12">
              <Button size="lg" onClick={handleReset} className="bg-black text-white hover:bg-black/90">
                Start Over
              </Button>
              <Button size="lg" onClick={handleProcess}>
                Process Data
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Preview & Export */}
        {step === 5 && cleaningStats && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Preview Cleaned Data</h2>
              <p className="text-muted-foreground text-lg">
                Review the cleaned data before downloading for inTandem import
              </p>
            </div>

            {/* Show resolvers in order - address consolidation now happens in Step 2 */}
            {emailDuplicates.length > 0 && !duplicatesResolved ? (
              <div className="mb-8">
                <DuplicateResolver
                  duplicates={duplicates}
                  data={cleanedData}
                  onResolve={handleDuplicatesResolved}
                  onSkip={handleDuplicatesSkipped}
                />
              </div>
            ) : rowsWithMissingTimezone.length > 0 && !timezonesResolved ? (
              <div className="mb-8">
                <TimezoneResolver
                  rowsWithMissingTimezone={rowsWithMissingTimezone}
                  data={cleanedData}
                  onResolve={handleTimezonesResolved}
                  onSkip={handleTimezonesSkipped}
                />
              </div>
            ) : rowsWithStatusIssues.length > 0 && !statusResolved ? (
              <div className="mb-8">
                <StatusResolver
                  rowsWithStatusIssues={rowsWithStatusIssues}
                  rowsWithInvalidStatus={new Set(rowsWithInvalidStatus)}
                  data={cleanedData}
                  onResolve={handleStatusResolved}
                  onSkip={handleStatusSkipped}
                />
              </div>
            ) : rowsWithNameTooLong.length > 0 && !nameLengthResolved ? (
              <div className="mb-8">
                <NameLengthResolver
                  rowsWithNameTooLong={rowsWithNameTooLong}
                  data={cleanedData}
                  onResolve={handleNameLengthResolved}
                  onSkipAll={handleSkipAllLongNames}
                />
              </div>
            ) : !birthdayFormatResolved ? (
              <div className="mb-8">
                <BirthdayFormatResolver
                  onResolve={handleBirthdayFormatResolved}
                  onSkip={handleBirthdayFormatSkipped}
                />
              </div>
            ) : !dataIssuesResolved ? (
              <div className="mb-8">
                <DataIssuesResolver
                  data={cleanedData}
                  onResolve={handleDataIssuesResolved}
                  onSkip={handleDataIssuesSkipped}
                />
              </div>
            ) : (
              <>
                <CleaningSummary 
                  stats={cleaningStats} 
                  validations={validations}
                  duplicates={duplicates}
                />

                <DataPreview 
                  data={cleanedData} 
                  maxRows={10}
                  validations={validations}
                  duplicates={duplicates}
                  rowsToSkip={rowsToSkip}
                  onToggleSkipRow={handleToggleSkipRow}
                  onDataChange={handleDataChange}
                  editable={true}
                />

                {/* Export Options */}
                <div className="max-w-xl mx-auto mt-8 p-6 rounded-xl border bg-card">
                  <h4 className="font-medium mb-4">Export Options</h4>
                  
                  <div className="space-y-4">
                    {/* Export Format */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="export-format">File Format</Label>
                      <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="csv">CSV (.csv)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Show skip count if any */}
                    {rowsToSkip.size > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {rowsToSkip.size} row{rowsToSkip.size > 1 ? 's' : ''} will be skipped from export
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-4 mt-12">
                  <Button size="lg" onClick={() => setStep(4)} className="bg-black text-white hover:bg-black/90">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Mapping
                  </Button>
                  <Button size="lg" onClick={handleDownload} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Download className="w-4 h-4 mr-2" />
                    Download {exportFormat.toUpperCase()} ({cleanedData.length - rowsToSkip.size} rows)
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
