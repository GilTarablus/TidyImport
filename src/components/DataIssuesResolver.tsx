import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Phone, Mail, AlertTriangle, Check, ChevronLeft, ChevronRight, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataIssue {
  rowIndex: number;
  type: 'phone_duplicate' | 'missing_email';
  value?: string; // The duplicate phone number or empty for missing email
  duplicateIndices?: number[]; // Other rows with same phone
}

interface DataIssuesResolverProps {
  data: Record<string, string>[];
  onResolve: (updates: Map<number, { email?: string; phone?: string }>) => void;
  onSkip: () => void;
}

// Detect phone duplicates
function detectPhoneDuplicates(data: Record<string, string>[]): Map<string, number[]> {
  const phoneMap = new Map<string, number[]>();
  
  data.forEach((row, index) => {
    const phone = row['Phone']?.trim();
    if (phone && phone.length > 0) {
      const normalized = phone.replace(/\D/g, '');
      if (normalized.length > 0) {
        if (!phoneMap.has(normalized)) {
          phoneMap.set(normalized, []);
        }
        phoneMap.get(normalized)!.push(index);
      }
    }
  });
  
  // Only return duplicates (more than one occurrence)
  const duplicates = new Map<string, number[]>();
  phoneMap.forEach((indices, phone) => {
    if (indices.length > 1) {
      duplicates.set(phone, indices);
    }
  });
  
  return duplicates;
}

// Find rows with missing email
function findMissingEmails(data: Record<string, string>[]): number[] {
  return data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row['Email'] || row['Email'].trim() === '')
    .map(({ index }) => index);
}

