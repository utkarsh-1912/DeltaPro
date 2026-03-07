"use client";

import * as React from "react";
import { useRotaStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format,
  addMonths,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export function WeekendRotaManager() {
  const { weekendRotas, teamMembers } = useRotaStore();
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const memberMap = React.useMemo(() => new Map(teamMembers.map(m => [m.id, m])), [teamMembers]);

  const monthlyRotas = React.useMemo(() => {
    return weekendRotas.filter(rota => {
      const rotaDate = new Date(rota.date);
      return rotaDate.getMonth() === currentMonth.getMonth() && rotaDate.getFullYear() === currentMonth.getFullYear();
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weekendRotas, currentMonth]);

  const hasRotaForMonth = monthlyRotas.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Weekend Rota</CardTitle>
          <CardDescription>
            View the sequential rota for weekend duties.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
            <ChevronLeft />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48">
                <CalendarIcon className="mr-2" />
                {format(currentMonth, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={currentMonth}
                onSelect={(date) => date && setCurrentMonth(date)}
                initialFocus
                pagedNavigation
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasRotaForMonth ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Weekend Date</TableHead>
                  <TableHead>Assigned Member</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRotas.map(rota => (
                  <TableRow key={rota.date}>
                    <TableCell className="font-medium">{format(new Date(rota.date), "EEE, d MMM yyyy")}</TableCell>
                    <TableCell>{memberMap.get(rota.memberId)?.name || 'Unknown Member'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p>No weekend rota data available for {format(currentMonth, "MMMM yyyy")}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
