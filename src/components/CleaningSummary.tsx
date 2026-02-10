import { Mail, Phone, User, Eraser, Sparkles, FileCheck, AlertTriangle, Tag, Clock, Calendar, UserCheck, MapPin, Trash2, Columns } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CleaningStats, RowValidation, DuplicateGroup } from '@/lib/cleaningEngine';

interface CleaningSummaryProps {
  stats: CleaningStats;
  validations: RowValidation[];
  duplicates: DuplicateGroup[];
}

export function CleaningSummary({ stats, validations, duplicates }: CleaningSummaryProps) {
  const hasIssues = validations.length > 0 || duplicates.length > 0;
  
  // Count unique duplicate rows
  const duplicateEmailRows = new Set(duplicates.filter(d => d.field === 'Email').flatMap(d => d.rowIndices));
  const duplicatePhoneRows = new Set(duplicates.filter(d => d.field === 'Phone').flatMap(d => d.rowIndices));
  
  // Count validation issues
  const rowsMissingFirstName = validations.filter(v => v.firstNameRequired).length;
  const rowsMissingEmail = validations.filter(v => v.missingFields.includes('Email')).length;
  const rowsMissingPhone = validations.filter(v => v.missingFields.includes('Phone')).length;
  const rowsMissingLastName = validations.filter(v => v.missingFields.includes('Last Name')).length;
  const rowsWithInvalidEmail = validations.filter(v => v.invalidEmail).length;
  const rowsWithInvalidStatus = validations.filter(v => v.invalidStatus).length;
  const rowsWithInvalidTimeZone = validations.filter(v => v.invalidTimeZone).length;

  return (
    <div className="space-y-6 mb-8">
      {/* Cleaning Stats */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Cleaning Summary</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emailsCleaned}</p>
                <p className="text-xs text-muted-foreground">Emails cleaned</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.phonesNormalized}</p>
                <p className="text-xs text-muted-foreground">Phones normalized</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.namesToProperCase}</p>
                <p className="text-xs text-muted-foreground">Names formatted</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.tagsFormatted}</p>
                <p className="text-xs text-muted-foreground">Tags formatted</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.timeZoneValidated}</p>
                <p className="text-xs text-muted-foreground">Timezones added</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.statusValidated}</p>
                <p className="text-xs text-muted-foreground">Statuses added</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.birthdayFormatted}</p>
                <p className="text-xs text-muted-foreground">Birthdays formatted</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Eraser className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emptyValuesCleared}</p>
                <p className="text-xs text-muted-foreground">Empty values cleared</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.addressesConsolidated}</p>
                <p className="text-xs text-muted-foreground">Addresses consolidated</p>
              </div>
            </div>
            
            {stats.emptyRowsRemoved > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.emptyRowsRemoved}</p>
                  <p className="text-xs text-muted-foreground">Empty rows removed</p>
                </div>
              </div>
            )}
            
            {stats.emptyColumnsRemoved > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Columns className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.emptyColumnsRemoved}</p>
                  <p className="text-xs text-muted-foreground">Empty columns removed</p>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 text-center">
            <FileCheck className="w-4 h-4 inline mr-1" />
            Processed {stats.totalRows} rows • {stats.totalCellsModified} cells modified
          </p>
        </CardContent>
      </Card>

      {/* Validation Warnings */}
      {hasIssues && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">!</span>
              </div>
              <h3 className="font-semibold text-lg">Data Quality Warnings</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              {/* Critical: First Name is required */}
              {rowsMissingFirstName > 0 && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <UserCheck className="w-4 h-4" />
                  <span><strong>{rowsMissingFirstName}</strong> {rowsMissingFirstName === 1 ? 'row' : 'rows'} missing First Name (REQUIRED)</span>
                </div>
              )}
              
              {rowsMissingEmail > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Mail className="w-4 h-4" />
                  <span>{rowsMissingEmail} {rowsMissingEmail === 1 ? 'row' : 'rows'} missing email</span>
                </div>
              )}
              
              {rowsWithInvalidEmail > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{rowsWithInvalidEmail} {rowsWithInvalidEmail === 1 ? 'row' : 'rows'} with invalid email format</span>
                </div>
              )}
              
              {rowsMissingPhone > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Phone className="w-4 h-4" />
                  <span>{rowsMissingPhone} {rowsMissingPhone === 1 ? 'row' : 'rows'} missing phone</span>
                </div>
              )}
              
              {rowsMissingLastName > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <User className="w-4 h-4" />
                  <span>{rowsMissingLastName} {rowsMissingLastName === 1 ? 'row' : 'rows'} missing last name</span>
                </div>
              )}
              
              {rowsWithInvalidStatus > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <UserCheck className="w-4 h-4" />
                  <span>{rowsWithInvalidStatus} {rowsWithInvalidStatus === 1 ? 'row' : 'rows'} with invalid Status (must be Lead, Customer, or VIP)</span>
                </div>
              )}
              
              {rowsWithInvalidTimeZone > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span>{rowsWithInvalidTimeZone} {rowsWithInvalidTimeZone === 1 ? 'row' : 'rows'} with invalid Time Zone</span>
                </div>
              )}
              
              {duplicateEmailRows.size > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Mail className="w-4 h-4" />
                  <span>{duplicateEmailRows.size} rows with duplicate emails</span>
                </div>
              )}
              
              {duplicatePhoneRows.size > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Phone className="w-4 h-4" />
                  <span>{duplicatePhoneRows.size} rows with duplicate phones</span>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              These rows will still be exported. Review the preview below to verify.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
