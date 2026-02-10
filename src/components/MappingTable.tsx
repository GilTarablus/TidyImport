import { useState, useEffect } from 'react';
import { ArrowRight, Check, AlertCircle, Minus, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TARGET_HEADERS, type HeaderMapping, type TargetHeader } from '@/lib/cleaningEngine';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MappingTableProps {
  mappings: HeaderMapping[];
  onUpdateMapping: (sourceHeader: string, targetHeader: TargetHeader | null, isCustom?: boolean) => void;
  onResetMappings?: () => void;
  hasBeenModified?: boolean;
  sampleData?: Record<string, string[]>;
  customFields: string[];
  onAddCustomField: (fieldName: string) => void;
  onRenameSourceHeader?: (oldHeader: string, newHeader: string) => void;
}

// Field hints for vcita target headers
const FIELD_HINTS: Record<string, string> = {
  "Email": "Client email address",
  "First Name": "REQUIRED - Client's first/given name",
  "Last Name": "Client's surname/family name",
  "Phone": "Formatted as 555-555-5555",
  "Address": "Full address in one field",
  "Birthday": "Date of birth (MM/DD/YYYY)",
  "Time Zone": "e.g., US/Eastern, US/Pacific",
  "Status": "Lead, Customer, or VIP only",
  "Tags": "Pipe-separated (tag1|tag2)",
  "Notes": "Additional client notes",
};

const MANUAL_MAPPING_VALUE = '__manual_mapping__';

