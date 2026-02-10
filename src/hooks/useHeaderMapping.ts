import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TARGET_HEADERS, type HeaderMapping, type TargetHeader, type AddressComponent, type NameSplitDetection, detectAddressComponentColumns, detectFullNameColumn } from '@/lib/cleaningEngine';
import { toast } from 'sonner';

export function useHeaderMapping() {
  const [mappings, setMappings] = useState<HeaderMapping[]>([]);
  const [originalMappings, setOriginalMappings] = useState<HeaderMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasBeenModified, setHasBeenModified] = useState(false);
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [addressComponents, setAddressComponents] = useState<AddressComponent[]>([]);
  const [nameSplitColumn, setNameSplitColumn] = useState<string | null>(null);
  const getMappingsFromAI = async (sourceHeaders: string[]): Promise<HeaderMapping[]> => {
    setIsLoading(true);
    setHasBeenModified(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('map-headers', {
        body: { 
          sourceHeaders,
          targetHeaders: TARGET_HEADERS 
        },
      });

      if (error) {
        console.error('AI mapping error:', error);
        toast.error('AI mapping failed. Using fallback matching.');
        return fallbackMapping(sourceHeaders);
      }

      if (data?.mappings) {
        const aiMappings: HeaderMapping[] = sourceHeaders.map(sourceHeader => {
          const aiMapping = data.mappings.find(
            (m: any) => m.source?.toLowerCase() === sourceHeader.toLowerCase()
          );
          
          return {
            sourceHeader,
            targetHeader: aiMapping?.target || null,
            confidence: aiMapping?.confidence || 0,
          };
        });
        
        // Handle address components from AI
        if (data.addressComponents && Array.isArray(data.addressComponents) && data.addressComponents.length >= 2) {
          const aiAddressComponents: AddressComponent[] = data.addressComponents.map((c: any) => ({
            sourceHeader: c.source,
            role: c.role,
            order: c.order,
          }));
          setAddressComponents(aiAddressComponents);
        } else {
          // Fallback: detect address components from headers
          const detectedComponents = detectAddressComponentColumns(sourceHeaders);
          if (detectedComponents.length >= 2) {
            setAddressComponents(detectedComponents);
          }
        }
        
        // Handle name split column from AI
        if (data.nameSplitColumn && data.nameSplitColumn.source) {
          setNameSplitColumn(data.nameSplitColumn.source);
        } else {
          // Fallback: detect full name column from headers
          const detectedNameColumn = detectFullNameColumn(sourceHeaders);
          if (detectedNameColumn) {
            setNameSplitColumn(detectedNameColumn.sourceHeader);
          }
        }
        
        setMappings(aiMappings);
        setOriginalMappings(aiMappings);
        return aiMappings;
      }
      
      return fallbackMapping(sourceHeaders);
    } catch (err) {
      console.error('Failed to get AI mappings:', err);
      toast.error('AI mapping failed. Using fallback matching.');
      return fallbackMapping(sourceHeaders);
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackMapping = (sourceHeaders: string[]): HeaderMapping[] => {
    const fallbackMappings: HeaderMapping[] = sourceHeaders.map(sourceHeader => {
      const normalized = sourceHeader.toLowerCase().replace(/[_\-\s]+/g, '');
      
      let targetHeader: TargetHeader | null = null;
      let confidence = 0;

      // vcita field keyword matching
      if (normalized.includes('firstname') || normalized === 'first' || normalized === 'fname') {
        targetHeader = 'First Name';
        confidence = 0.8;
      } else if (normalized.includes('lastname') || normalized === 'last' || normalized === 'lname') {
        targetHeader = 'Last Name';
        confidence = 0.8;
      } else if (normalized.includes('email') || normalized.includes('mail')) {
        targetHeader = 'Email';
        confidence = 0.9;
      } else if (normalized.includes('phone') || normalized.includes('cell') || normalized === 'ph' || normalized.includes('mobile')) {
        targetHeader = 'Phone';
        confidence = 0.8;
      } else if (normalized.includes('address') || normalized.includes('street')) {
        targetHeader = 'Address';
        confidence = 0.7;
      } else if (normalized.includes('birthday') || normalized.includes('dob') || normalized.includes('birthdate')) {
        targetHeader = 'Birthday';
        confidence = 0.8;
      } else if (normalized.includes('timezone') || normalized.includes('tz')) {
        targetHeader = 'Time Zone';
        confidence = 0.8;
      } else if (normalized.includes('status') || normalized.includes('type') || normalized.includes('category')) {
        targetHeader = 'Status';
        confidence = 0.6;
      } else if (normalized.includes('tag') || normalized.includes('source') || normalized.includes('lead')) {
        targetHeader = 'Tags';
        confidence = 0.6;
      } else if (normalized.includes('note') || normalized.includes('comment') || normalized.includes('info')) {
        targetHeader = 'Notes';
        confidence = 0.6;
      }

      return { sourceHeader, targetHeader, confidence };
    });

    setMappings(fallbackMappings);
    return fallbackMappings;
  };

  const updateMapping = (sourceHeader: string, newTarget: TargetHeader | null, isCustom: boolean = false) => {
    setHasBeenModified(true);
    setMappings(prev => 
      prev.map(m => 
        m.sourceHeader === sourceHeader 
          ? { ...m, targetHeader: newTarget, confidence: 1, isCustom } 
          : m
      )
    );
  };

  const addCustomField = (fieldName: string) => {
    if (!customFields.includes(fieldName)) {
      setCustomFields(prev => [...prev, fieldName]);
      toast.success(`Added custom field: ${fieldName}`);
    } else {
      toast.info(`Field "${fieldName}" already exists`);
    }
  };

  const resetToOriginal = () => {
    if (originalMappings.length > 0) {
      setMappings([...originalMappings]);
      setHasBeenModified(false);
      toast.success('Reset to AI suggestions');
    }
  };

  const renameSourceHeader = (oldHeader: string, newHeader: string) => {
    setHasBeenModified(true);
    setMappings(prev => 
      prev.map(m => 
        m.sourceHeader === oldHeader 
          ? { ...m, sourceHeader: newHeader } 
          : m
      )
    );
    toast.success(`Renamed column to "${newHeader}"`);
  };

  const clearAddressComponents = () => {
    setAddressComponents([]);
  };

  const clearNameSplitColumn = () => {
    setNameSplitColumn(null);
  };

  return {
    mappings,
    setMappings,
    getMappingsFromAI,
    updateMapping,
    resetToOriginal,
    renameSourceHeader,
    hasBeenModified,
    isLoading,
    customFields,
    addCustomField,
    addressComponents,
    clearAddressComponents,
    nameSplitColumn,
    clearNameSplitColumn,
  };
}