export function DataIssuesResolver({
  data,
  onResolve,
  onSkip
}: DataIssuesResolverProps) {
  // Collect all issues
  const issues = useMemo(() => {
    const allIssues: DataIssue[] = [];
    
    // Phone duplicates
    const phoneDuplicates = detectPhoneDuplicates(data);
    const processedPhoneRows = new Set<number>();
    
    phoneDuplicates.forEach((indices, phone) => {
      // Only add the first occurrence as the "primary" issue
      indices.forEach((rowIndex) => {
        if (!processedPhoneRows.has(rowIndex)) {
          allIssues.push({
            rowIndex,
            type: 'phone_duplicate',
            value: phone,
            duplicateIndices: indices.filter(i => i !== rowIndex)
          });
          processedPhoneRows.add(rowIndex);
        }
      });
    });
    
    // Missing emails
    const missingEmailRows = findMissingEmails(data);
    missingEmailRows.forEach(rowIndex => {
      allIssues.push({
        rowIndex,
        type: 'missing_email'
      });
    });
    
    // Sort by row index
    return allIssues.sort((a, b) => a.rowIndex - b.rowIndex);
  }, [data]);

  // Track edits
  const [edits, setEdits] = useState<Map<number, { email?: string; phone?: string }>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingField, setEditingField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Auto-skip if no issues
  useEffect(() => {
    if (issues.length === 0) {
      onSkip();
    }
  }, [issues.length, onSkip]);

  if (issues.length === 0) {
    return null;
  }

  const currentIssue = issues[currentIndex];
  const currentRow = data[currentIssue.rowIndex];
  const currentEdits = edits.get(currentIssue.rowIndex) || {};

  // Get display values (edited or original)
  const getDisplayValue = (rowIndex: number, field: 'Email' | 'Phone') => {
    const rowEdits = edits.get(rowIndex);
    if (rowEdits) {
      if (field === 'Email' && rowEdits.email !== undefined) return rowEdits.email;
      if (field === 'Phone' && rowEdits.phone !== undefined) return rowEdits.phone;
    }
    return data[rowIndex][field] || '';
  };

  const startEditing = (field: 'email' | 'phone') => {
    setEditingField(field);
    setEditValue(getDisplayValue(currentIssue.rowIndex, field === 'email' ? 'Email' : 'Phone'));
  };

  const saveEdit = () => {
    if (!editingField) return;
    
    const currentRowEdits = edits.get(currentIssue.rowIndex) || {};
    const newEdits = new Map(edits);
    newEdits.set(currentIssue.rowIndex, {
      ...currentRowEdits,
      [editingField]: editValue
    });
    setEdits(newEdits);
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleResolve = () => {
    onResolve(edits);
  };

  // Count issues by type
  const phoneDuplicateCount = issues.filter(i => i.type === 'phone_duplicate').length;
  const missingEmailCount = issues.filter(i => i.type === 'missing_email').length;

  // Check if current issue is "resolved" via edit
  const isCurrentIssueResolved = () => {
    if (currentIssue.type === 'missing_email') {
      const email = getDisplayValue(currentIssue.rowIndex, 'Email');
      return email.trim().length > 0;
    }
    if (currentIssue.type === 'phone_duplicate') {
      // Phone is resolved if it's been edited to something different
      const editedPhone = edits.get(currentIssue.rowIndex)?.phone;
      return editedPhone !== undefined && editedPhone !== currentRow['Phone'];
    }
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span>Data Issues Found</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {phoneDuplicateCount > 0 && (
                  <span className="inline-flex items-center gap-1 mr-3">
                    <Phone className="w-3 h-3" />
                    {phoneDuplicateCount} duplicate phone{phoneDuplicateCount > 1 ? 's' : ''}
                  </span>
                )}
                {missingEmailCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {missingEmailCount} missing email{missingEmailCount > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Navigation with progress bar */}
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {issues.length}
              </span>
            </div>
            
            <Button
              size="sm"
              onClick={() => setCurrentIndex(prev => Math.min(issues.length - 1, prev + 1))}
              disabled={currentIndex === issues.length - 1}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Current issue display */}
          <div className="space-y-4">
            {/* Issue type badge */}
            <div className="flex items-center gap-2">
              {currentIssue.type === 'phone_duplicate' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-700 text-sm">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Duplicate Phone Number</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-700 text-sm">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">Missing Email</span>
                </div>
              )}
              {isCurrentIssueResolved() && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-700 text-xs">
                  <Check className="w-3 h-3" />
                  <span>Fixed</span>
                </div>
              )}
            </div>

            {/* Client details */}
            <div className="p-4 rounded-lg border bg-card space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-lg font-medium">
                    {currentRow['First Name'] || ''} {currentRow['Last Name'] || ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Row {currentIssue.rowIndex + 1}</p>
                </div>
              </div>

              {/* Email field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                  {currentIssue.type === 'missing_email' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-700">Missing</span>
                  )}
                </Label>
                {editingField === 'email' ? (
                  <div className="flex gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={saveEdit}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex-1 px-3 py-2 rounded border bg-muted/50",
                      !getDisplayValue(currentIssue.rowIndex, 'Email') && "text-muted-foreground italic"
                    )}>
                      {getDisplayValue(currentIssue.rowIndex, 'Email') || '(empty)'}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => startEditing('email')}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Phone field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                  {currentIssue.type === 'phone_duplicate' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-700">Duplicate</span>
                  )}
                </Label>
                {editingField === 'phone' ? (
                  <div className="flex gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter phone number"
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={saveEdit}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex-1 px-3 py-2 rounded border bg-muted/50",
                      !getDisplayValue(currentIssue.rowIndex, 'Phone') && "text-muted-foreground italic"
                    )}>
                      {getDisplayValue(currentIssue.rowIndex, 'Phone') || '(empty)'}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => startEditing('phone')}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Show other duplicates if phone duplicate */}
              {currentIssue.type === 'phone_duplicate' && currentIssue.duplicateIndices && currentIssue.duplicateIndices.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Other clients with this phone number:
                  </p>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-2">
                      {currentIssue.duplicateIndices.map(idx => {
                        const row = data[idx];
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                            <span>
                              {row['First Name'] || ''} {row['Last Name'] || ''} 
                              {row['Email'] && <span className="text-muted-foreground ml-2">({row['Email']})</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">Row {idx + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" className="hover:bg-foreground hover:text-background" onClick={onSkip}>
              Skip
              <span className="text-xs opacity-70 ml-1">(keep all)</span>
            </Button>

            {currentIndex === issues.length - 1 && (
              <Button 
                onClick={handleResolve}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {edits.size > 0 ? 'Continue to next section' : 'Finished'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
