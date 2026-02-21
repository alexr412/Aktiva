'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportDialog } from './ReportDialog';
import { Button } from '../ui/button';

interface EntityMoreOptionsProps {
    entityId: string;
    entityType: 'activity' | 'user';
    entityName: string;
}

export function EntityMoreOptions({ entityId, entityType, entityName }: EntityMoreOptionsProps) {
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">More options</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsReportDialogOpen(true);
                        }} 
                        className="text-destructive focus:text-destructive"
                    >
                        Report {entityType}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <ReportDialog
                open={isReportDialogOpen}
                onOpenChange={setIsReportDialogOpen}
                entityId={entityId}
                entityType={entityType}
                entityName={entityName}
            />
        </>
    );
}
