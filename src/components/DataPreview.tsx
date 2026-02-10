import { useState, useEffect, useMemo } from 'react';
import { TARGET_HEADERS, MAX_NAME_LENGTH, type RowValidation, type DuplicateGroup } from '@/lib/cleaningEngine';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertTriangle, Copy, Filter, XCircle, ChevronDown, ChevronUp, Ban, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DataPreviewProps {
  data: Record<string, string>[];
  maxRows?: number;
  validations?: RowValidation[];
  duplicates?: DuplicateGroup[];
  rowsToSkip?: Set<number>;
  onToggleSkipRow?: (rowIndex: number) => void;
  onDataChange?: (updatedData: Record<string, string>[]) => void;
  editable?: boolean;
}

export function DataPreview({ 
  data, 
  maxRows = 5, 
  validations = [], 
  duplicates = [],
  rowsToSkip = new Set(),
  onToggleSkipRow,
  onDataChange,
  editable = true
}: DataPreviewProps) {
  // Create a set of row indices with issues for quick lookup
  const rowsWithValidationIssues = new Set(validations.map(v => v.rowIndex));
  const duplicateRowIndices = new Set(duplicates.flatMap(d => d.rowIndices));
  
  // Check if row has any issue - defined early for use in issueCount
  const rowHasIssue = (rowIndex: number): boolean => {
    return rowsWithValidationIssues.has(rowIndex) || duplicateRowIndices.has(rowIndex);
  };
  
  const issueCount = data.filter((_, i) => rowHasIssue(i)).length;
  
  // Default to showing only issues if there are any
  const [showOnlyIssues, setShowOnlyIssues] = useState(issueCount > 0);
  const [showAllRows, setShowAllRows] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; header: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const ROWS_PER_PAGE = 50;

  // Get validation details for a specific row
  const getRowValidation = (rowIndex: number): RowValidation | undefined => {
    return validations.find(v => v.rowIndex === rowIndex);
  };

  // Check if row is a duplicate
  const isRowDuplicate = (rowIndex: number): boolean => {
    return duplicateRowIndices.has(rowIndex);
  };

  // Check if row has name too long
  const rowHasNameTooLong = (rowIndex: number): boolean => {
    const validation = getRowValidation(rowIndex);
    return !!(validation?.firstNameTooLong || validation?.lastNameTooLong);
  };

  // Filter data based on toggle
  const filteredData = showOnlyIssues 
    ? data.filter((_, index) => rowHasIssue(index))
    : data;
  
  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  
  // Calculate which rows to show based on mode
  const previewData = useMemo(() => {
    if (!showAllRows) {
      // Show initial preview (maxRows)
      return filteredData.slice(0, maxRows);
    }
    // Paginated view
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, showAllRows, currentPage, maxRows]);
  
  const hasMoreRows = filteredData.length > maxRows;
  
  // Map filtered/paginated indices back to original indices
  const getOriginalIndex = (displayIndex: number): number => {
    // Calculate the actual index in filteredData
    const baseIndex = showAllRows ? (currentPage - 1) * ROWS_PER_PAGE + displayIndex : displayIndex;
    
    if (!showOnlyIssues) return baseIndex;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (rowHasIssue(i)) {
        if (count === baseIndex) return i;
        count++;
      }
    }
    return baseIndex;
  };

  // Reset page when filter changes
  const handleFilterChange = () => {
    setShowOnlyIssues(!showOnlyIssues);
    setShowAllRows(false);
    setCurrentPage(1);
  };

  // Start editing a cell
  const startEditing = (rowIndex: number, header: string, currentValue: string) => {
    if (!editable) return;
    setEditingCell({ rowIndex, header });
    setEditValue(currentValue || '');
  };

  // Save the edited value
  const saveEdit = () => {
    if (!editingCell || !onDataChange) return;
    
    const updatedData = [...data];
    updatedData[editingCell.rowIndex] = {
      ...updatedData[editingCell.rowIndex],
      [editingCell.header]: editValue
    };
    
    onDataChange(updatedData);
    setEditingCell(null);
    setEditValue('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in edit input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No data to preview
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with filter toggle and edit mode indicator */}
      <div className="flex justify-between items-center mb-4">
        {editable && onDataChange && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Click any cell to edit
          </p>
        )}
        {issueCount > 0 && (
          <div className={cn(!editable && "ml-auto")}>
            <Button
              variant={showOnlyIssues ? "default" : "outline"}
              size="sm"
              onClick={handleFilterChange}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              {showOnlyIssues ? 'Show All Rows' : `Show Corrections Only (${issueCount})`}
            </Button>
          </div>
        )}
      </div>
      
      <ScrollArea className="w-full h-[400px] rounded-xl border bg-card">
        <div className="min-w-max">
          {/* Header row */}
          <table className="border-collapse">
            <thead className="bg-card sticky top-0 z-10">
              <tr className="border-b">
                <th className="px-2 py-3 border-r w-12"></th>
                {TARGET_HEADERS.map((header) => (
                  <th
                    key={header}
                    className={cn(
                      "px-4 py-3 font-medium text-sm border-r last:border-r-0 text-left whitespace-nowrap",
                      header === 'First Name' && "bg-primary/5"
                    )}
                  >
                    {header}
                    {header === 'First Name' && <span className="text-destructive ml-1">*</span>}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Data rows */}
            <tbody className="divide-y">
              {previewData.map((row, filteredIndex) => {
                const originalIndex = getOriginalIndex(filteredIndex);
                const validation = getRowValidation(originalIndex);
                const isDuplicate = isRowDuplicate(originalIndex);
                const hasIssue = !!validation || isDuplicate;
                const isCriticalError = validation?.firstNameRequired;
                const hasNameTooLong = validation?.firstNameTooLong || validation?.lastNameTooLong;
                const isSkipped = rowsToSkip.has(originalIndex);

                return (
                  <tr 
                    key={originalIndex} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      hasNameTooLong && "bg-destructive/15 border-l-4 border-l-destructive",
                      isSkipped && "opacity-50",
                      isCriticalError && !hasNameTooLong && "bg-destructive/10",
                      hasIssue && !isCriticalError && !hasNameTooLong && "bg-warning/5"
                    )}
                  >
                    {/* Row indicator */}
                    <td className="px-2 py-3 border-r text-center w-12">
                      {hasNameTooLong ? (
                        <div title={`Name exceeds ${MAX_NAME_LENGTH} characters - will be skipped`}>
                          <Ban className="w-4 h-4 text-destructive mx-auto" />
                        </div>
                      ) : hasIssue ? (
                        <div className="flex gap-1 justify-center" title={
                          isCriticalError
                            ? 'Missing required First Name'
                            : validation?.invalidEmail 
                              ? 'Invalid email format' 
                              : validation?.invalidStatus
                                ? 'Invalid Status (must be Lead, Customer, or VIP)'
                                : validation?.invalidTimeZone
                                  ? 'Invalid Time Zone'
                                  : validation 
                                    ? `Missing: ${validation.missingFields.join(', ')}` 
                                    : 'Potential duplicate'
                        }>
                          {isCriticalError ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : validation ? (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          ) : null}
                          {isDuplicate && (
                            <Copy className="w-4 h-4 text-warning" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{originalIndex + 1}</span>
                      )}
                    </td>
                    
                    {TARGET_HEADERS.map((header) => {
                      const isMissingField = validation?.missingFields.includes(header);
                      const isInvalidEmail = header === 'Email' && validation?.invalidEmail;
                      const isInvalidStatus = header === 'Status' && validation?.invalidStatus;
                      const isInvalidTimeZone = header === 'Time Zone' && validation?.invalidTimeZone;
                      const isMissingRequired = header === 'First Name' && validation?.firstNameRequired;
                      const isEditing = editingCell?.rowIndex === originalIndex && editingCell?.header === header;
                      
                      const hasCellIssue = isMissingRequired || isMissingField || isInvalidEmail || isInvalidStatus || isInvalidTimeZone;
                      const isFirstNameTooLong = header === 'First Name' && validation?.firstNameTooLong;
                      const isLastNameTooLong = header === 'Last Name' && validation?.lastNameTooLong;
                      const isNameTooLong = isFirstNameTooLong || isLastNameTooLong;
                        
                      return (
                        <td
                          key={header}
                          className={cn(
                            "px-4 py-3 text-sm border-r last:border-r-0 relative group whitespace-nowrap",
                            isNameTooLong && "bg-destructive/30 ring-2 ring-inset ring-destructive",
                            isMissingRequired && !isNameTooLong && "bg-destructive/25 ring-2 ring-inset ring-destructive/60",
                            (isMissingField || isInvalidEmail || isInvalidStatus || isInvalidTimeZone) && !isMissingRequired && !isNameTooLong && "bg-warning/20 ring-2 ring-inset ring-warning/60",
                            editable && onDataChange && !isEditing && "cursor-pointer hover:bg-muted/50"
                          )}
                          title={
                            isMissingRequired ? 'Required field missing - click to edit' :
                            isInvalidEmail ? 'Invalid email format - click to edit' : 
                            isInvalidStatus ? 'Must be Lead, Customer, or VIP - click to edit' :
                            isInvalidTimeZone ? 'Invalid time zone - click to edit' :
                            editable && onDataChange ? 'Click to edit' :
                            (row[header] || '(empty)')
                          }
                          onClick={() => !isEditing && editable && onDataChange && startEditing(originalIndex, header, row[header])}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1 -mx-2">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-7 text-sm px-2"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                              >
                                <Check className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="truncate max-w-xs">
                              {row[header] || (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                              {editable && onDataChange && (
                                <Pencil className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50" />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
        <ScrollBar orientation="vertical" />
      </ScrollArea>

      {/* Row count, View All button, and Pagination */}
      <div className="flex flex-col items-center gap-3 mt-4">
        <p className="text-sm text-muted-foreground">
          {showAllRows 
            ? `Page ${currentPage} of ${totalPages} (${filteredData.length} total rows)`
            : showOnlyIssues 
              ? `Showing ${previewData.length} of ${filteredData.length} rows with corrections`
              : `Showing ${previewData.length} of ${data.length} rows`
          }
        </p>
        
        {/* Pagination controls - only show when viewing all rows */}
        {showAllRows && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        )}
        
        {hasMoreRows && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAllRows(!showAllRows);
              setCurrentPage(1);
            }}
            className="gap-2"
          >
            {showAllRows ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                View All {filteredData.length} Rows
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
