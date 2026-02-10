import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, UserCheck, Check, AlertTriangle } from 'lucide-react';

const PRESET_STATUSES = ['Lead', 'Customer', 'VIP', 'Inactive'];
const MANUAL_ENTRY_KEY = '__manual_entry__';

interface StatusResolverProps {
  rowsWithStatusIssues: number[];
  rowsWithInvalidStatus: Set<number>;
  data: Record<string, string>[];
  onResolve: (statusAssignments: Map<number, string>) => void;
  onSkip: () => void;
}

export function StatusResolver({ 
  rowsWithStatusIssues, 
  rowsWithInvalidStatus,
  data, 
  onResolve, 
  onSkip 
}: StatusResolverProps) {
  const [assignments, setAssignments] = useState<Map<number, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkCustomStatus, setBulkCustomStatus] = useState<string>('');
  const [customStatuses, setCustomStatuses] = useState<Map<number, string>>(new Map());
  const [showBulkCustomInput, setShowBulkCustomInput] = useState(false);
  // Track which invalid statuses user has approved to keep
  const [approvedStatuses, setApprovedStatuses] = useState<Map<number, boolean>>(new Map());

  // Filter out resolved rows (assigned or approved) from the active list
  const unresolvedRows = useMemo(() => {
    return rowsWithStatusIssues.filter(idx => !assignments.has(idx) && !approvedStatuses.has(idx));
  }, [rowsWithStatusIssues, assignments, approvedStatuses]);

  // Adjust currentIndex if it's out of bounds after filtering
  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, unresolvedRows.length - 1));
  const currentRowIndex = unresolvedRows[safeCurrentIndex];
  const currentRow = currentRowIndex !== undefined ? data[currentRowIndex] : null;
  const isCurrentRowInvalid = currentRowIndex !== undefined && rowsWithInvalidStatus.has(currentRowIndex);
  const currentInvalidStatus = isCurrentRowInvalid && currentRow ? currentRow['Status']?.trim() : null;

  const resolvedCount = assignments.size + approvedStatuses.size;
  const totalCount = rowsWithStatusIssues.length;
  const remainingCount = unresolvedRows.length;

  // Count how many are missing vs invalid (only unresolved)
  const missingCount = unresolvedRows.filter(idx => !rowsWithInvalidStatus.has(idx)).length;
  const invalidCount = unresolvedRows.filter(idx => rowsWithInvalidStatus.has(idx)).length;

  // Group invalid statuses by their value for bulk approval
  const invalidStatusGroups = useMemo(() => {
    const groups: Record<string, number[]> = {};
    rowsWithStatusIssues.forEach(idx => {
      if (rowsWithInvalidStatus.has(idx)) {
        const status = data[idx]?.['Status']?.trim();
        if (status) {
          if (!groups[status]) {
            groups[status] = [];
          }
          groups[status].push(idx);
        }
      }
    });
    return groups;
  }, [rowsWithStatusIssues, rowsWithInvalidStatus, data]);

  // Get unique invalid status values that haven't been fully approved yet
  const unapprovedInvalidGroups = useMemo(() => {
    return Object.entries(invalidStatusGroups).filter(([status, indices]) => {
      // Check if any in this group are not yet approved
      return indices.some(idx => !approvedStatuses.has(idx) && !assignments.has(idx));
    });
  }, [invalidStatusGroups, approvedStatuses, assignments]);

  const getRowDisplay = (rowIndex: number) => {
    const row = data[rowIndex];
    const firstName = row['First Name'] || '';
    const lastName = row['Last Name'] || '';
    const email = row['Email'] || '';
    const phone = row['Phone'] || '';
    
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    const contact = email || phone || 'No contact info';
    
    return { name, contact, email, phone, firstName, lastName };
  };

  const handleSelectChange = (rowIndex: number, value: string) => {
    // Clear approval if they're selecting a new status
    setApprovedStatuses(prev => {
      const newMap = new Map(prev);
      newMap.delete(rowIndex);
      return newMap;
    });
    
    if (value === MANUAL_ENTRY_KEY) {
      // Show custom input but don't set assignment yet
      setCustomStatuses(prev => new Map(prev).set(rowIndex, ''));
    } else {
      // Clear custom status if preset selected
      setCustomStatuses(prev => {
        const newMap = new Map(prev);
        newMap.delete(rowIndex);
        return newMap;
      });
      setAssignments(prev => new Map(prev).set(rowIndex, value));
    }
  };

  const handleCustomStatusChange = (rowIndex: number, value: string) => {
    setCustomStatuses(prev => new Map(prev).set(rowIndex, value));
    if (value.trim()) {
      setAssignments(prev => new Map(prev).set(rowIndex, value.trim()));
    }
  };

  const handleApproveCurrentStatus = (rowIndex: number) => {
    // Mark the current invalid status as approved (keep it as-is)
    setApprovedStatuses(prev => new Map(prev).set(rowIndex, true));
    // Remove from assignments if previously assigned something else
    setAssignments(prev => {
      const newMap = new Map(prev);
      newMap.delete(rowIndex);
      return newMap;
    });
  };

  const handleBulkApproveStatus = (statusValue: string) => {
    // Approve all rows with this specific invalid status value
    const indicesToApprove = invalidStatusGroups[statusValue] || [];
    setApprovedStatuses(prev => {
      const newMap = new Map(prev);
      indicesToApprove.forEach(idx => {
        newMap.set(idx, true);
      });
      return newMap;
    });
    // Remove from assignments if any were previously assigned
    setAssignments(prev => {
      const newMap = new Map(prev);
      indicesToApprove.forEach(idx => {
        newMap.delete(idx);
      });
      return newMap;
    });
    // Reset index to 0 to avoid showing empty state briefly
    setCurrentIndex(0);
  };

  const handleBulkSelectChange = (value: string) => {
    setBulkStatus(value);
    if (value === MANUAL_ENTRY_KEY) {
      setShowBulkCustomInput(true);
    } else {
      setShowBulkCustomInput(false);
      setBulkCustomStatus('');
    }
  };

  const handleApplyToAll = () => {
    const statusToApply = bulkStatus === MANUAL_ENTRY_KEY ? bulkCustomStatus.trim() : bulkStatus;
    if (!statusToApply) return;
    
    const newAssignments = new Map(assignments);
    rowsWithStatusIssues.forEach(idx => {
      // Don't override approved statuses
      if (!approvedStatuses.has(idx)) {
        newAssignments.set(idx, statusToApply);
      }
    });
    setAssignments(newAssignments);
    
    // Clear custom statuses when bulk applied
    setCustomStatuses(new Map());
    
    // Auto-advance to next task after applying to all
    onResolve(newAssignments);
  };

  const isApplyToAllDisabled = bulkStatus === MANUAL_ENTRY_KEY 
    ? !bulkCustomStatus.trim() 
    : !bulkStatus;

  const handleResolve = () => {
    // For approved statuses, we don't need to include them in assignments
    // as they're keeping their current value
    onResolve(assignments);
  };

  const { name, contact, email, phone } = useMemo(() => 
    getRowDisplay(currentRowIndex), [currentRowIndex, data]
  );

  // Check if current row has been handled (assigned or approved)
  const isCurrentRowHandled = assignments.has(currentRowIndex) || approvedStatuses.has(currentRowIndex);

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg">Status Issues</CardTitle>
        </div>
        <CardDescription>
          {missingCount > 0 && invalidCount > 0 ? (
            <>
              {missingCount} client{missingCount > 1 ? 's are' : ' is'} missing a Status, and{' '}
              {invalidCount} {invalidCount > 1 ? 'have' : 'has'} a status not in the standard list.
            </>
          ) : missingCount > 0 ? (
            <>
              {missingCount} client{missingCount > 1 ? 's are' : ' is'} missing a Status field.
            </>
          ) : (
            <>
              {invalidCount} client{invalidCount > 1 ? 's have' : ' has'} a status not in the standard list (Lead, Customer, VIP).
              Approve to keep or select a valid status.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bulk Approve - show for invalid statuses */}
        {unapprovedInvalidGroups.length > 0 && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm font-medium mb-2 text-amber-700 dark:text-amber-400">Non-standard statuses found</p>
            <p className="text-xs text-muted-foreground mb-3">These statuses aren't in the standard list. Click to approve and keep them.</p>
            <div className="flex flex-wrap gap-2">
              {unapprovedInvalidGroups.map(([statusValue, indices]) => {
                const unapprovedCount = indices.filter(idx => !approvedStatuses.has(idx) && !assignments.has(idx)).length;
                if (unapprovedCount === 0) return null;
                return (
                  <Badge
                    key={statusValue}
                    variant="outline"
                    className="cursor-pointer py-1.5 px-3 border-amber-500/50 hover:bg-amber-500/20 transition-colors"
                    onClick={() => handleBulkApproveStatus(statusValue)}
                  >
                    <Check className="w-3 h-3 mr-1.5" />
                    {statusValue} <span className="ml-1 text-muted-foreground">({unapprovedCount})</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Bulk Assignment - only show for missing statuses */}
        {missingCount > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-3">Quick Action: Apply to All Missing</p>
            <div className="flex flex-wrap gap-2">
              <Select value={bulkStatus} onValueChange={handleBulkSelectChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_ENTRY_KEY}>Manual Entry</SelectItem>
                  {PRESET_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showBulkCustomInput && (
                <Input
                  placeholder="Enter custom status..."
                  value={bulkCustomStatus}
                  onChange={(e) => setBulkCustomStatus(e.target.value)}
                  className="w-40"
                />
              )}
              <Button 
                onClick={handleApplyToAll} 
                disabled={isApplyToAllDisabled}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Apply to All ({totalCount - approvedStatuses.size})
              </Button>
            </div>
          </div>
        )}

          {/* Navigation with progress bar - only show if there are unresolved items */}
          {remainingCount > 0 && (
            <>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={safeCurrentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm text-muted-foreground">
                    {safeCurrentIndex + 1} of {remainingCount} remaining
                  </span>
                  <Progress 
                    value={((safeCurrentIndex + 1) / remainingCount) * 100} 
                    className="h-2 w-32"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(prev => Math.min(remainingCount - 1, prev + 1))}
                  disabled={safeCurrentIndex >= remainingCount - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              {/* Resolved count */}
              <div className="text-sm text-muted-foreground text-center">
                <span className="text-primary font-medium">{resolvedCount}</span> of {totalCount} resolved
              </div>
            </>
          )}
          
          {/* All resolved message */}
          {remainingCount === 0 && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-primary mb-2">
                <Check className="w-5 h-5" />
                <span className="font-medium">All status issues resolved!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {resolvedCount} of {totalCount} clients have been assigned a status.
              </p>
            </div>
          )}

        {/* Current Client Card - only show if there are unresolved items */}
        {remainingCount > 0 && currentRow && (
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{name}</p>
              <p className="text-sm text-muted-foreground truncate">{contact}</p>
              {email && phone && (
                <p className="text-sm text-muted-foreground truncate">{phone}</p>
              )}
              
              {/* Show invalid status warning */}
              {isCurrentRowInvalid && currentInvalidStatus && !approvedStatuses.has(currentRowIndex) && (
                <div className="mt-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Current status "<strong>{currentInvalidStatus}</strong>" is not in the standard list
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {/* Show approve button for invalid statuses */}
              {isCurrentRowInvalid && currentInvalidStatus && !approvedStatuses.has(currentRowIndex) && !assignments.has(currentRowIndex) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApproveCurrentStatus(currentRowIndex)}
                  className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve "{currentInvalidStatus}"
                </Button>
              )}
              
              <Select 
                value={
                  customStatuses.has(currentRowIndex) 
                    ? MANUAL_ENTRY_KEY 
                    : PRESET_STATUSES.includes(assignments.get(currentRowIndex) || '')
                      ? assignments.get(currentRowIndex)
                      : assignments.has(currentRowIndex) 
                        ? MANUAL_ENTRY_KEY 
                        : ''
                } 
                onValueChange={(value) => handleSelectChange(currentRowIndex, value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_ENTRY_KEY}>Manual Entry</SelectItem>
                  {PRESET_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {customStatuses.has(currentRowIndex) && (
                <Input
                  placeholder="Enter custom status..."
                  value={customStatuses.get(currentRowIndex) || ''}
                  onChange={(e) => handleCustomStatusChange(currentRowIndex, e.target.value)}
                  className="w-40"
                />
              )}
            </div>
          </div>
          
          {approvedStatuses.has(currentRowIndex) && currentInvalidStatus && (
            <div className="mt-3 flex items-center gap-1 text-sm text-green-600">
              <Check className="w-4 h-4" />
              <span>Approved: keeping "{currentInvalidStatus}"</span>
            </div>
          )}
          
          {assignments.has(currentRowIndex) && (
            <div className="mt-3 flex items-center gap-1 text-sm text-green-600">
              <Check className="w-4 h-4" />
              <span>Assigned: {assignments.get(currentRowIndex)}</span>
            </div>
          )}
        </div>
        )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={onSkip}>
              Skip
              <span className="text-xs text-muted-foreground ml-1">(leave as-is)</span>
            </Button>
            
            <Button onClick={handleResolve}>
              Continue ({resolvedCount} resolved)
            </Button>
          </div>

      </CardContent>
    </Card>
  );
}
