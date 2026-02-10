import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Check, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DuplicateGroup } from '@/lib/cleaningEngine';

interface DuplicateResolverProps {
  duplicates: DuplicateGroup[];
  data: Record<string, string>[];
  onResolve: (indicesToRemove: Set<number>) => void;
  onSkip: () => void;
}

interface DuplicateChoice {
  duplicateIndex: number; // Index in duplicates array
  keepRowIndex: number; // Which row index to keep
}

export function DuplicateResolver({ 
  duplicates, 
  data, 
  onResolve, 
  onSkip 
}: DuplicateResolverProps) {
  // Only show email duplicates
  const emailDuplicates = duplicates.filter(d => d.field === 'Email');
  
  // Track user's choice for each duplicate group
  const [choices, setChoices] = useState<Map<number, number>>(() => {
    // Default: keep first occurrence
    const initial = new Map<number, number>();
    emailDuplicates.forEach((_, idx) => {
      initial.set(idx, emailDuplicates[idx].rowIndices[0]);
    });
    return initial;
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  if (emailDuplicates.length === 0) {
    return null;
  }

  const handleChoice = (duplicateIdx: number, keepRowIndex: number) => {
    setChoices(prev => new Map(prev).set(duplicateIdx, keepRowIndex));
  };

  // Count non-empty cells in a row
  const countCellData = (rowIndex: number) => {
    const row = data[rowIndex];
    return Object.values(row).filter(val => val && val.trim() !== '').length;
  };

  // Get the row with most data in a duplicate group
  const getRowWithMostData = (rowIndices: number[]) => {
    let maxData = -1;
    let bestRow = rowIndices[0];
    rowIndices.forEach(rowIdx => {
      const count = countCellData(rowIdx);
      if (count > maxData) {
        maxData = count;
        bestRow = rowIdx;
      }
    });
    return bestRow;
  };

  // Remove duplicates from ALL groups based on user choices
  const handleRemoveAllSelected = () => {
    const indicesToRemove = new Set<number>();
    
    emailDuplicates.forEach((dup, dupIdx) => {
      const keepIndex = choices.get(dupIdx) ?? dup.rowIndices[0];
      dup.rowIndices.forEach(rowIdx => {
        if (rowIdx !== keepIndex) {
          indicesToRemove.add(rowIdx);
        }
      });
    });
    
    onResolve(indicesToRemove);
  };

  // Remove all duplicates, keeping the row with most cell data
  const handleRemoveAllSmart = () => {
    const indicesToRemove = new Set<number>();
    
    emailDuplicates.forEach((dup) => {
      const keepIndex = getRowWithMostData(dup.rowIndices);
      dup.rowIndices.forEach(rowIdx => {
        if (rowIdx !== keepIndex) {
          indicesToRemove.add(rowIdx);
        }
      });
    });
    
    onResolve(indicesToRemove);
  };

  const currentDuplicate = emailDuplicates[currentIndex];

  // Get display fields for a row
  const getRowDisplay = (rowIndex: number) => {
    const row = data[rowIndex];
    return {
      name: `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() || '(No name)',
      email: row['Email'] || '(No email)',
      phone: row['Phone'] || '(No phone)',
      rowNumber: rowIndex + 1,
    };
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <span>Duplicate Emails Found</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {emailDuplicates.length} duplicate email{emailDuplicates.length > 1 ? 's' : ''} detected. 
                Choose which client to <span className="font-bold">keep</span> for each duplicate.
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Navigation with progress bar */}
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} of {emailDuplicates.length}
              </span>
              <Progress 
                value={((currentIndex + 1) / emailDuplicates.length) * 100} 
                className="h-2 w-32"
              />
            </div>
            
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCurrentIndex(prev => Math.min(emailDuplicates.length - 1, prev + 1))}
              disabled={currentIndex === emailDuplicates.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Current duplicate */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="font-medium">Duplicate Email:</span>
              <code className="px-2 py-0.5 bg-muted rounded text-xs">
                {currentDuplicate.value}
              </code>
            </div>

            <RadioGroup 
              value={String(choices.get(currentIndex) ?? currentDuplicate.rowIndices[0])}
              onValueChange={(val) => handleChoice(currentIndex, parseInt(val))}
              className="space-y-3"
            >
              {currentDuplicate.rowIndices.map((rowIdx) => {
                const display = getRowDisplay(rowIdx);
                const isSelected = (choices.get(currentIndex) ?? currentDuplicate.rowIndices[0]) === rowIdx;
                
                return (
                  <div
                    key={rowIdx}
                    className={cn(
                      "relative flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handleChoice(currentIndex, rowIdx)}
                  >
                    <RadioGroupItem value={String(rowIdx)} id={`row-${rowIdx}`} className="mt-1" />
                    <Label htmlFor={`row-${rowIdx}`} className="flex-1 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{display.name}</p>
                          <p className="text-sm text-muted-foreground">{display.email}</p>
                          <p className="text-sm text-muted-foreground">{display.phone}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Row {display.rowNumber}
                        </span>
                      </div>
                    </Label>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
            
            {/* Context line showing impact */}
            <p className="text-sm text-muted-foreground">
              {currentDuplicate.rowIndices.length - 1} record{currentDuplicate.rowIndices.length - 1 !== 1 ? 's' : ''} will be removed
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" className="hover:bg-foreground hover:text-background" onClick={onSkip}>
              Skip
              <span className="text-xs opacity-70 ml-1">(keep all)</span>
            </Button>
            
            {currentIndex === emailDuplicates.length - 1 && (
              <Button onClick={handleRemoveAllSelected}>
                Keep Selected
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
