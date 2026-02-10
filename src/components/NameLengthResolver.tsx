import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Pencil, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_NAME_LENGTH } from '@/lib/cleaningEngine';

interface NameLengthResolverProps {
  rowsWithNameTooLong: number[];
  data: Record<string, string>[];
  onResolve: (updates: Map<number, { firstName?: string; lastName?: string }>, skippedRows: Set<number>) => void;
  onSkipAll: () => void;
}

export function NameLengthResolver({ 
  rowsWithNameTooLong, 
  data, 
  onResolve, 
  onSkipAll 
}: NameLengthResolverProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [updates, setUpdates] = useState<Map<number, { firstName?: string; lastName?: string }>>(new Map());
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());
  
  // Local edit state for current row
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  if (rowsWithNameTooLong.length === 0) {
    return null;
  }

  const currentRowIndex = rowsWithNameTooLong[currentIndex];
  const currentRow = data[currentRowIndex];
  
  // Get current values (either from updates or original data)
  const getCurrentFirstName = () => {
    return updates.get(currentRowIndex)?.firstName ?? currentRow['First Name'] ?? '';
  };
  
  const getCurrentLastName = () => {
    return updates.get(currentRowIndex)?.lastName ?? currentRow['Last Name'] ?? '';
  };

  const firstNameTooLong = getCurrentFirstName().length > MAX_NAME_LENGTH;
  const lastNameTooLong = getCurrentLastName().length > MAX_NAME_LENGTH;
  const isCurrentRowFixed = !firstNameTooLong && !lastNameTooLong;
  const isCurrentRowSkipped = skippedRows.has(currentRowIndex);

  const handleStartEdit = () => {
    setEditFirstName(getCurrentFirstName());
    setEditLastName(getCurrentLastName());
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const newUpdates = new Map(updates);
    newUpdates.set(currentRowIndex, {
      firstName: editFirstName,
      lastName: editLastName
    });
    setUpdates(newUpdates);
    
    // Remove from skipped if it was skipped
    if (skippedRows.has(currentRowIndex)) {
      const newSkipped = new Set(skippedRows);
      newSkipped.delete(currentRowIndex);
      setSkippedRows(newSkipped);
    }
    
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSkipRow = () => {
    const newSkipped = new Set(skippedRows);
    newSkipped.add(currentRowIndex);
    setSkippedRows(newSkipped);
    
    // Move to next if available
    if (currentIndex < rowsWithNameTooLong.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleResolveAll = () => {
    onResolve(updates, skippedRows);
  };

  const getRowDisplay = (rowIndex: number) => {
    const row = data[rowIndex];
    const updated = updates.get(rowIndex);
    return {
      firstName: updated?.firstName ?? row['First Name'] ?? '',
      lastName: updated?.lastName ?? row['Last Name'] ?? '',
      email: row['Email'] || '(No email)',
      rowNumber: rowIndex + 1,
    };
  };

  const totalCount = rowsWithNameTooLong.length;
  const fixedCount = rowsWithNameTooLong.filter(idx => {
    const updated = updates.get(idx);
    const firstName = updated?.firstName ?? data[idx]['First Name'] ?? '';
    const lastName = updated?.lastName ?? data[idx]['Last Name'] ?? '';
    return firstName.length <= MAX_NAME_LENGTH && lastName.length <= MAX_NAME_LENGTH;
  }).length;
  const skippedCount = skippedRows.size;

  const display = getRowDisplay(currentRowIndex);

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <span>Names Exceed {MAX_NAME_LENGTH} Characters</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {totalCount} client{totalCount > 1 ? 's have' : ' has'} names that are too long. 
                Edit to shorten or skip to exclude from export.
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
                {currentIndex + 1} of {totalCount}
              </span>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600">{fixedCount} fixed</span>
                <span className="text-amber-600">{skippedCount} skipped</span>
              </div>
            </div>
            
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCurrentIndex(prev => Math.min(totalCount - 1, prev + 1))}
              disabled={currentIndex === totalCount - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Current client */}
          <div className={cn(
            "p-4 rounded-lg border bg-background/50 space-y-4",
            isCurrentRowSkipped && "opacity-50",
            isCurrentRowFixed && !isCurrentRowSkipped && "border-emerald-500/50"
          )}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{display.email}</p>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Row {display.rowNumber}
                </span>
              </div>
              {isCurrentRowFixed && !isCurrentRowSkipped && (
                <div className="flex items-center gap-1 text-emerald-600 text-sm">
                  <Check className="w-4 h-4" />
                  Fixed
                </div>
              )}
              {isCurrentRowSkipped && (
                <div className="flex items-center gap-1 text-amber-600 text-sm">
                  <SkipForward className="w-4 h-4" />
                  Skipped
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center justify-between">
                    <span>First Name</span>
                    <span className={cn(
                      "text-xs",
                      editFirstName.length > MAX_NAME_LENGTH ? "text-red-500 font-medium" : "text-muted-foreground"
                    )}>
                      {editFirstName.length}/{MAX_NAME_LENGTH}
                    </span>
                  </Label>
                  <Input
                    id="firstName"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className={cn(
                      editFirstName.length > MAX_NAME_LENGTH && "border-red-500 focus-visible:ring-red-500"
                    )}
                    maxLength={50}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center justify-between">
                    <span>Last Name</span>
                    <span className={cn(
                      "text-xs",
                      editLastName.length > MAX_NAME_LENGTH ? "text-red-500 font-medium" : "text-muted-foreground"
                    )}>
                      {editLastName.length}/{MAX_NAME_LENGTH}
                    </span>
                  </Label>
                  <Input
                    id="lastName"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className={cn(
                      editLastName.length > MAX_NAME_LENGTH && "border-red-500 focus-visible:ring-red-500"
                    )}
                    maxLength={50}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveEdit}
                    disabled={editFirstName.length > MAX_NAME_LENGTH || editLastName.length > MAX_NAME_LENGTH}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">First Name</p>
                    <p className={cn(
                      "font-medium",
                      display.firstName.length > MAX_NAME_LENGTH && "text-red-600"
                    )}>
                      {display.firstName || '(empty)'}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5",
                      display.firstName.length > MAX_NAME_LENGTH ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {display.firstName.length} characters
                      {display.firstName.length > MAX_NAME_LENGTH && ` (${display.firstName.length - MAX_NAME_LENGTH} over limit)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Name</p>
                    <p className={cn(
                      "font-medium",
                      display.lastName.length > MAX_NAME_LENGTH && "text-red-600"
                    )}>
                      {display.lastName || '(empty)'}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5",
                      display.lastName.length > MAX_NAME_LENGTH ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {display.lastName.length} characters
                      {display.lastName.length > MAX_NAME_LENGTH && ` (${display.lastName.length - MAX_NAME_LENGTH} over limit)`}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-2">
                    <Pencil className="w-3 h-3" />
                    Edit Names
                  </Button>
                  {!isCurrentRowSkipped && (
                    <Button variant="ghost" size="sm" onClick={handleSkipRow} className="gap-2 text-amber-600 hover:text-amber-700">
                      <SkipForward className="w-3 h-3" />
                      Skip This Client
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" className="hover:bg-foreground hover:text-background" onClick={onSkipAll}>
              Skip All
              <span className="text-xs opacity-70 ml-1">({totalCount})</span>
            </Button>
            
            {currentIndex === totalCount - 1 && (
              <Button onClick={handleResolveAll}>
                Continue ({fixedCount} fixed, {skippedCount} skipped)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}