import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, Check, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VALID_TIME_ZONES } from '@/lib/cleaningEngine';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimezoneResolverProps {
  rowsWithMissingTimezone: number[];
  data: Record<string, string>[];
  onResolve: (timezoneAssignments: Map<number, string>) => void;
  onSkip: () => void;
}

export function TimezoneResolver({ 
  rowsWithMissingTimezone, 
  data, 
  onResolve, 
  onSkip 
}: TimezoneResolverProps) {
  const [assignments, setAssignments] = useState<Map<number, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bulkTimezone, setBulkTimezone] = useState<string>('');

  if (rowsWithMissingTimezone.length === 0) {
    return null;
  }

  const currentRowIndex = rowsWithMissingTimezone[currentIndex];
  const currentRow = data[currentRowIndex];

  const getRowDisplay = (rowIndex: number) => {
    const row = data[rowIndex];
    return {
      name: `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() || '(No name)',
      email: row['Email'] || '(No email)',
      phone: row['Phone'] || '(No phone)',
      rowNumber: rowIndex + 1,
    };
  };

  const handleAssignment = (rowIndex: number, timezone: string) => {
    setAssignments(prev => new Map(prev).set(rowIndex, timezone));
  };

  const handleApplyToAll = () => {
    if (!bulkTimezone) return;
    
    const newAssignments = new Map<number, string>();
    rowsWithMissingTimezone.forEach(rowIndex => {
      newAssignments.set(rowIndex, bulkTimezone);
    });
    setAssignments(newAssignments);
    
    // Auto-advance to next step after applying to all
    onResolve(newAssignments);
  };

  const handleResolve = () => {
    onResolve(assignments);
  };

  const assignedCount = assignments.size;
  const totalCount = rowsWithMissingTimezone.length;
  const currentAssignment = assignments.get(currentRowIndex) || '';

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span>Missing Time Zones</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {totalCount} client{totalCount > 1 ? 's' : ''} {totalCount > 1 ? 'are' : 'is'} missing a time zone. 
                Assign time zones or skip to leave them empty.
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk apply option */}
          <div className="p-4 rounded-lg bg-background/50 border">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">Quick Apply</span>
            </div>
            <div className="flex gap-3">
              <Select value={bulkTimezone} onValueChange={setBulkTimezone}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a time zone..." />
                </SelectTrigger>
                <SelectContent>
                  {VALID_TIME_ZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleApplyToAll} 
                disabled={!bulkTimezone}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Apply to All ({totalCount})
              </Button>
            </div>
          </div>

          {/* Navigation with progress bar */}
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} of {totalCount}
              </span>
              <Progress 
                value={((currentIndex + 1) / totalCount) * 100} 
                className="h-2 w-32"
              />
            </div>
            
            <Button
              size="sm"
              onClick={() => setCurrentIndex(prev => Math.min(totalCount - 1, prev + 1))}
              disabled={currentIndex === totalCount - 1}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {/* Assigned count */}
          <div className="text-sm text-muted-foreground text-center">
            <span className="text-emerald-600 font-medium">{assignedCount}</span> of {totalCount} assigned
          </div>

          {/* Current client */}
          <div className="p-4 rounded-lg border bg-background/50 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium text-lg">{getRowDisplay(currentRowIndex).name}</p>
                <p className="text-sm text-muted-foreground">{getRowDisplay(currentRowIndex).email}</p>
                <p className="text-sm text-muted-foreground">{getRowDisplay(currentRowIndex).phone}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Row {getRowDisplay(currentRowIndex).rowNumber}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Time Zone</label>
              <Select 
                value={currentAssignment} 
                onValueChange={(value) => handleAssignment(currentRowIndex, value)}
              >
                <SelectTrigger className={cn(
                  currentAssignment && "border-emerald-500 bg-emerald-500/5"
                )}>
                  <SelectValue placeholder="Select time zone..." />
                </SelectTrigger>
                <SelectContent>
                  {VALID_TIME_ZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentAssignment && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="w-3 h-3" />
                  Assigned
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={onSkip}>
              Skip
              <span className="text-xs text-muted-foreground ml-1">(leave empty)</span>
            </Button>
            
            <Button onClick={handleResolve}>
              Continue ({assignedCount} assigned)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}