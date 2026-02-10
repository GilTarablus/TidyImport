import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { User, ArrowRight, Scissors } from 'lucide-react';
import { splitFullName, type SplitNameResult } from '@/lib/cleaningEngine';

interface NameSplitterResolverProps {
  sourceHeader: string;
  data: Record<string, any>[];
  onResolve: (
    updatedData: Record<string, any>[],
    originalHeader: string
  ) => void;
  onSkip: () => void;
}

export function NameSplitterResolver({
  sourceHeader,
  data,
  onResolve,
  onSkip,
}: NameSplitterResolverProps) {
  // Get sample rows with data in the source column
  const sampleRows = useMemo(() => {
    const samples: { original: string; result: SplitNameResult; rowIndex: number }[] = [];
    
    for (let i = 0; i < data.length && samples.length < 5; i++) {
      const value = data[i]?.[sourceHeader];
      if (value && String(value).trim()) {
        const original = String(value).trim();
        const result = splitFullName(original);
        samples.push({ original, result, rowIndex: i });
      }
    }
    
    return samples;
  }, [data, sourceHeader]);

  // Count how many rows have data to split
  const rowsWithData = useMemo(() => {
    return data.filter(row => {
      const value = row?.[sourceHeader];
      return value && String(value).trim();
    }).length;
  }, [data, sourceHeader]);

  // Count how many have prefixes/suffixes
  const statsInfo = useMemo(() => {
    let withPrefix = 0;
    let withSuffix = 0;
    
    data.forEach(row => {
      const value = row?.[sourceHeader];
      if (value && String(value).trim()) {
        const result = splitFullName(String(value).trim());
        if (result.removedPrefix) withPrefix++;
        if (result.removedSuffix) withSuffix++;
      }
    });
    
    return { withPrefix, withSuffix };
  }, [data, sourceHeader]);

  const handleSplit = () => {
    // Debug: Log the sourceHeader and check if it exists in the data
    console.log('[NameSplit] sourceHeader:', sourceHeader);
    console.log('[NameSplit] First row keys:', Object.keys(data[0] || {}));
    console.log('[NameSplit] sourceHeader exists in first row:', sourceHeader in (data[0] || {}));
    
    // Find a row with actual data in the source column for debugging
    const firstRowWithData = data.find(row => row?.[sourceHeader] && String(row[sourceHeader]).trim());
    console.log('[NameSplit] First row with data in sourceHeader:', firstRowWithData?.[sourceHeader]);
    
    const updatedData = data.map((row, idx) => {
      const value = row?.[sourceHeader];
      const newRow = { ...row };
      
      // Remove the original combined name column from the row
      delete newRow[sourceHeader];
      
      if (value && String(value).trim()) {
        const result = splitFullName(String(value).trim());
        newRow['First Name'] = result.firstName;
        newRow['Last Name'] = result.lastName;
        
        // Debug logging for first few rows with data
        if (idx < 5 && result.firstName) {
          console.log(`[NameSplit] Row ${idx}: "${value}" -> First: "${result.firstName}", Last: "${result.lastName}"`);
        }
      } else {
        newRow['First Name'] = '';
        newRow['Last Name'] = '';
      }
      
      return newRow;
    });
    
    // Count how many rows got populated First Name
    const rowsWithFirstName = updatedData.filter(r => r['First Name'] && r['First Name'].trim()).length;
    console.log('[NameSplit] Rows with populated First Name:', rowsWithFirstName);
    console.log('[NameSplit] Total rows:', updatedData.length);
    
    onResolve(updatedData, sourceHeader);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Scissors className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Split Name Field</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              We detected a combined name column "{sourceHeader}" that needs to be split into First Name and Last Name.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Info badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm">
            <User className="w-3 h-3 mr-1" />
            {rowsWithData} names to process
          </Badge>
          {statsInfo.withPrefix > 0 && (
            <Badge variant="secondary" className="text-sm">
              {statsInfo.withPrefix} with prefixes (will be removed)
            </Badge>
          )}
          {statsInfo.withSuffix > 0 && (
            <Badge variant="secondary" className="text-sm">
              {statsInfo.withSuffix} with suffixes (will be removed)
            </Badge>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">How names will be split:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Prefixes (Dr., Mr., Mrs., etc.) and suffixes (Jr., III, PhD, etc.) will be <strong>removed</strong></li>
            <li><strong>1 word:</strong> Entire name → First Name only</li>
            <li><strong>2 words:</strong> First word → First Name, Second word → Last Name</li>
            <li><strong>3 words:</strong> First word → First Name, Last 2 words → Last Name</li>
            <li><strong>4+ words:</strong> First 2 words → First Name, Remaining words → Last Name</li>
          </ul>
        </div>

        {/* Preview table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Original Name</TableHead>
                <TableHead className="font-semibold text-center w-10"></TableHead>
                <TableHead className="font-semibold">First Name</TableHead>
                <TableHead className="font-semibold">Last Name</TableHead>
                <TableHead className="font-semibold text-right">Removed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((sample, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-sm">
                    {sample.original}
                  </TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {sample.result.firstName || <span className="text-muted-foreground italic">empty</span>}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {sample.result.lastName || <span className="text-muted-foreground italic">empty</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {(sample.result.removedPrefix || sample.result.removedSuffix) ? (
                      <span className="text-xs text-muted-foreground line-through">
                        {[sample.result.removedPrefix, sample.result.removedSuffix].filter(Boolean).join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {sampleRows.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No names found in the "{sourceHeader}" column.
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            This will create "First Name" and "Last Name" columns
          </p>
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onSkip}>
              Skip (keep as is)
            </Button>
            <Button 
              onClick={handleSplit}
              disabled={rowsWithData === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Scissors className="w-4 h-4 mr-2" />
              Split Names
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
