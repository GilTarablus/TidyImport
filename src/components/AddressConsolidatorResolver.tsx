import { useState, useMemo, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, GripVertical } from 'lucide-react';

export interface AddressComponent {
  sourceHeader: string;
  role: 'street1' | 'street2' | 'city' | 'state' | 'zip' | 'country' | 'address';
  order: number;
}

interface AddressConsolidatorResolverProps {
  addressComponents: AddressComponent[];
  data: Record<string, string>[];
  onResolve: (consolidatedData: Record<string, string>[], componentsToRemove: string[]) => void;
  onSkip: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  street1: 'Street Address 1',
  address: 'Address',
  street2: 'Street Address 2',
  city: 'City',
  state: 'State/Province',
  zip: 'Zip/Postal Code',
  country: 'Country',
};

const SEPARATOR_OPTIONS = [
  { value: ', ', label: 'Comma (123 Main St, Austin, TX)' },
  { value: ' ', label: 'Space (123 Main St Austin TX)' },
  { value: ' - ', label: 'Dash (123 Main St - Austin - TX)' },
];

export function AddressConsolidatorResolver({
  addressComponents,
  data,
  onResolve,
  onSkip,
}: AddressConsolidatorResolverProps) {
  const [components, setComponents] = useState<(AddressComponent & { included: boolean })[]>(
    addressComponents.map(c => ({ ...c, included: true }))
  );
  const [separator, setSeparator] = useState(', ');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const includedComponents = useMemo(() => {
    return [...components]
      .filter(c => c.included)
      .sort((a, b) => a.order - b.order);
  }, [components]);

  const formatCombinedAddress = (rawParts: Array<unknown>, sep: string) => {
    const parts = rawParts
      .map(v => (v === null || v === undefined ? '' : String(v)).trim())
      .filter(v => v.length > 0);

    if (parts.length === 0) return '';

    // Join first, then normalize (preserve \n when chosen)
    let combined = parts.join(sep);

    // Only apply comma cleanup when using comma-separated format
    if (sep.includes(',')) {
      combined = combined.replace(/,\s*,+/g, ',');
    }

    // Preserve newlines for the multi-line separator option
    if (sep.includes('\n')) {
      return combined
        .split('\n')
        .map(line => line.replace(/[\t ]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
    }

    return combined.replace(/[\t ]+/g, ' ').trim();
  };

  // Find a sample row with data for the *currently included* components
  const sampleRow = useMemo(() => {
    const rows = data || [];
    for (const row of rows) {
      const hasData = includedComponents.some(c => {
        const value = row?.[c.sourceHeader];
        return value !== null && value !== undefined && String(value).trim().length > 0;
      });
      if (hasData) return row;
    }
    return rows[0] || {};
  }, [data, includedComponents]);

  // Generate preview address
  const previewAddress = useMemo(() => {
    const parts = includedComponents.map(c => sampleRow?.[c.sourceHeader]);
    return formatCombinedAddress(parts, separator);
  }, [includedComponents, sampleRow, separator]);

  // Handle drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newComponents = [...components];
    const draggedItem = newComponents[draggedIndex];
    newComponents.splice(draggedIndex, 1);
    newComponents.splice(index, 0, draggedItem);

    // Update order values (avoid mutating objects in-place)
    const reOrdered = newComponents.map((c, i) => ({ ...c, order: i }));

    setComponents(reOrdered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const toggleIncluded = (index: number) => {
    setComponents(prev =>
      prev.map((c, i) => (i === index ? { ...c, included: !c.included } : c))
    );
  };

  const handleCombine = () => {
    // Consolidate addresses in all rows
    const consolidatedData = data.map(row => {
      const parts = includedComponents.map(c => row?.[c.sourceHeader]);
      const combinedAddress = formatCombinedAddress(parts, separator);

      // Create new row with combined address
      const newRow = { ...row, Address: combinedAddress };
      return newRow;
    });

    // Get the source headers to remove from the data
    const componentsToRemove = includedComponents.map(c => c.sourceHeader);

    onResolve(consolidatedData, componentsToRemove);
  };

  const includedCount = components.filter(c => c.included).length;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Combine Address Fields</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              We detected {addressComponents.length} address-related columns that can be combined into a single Address field.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Component list */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Address Components</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Drag to reorder, uncheck to exclude from combined address
          </p>
          
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            {components.map((component, index) => (
              <div
                key={component.sourceHeader}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-all ${
                  draggedIndex === index ? 'opacity-50 border-primary' : 'hover:border-primary/50'
                } ${!component.included ? 'opacity-60' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
                
                <Checkbox
                  checked={component.included}
                  onCheckedChange={() => toggleIncluded(index)}
                  id={`component-${index}`}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{component.sourceHeader}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {ROLE_LABELS[component.role]}
                    </Badge>
                  </div>
                  {sampleRow[component.sourceHeader] && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      e.g., "{sampleRow[component.sourceHeader]}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Separator selection */}
        <div className="space-y-2">
          <Label htmlFor="separator">Select a separator from the dropdown</Label>
          <Select value={separator} onValueChange={setSeparator}>
            <SelectTrigger id="separator" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEPARATOR_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {includedCount} of {components.length} components selected
          </p>
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onSkip}>
              Skip (keep separate)
            </Button>
            <Button 
              onClick={handleCombine}
              disabled={includedCount === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Combine Addresses
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
