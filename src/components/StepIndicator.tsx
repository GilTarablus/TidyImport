import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {/* Step circle */}
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              currentStep > step.id && "bg-primary text-primary-foreground",
              currentStep === step.id && "bg-primary text-primary-foreground ring-4 ring-primary/20",
              currentStep < step.id && "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step.id ? (
              <Check className="w-4 h-4" />
            ) : (
              step.id
            )}
          </div>

          {/* Step label */}
          <span
            className={cn(
              "ml-2 text-sm font-medium hidden sm:inline",
              currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-12 h-0.5 mx-4",
                currentStep > step.id ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
