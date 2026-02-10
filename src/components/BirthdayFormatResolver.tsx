import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar, ArrowRight } from 'lucide-react';

export type BirthdayFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY/MM/DD';

interface BirthdayFormatResolverProps {
  onResolve: (format: BirthdayFormat) => void;
  onSkip: () => void;
}

export function BirthdayFormatResolver({ onResolve, onSkip }: BirthdayFormatResolverProps) {
  const [selectedFormat, setSelectedFormat] = useState<BirthdayFormat>('MM/DD/YYYY');

  const formatExamples: Record<BirthdayFormat, string> = {
    'MM/DD/YYYY': '03/15/1990',
    'DD/MM/YYYY': '15/03/1990',
    'YYYY/MM/DD': '1990/03/15',
  };

  const handleApply = () => {
    onResolve(selectedFormat);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-pink-500" />
          </div>
          <div>
            <CardTitle className="text-xl">Birthday Format</CardTitle>
            <CardDescription>
              Select how you want birthday dates to be formatted in the export
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-medium">Choose your preferred date format:</Label>
          
          <RadioGroup
            value={selectedFormat}
            onValueChange={(value) => setSelectedFormat(value as BirthdayFormat)}
            className="space-y-3"
          >
            {(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD'] as BirthdayFormat[]).map((format) => (
              <div key={format} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors max-w-md">
                <RadioGroupItem value={format} id={format} />
                <Label htmlFor={format} className="cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{format}</span>
                    <span className="text-muted-foreground text-sm">
                      Example: {formatExamples[format]}
                    </span>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={onSkip}
          >
            Don't Clean Birthdays
          </Button>
          
          <Button onClick={handleApply} className="gap-2">
            Apply Format
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