export function MappingTable({ 
  mappings, 
  onUpdateMapping, 
  onResetMappings,
  hasBeenModified = false,
  sampleData = {},
  customFields = [],
  onAddCustomField,
  onRenameSourceHeader,
}: MappingTableProps) {
  // Track which source headers are in manual mapping mode
  const [manualMappingInputs, setManualMappingInputs] = useState<Record<string, string>>({});
  const [activeManualMappings, setActiveManualMappings] = useState<Set<string>>(new Set());
  
  // Track which empty headers are being edited
  const [editingEmptyHeaders, setEditingEmptyHeaders] = useState<Record<string, string>>({});

  const handleManualMappingSelect = (sourceHeader: string) => {
    setActiveManualMappings(prev => new Set(prev).add(sourceHeader));
    setManualMappingInputs(prev => ({ ...prev, [sourceHeader]: '' }));
    // Clear the current mapping when entering manual mode
    onUpdateMapping(sourceHeader, null);
  };

  const handleManualMappingConfirm = (sourceHeader: string) => {
    const customFieldName = manualMappingInputs[sourceHeader]?.trim();
    if (customFieldName) {
      // Add as custom field if not already present
      if (!customFields.includes(customFieldName)) {
        onAddCustomField(customFieldName);
      }
      // Apply the mapping
      onUpdateMapping(sourceHeader, customFieldName as TargetHeader, true);
      // Exit manual mapping mode for this row
      setActiveManualMappings(prev => {
        const next = new Set(prev);
        next.delete(sourceHeader);
        return next;
      });
    }
  };

  const handleManualMappingCancel = (sourceHeader: string) => {
    setActiveManualMappings(prev => {
      const next = new Set(prev);
      next.delete(sourceHeader);
      return next;
    });
    setManualMappingInputs(prev => {
      const next = { ...prev };
      delete next[sourceHeader];
      return next;
    });
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-emerald-500';
    if (confidence >= 0.5) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  const getConfidenceBg = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-emerald-500/10 border-emerald-500/30';
    if (confidence >= 0.5) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-muted/50 border-border';
  };

  const getConfidenceIcon = (confidence: number, hasTarget: boolean) => {
    if (!hasTarget) return <Minus className="w-4 h-4" />;
    if (confidence >= 0.8) return <Check className="w-4 h-4" />;
    if (confidence >= 0.5) return <AlertCircle className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  // Get already used target headers
  const usedTargets = mappings
    .filter(m => m.targetHeader)
    .map(m => m.targetHeader);

  // All available targets (standard + custom)
  const allTargets = [...TARGET_HEADERS, ...customFields];

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-4 px-6 py-4 bg-muted/50 border-b font-medium text-sm">
            <div>Source Header</div>
            <div></div>
            <div>inTandem Target Field</div>
            <div className="text-center w-20">Confidence</div>
          </div>

          {/* Mapping rows */}
          <div className="divide-y">
            {mappings.map((mapping, index) => {
              const samples = sampleData[mapping.sourceHeader] || [];
              const isConsolidatedAddressRow =
                mapping.sourceHeader.trim().toLowerCase() === 'address' &&
                mapping.targetHeader === 'Address';
              
              // Generate Excel-style column letter (A, B, C, ... Z, AA, AB, etc.)
              const getColumnLetter = (idx: number): string => {
                let letter = '';
                let n = idx;
                while (n >= 0) {
                  letter = String.fromCharCode((n % 26) + 65) + letter;
                  n = Math.floor(n / 26) - 1;
                }
                return letter;
              };
              const columnLetter = getColumnLetter(index);
              
              return (
                <div
                  key={mapping.sourceHeader || `empty-${index}`}
                  className={cn(
                    "grid grid-cols-[1fr,auto,1fr,auto] gap-4 px-6 py-4 items-center transition-colors",
                    "hover:bg-muted/30"
                  )}
                >
                  {/* Source header with sample data */}
                  {mapping.sourceHeader === '' ? (
                    // Empty header - show editable input with warning
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                          Col {columnLetter}
                        </span>
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <Input
                          value={editingEmptyHeaders[mapping.sourceHeader] ?? ''}
                          onChange={(e) => setEditingEmptyHeaders(prev => ({
                            ...prev,
                            [mapping.sourceHeader]: e.target.value
                          }))}
                          placeholder="Enter column name..."
                          className="font-mono text-sm border-amber-500/50 bg-amber-500/5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newName = editingEmptyHeaders[mapping.sourceHeader]?.trim();
                              if (newName && onRenameSourceHeader) {
                                onRenameSourceHeader(mapping.sourceHeader, newName);
                                setEditingEmptyHeaders(prev => {
                                  const next = { ...prev };
                                  delete next[mapping.sourceHeader];
                                  return next;
                                });
                              }
                            }
                          }}
                          onBlur={() => {
                            const newName = editingEmptyHeaders[mapping.sourceHeader]?.trim();
                            if (newName && onRenameSourceHeader) {
                              onRenameSourceHeader(mapping.sourceHeader, newName);
                              setEditingEmptyHeaders(prev => {
                                const next = { ...prev };
                                delete next[mapping.sourceHeader];
                                return next;
                              });
                            }
                          }}
                        />
                      </div>
                      <p className="text-xs text-amber-600 flex items-center gap-1 ml-12">
                        <AlertCircle className="w-3 h-3" />
                        Missing header - column has data but no name
                      </p>
                      {samples.length > 0 && (
                        <div className="flex gap-1 flex-wrap ml-12">
                          {samples.map((sample, i) => (
                            <span 
                              key={i}
                              className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded truncate max-w-[120px]"
                            >
                              {sample}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                              Col {columnLetter}
                            </span>
                            <div className="font-mono text-sm bg-muted/50 px-3 py-2 rounded-lg truncate flex-1">
                              {mapping.sourceHeader}
                            </div>
                          </div>
                          {samples.length > 0 && (
                            <div className="flex gap-1 flex-wrap ml-12">
                              {samples.map((sample, i) => (
                                <span 
                                  key={i}
                                  className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded truncate max-w-[120px]"
                                >
                                  {sample}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      {samples.length > 0 && (
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="font-medium mb-1">Sample values:</p>
                          <ul className="text-xs space-y-1">
                            {samples.map((sample, i) => (
                              <li key={i} className="text-muted-foreground">{sample}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}

                  {/* Arrow */}
                  <div className="flex items-center justify-center w-10">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Target dropdown or manual input */}
                  {isConsolidatedAddressRow ? (
                    <div className="w-full rounded-md border bg-muted/30 px-3 py-2">
                      <div className="text-sm font-medium">Address</div>
                      <div className="text-xs text-muted-foreground">Consolidated + auto-mapped</div>
                    </div>
                  ) : activeManualMappings.has(mapping.sourceHeader) ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={manualMappingInputs[mapping.sourceHeader] || ''}
                          onChange={(e) => setManualMappingInputs(prev => ({
                            ...prev,
                            [mapping.sourceHeader]: e.target.value
                          }))}
                          placeholder="Enter custom field name..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleManualMappingConfirm(mapping.sourceHeader);
                            if (e.key === 'Escape') handleManualMappingCancel(mapping.sourceHeader);
                          }}
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleManualMappingConfirm(mapping.sourceHeader)}
                          disabled={!manualMappingInputs[mapping.sourceHeader]?.trim()}
                        >
                          Apply
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleManualMappingCancel(mapping.sourceHeader)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Please ensure that you match this field <strong>exactly</strong> to the Custom Field you created in the platform. Capitalization, lowercase, and spacing must match or the import might fail.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Select
                      value={mapping.targetHeader || 'unmapped'}
                      onValueChange={(value) => {
                        if (value === MANUAL_MAPPING_VALUE) {
                          handleManualMappingSelect(mapping.sourceHeader);
                        } else {
                          const isCustom = customFields.includes(value);
                          onUpdateMapping(
                            mapping.sourceHeader, 
                            value === 'unmapped' ? null : value as TargetHeader,
                            isCustom
                          );
                        }
                      }}
                    >
                      <SelectTrigger className={cn(
                        "w-full",
                        mapping.targetHeader && getConfidenceBg(mapping.confidence)
                      )}>
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">
                          <span className="text-muted-foreground">— Skip this column —</span>
                        </SelectItem>
                        {/* Manual Mapping option - at top for visibility */}
                        <SelectItem value={MANUAL_MAPPING_VALUE}>
                          <span className="text-yellow-700 font-medium">+ Manual Mapping</span>
                        </SelectItem>
                        <SelectSeparator />
                        {/* Standard inTandem fields */}
                        {TARGET_HEADERS
                          .filter((header) => {
                            if (header !== 'Address') return true;
                            // Hide Address everywhere once it's already mapped,
                            // except on the row that is actually mapped to Address.
                            if (mapping.targetHeader === 'Address') return true;
                            return !usedTargets.includes('Address');
                          })
                          .map((header) => (
                            <SelectItem 
                              key={header} 
                              value={header}
                              disabled={usedTargets.includes(header) && mapping.targetHeader !== header}
                            >
                              <div className="flex flex-col">
                                <span>
                                  {header}
                                  {header === 'First Name' && <span className="text-red-500 ml-1">*</span>}
                                  {usedTargets.includes(header) && mapping.targetHeader !== header && (
                                    <span className="text-muted-foreground ml-2">(mapped)</span>
                                  )}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        {/* Custom fields section (if any exist) */}
                        {customFields.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                              Custom Fields
                            </div>
                            {customFields.map((field) => (
                              <SelectItem 
                                key={field} 
                                value={field}
                                disabled={usedTargets.includes(field) && mapping.targetHeader !== field}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{field}</span>
                                  {usedTargets.includes(field) && mapping.targetHeader !== field && (
                                    <span className="text-muted-foreground ml-2">(mapped)</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Confidence indicator */}
                  <div className={cn(
                    "flex items-center justify-center gap-1.5 w-20",
                    getConfidenceColor(mapping.targetHeader ? mapping.confidence : 0)
                  )}>
                    {getConfidenceIcon(mapping.confidence, !!mapping.targetHeader)}
                    {mapping.targetHeader && (
                      <span className="text-xs font-medium">
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Field hints */}
        <div className="mt-4 p-4 rounded-lg bg-muted/30 border">
          <p className="text-sm font-medium mb-2">inTandem Field Requirements:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
            {TARGET_HEADERS.map(header => (
              <div key={header}>
                <span className="font-medium text-foreground">{header}</span>
                {header === 'First Name' && <span className="text-red-500">*</span>}
                : {FIELD_HINTS[header]}
              </div>
            ))}
          </div>
          {customFields.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                Custom Fields 
                <span className="text-xs text-muted-foreground font-normal">
                  (Ensure names match exactly)
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {customFields.map(field => (
                  <span key={field} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reset button and Legend */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>High confidence (80%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Medium confidence (50-79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground" />
              <span>Low/No match</span>
            </div>
          </div>
          
          {hasBeenModified && onResetMappings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetMappings}
              className="gap-2"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to AI Suggestions
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
