
"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ListChecks, ListTree, Users, LifeBuoy, CalendarDays, CalendarOff } from "lucide-react";
import Link from "next/link";

export default function GuidePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">How to use RotaPro</CardTitle>
          <CardDescription>
            Your step-by-step guide to mastering team scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary shrink-0" />
                    Step 1: Set Up Your Team & Shifts
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed pl-8 pt-2">
                <p className="mb-4">Go to the <Link href="/admin" className="font-semibold text-primary hover:underline">Config Panel</Link> to define who is on your team and what shifts they work.</p>
                <h4 className="font-semibold mb-2 text-primary">Team Members Tab</h4>
                <ul className="list-disc space-y-2 pl-6 mb-6">
                  <li>Click <span className="font-semibold">Add Member</span> to create a new team member.</li>
                  <li>Enter their name.</li>
                  <li>Optionally, assign a <span className="font-semibold">Fixed Shift</span> if they should not be part of the automatic rotation.</li>
                  <li>Use the pencil icon to edit or the trash icon to delete members.</li>
                </ul>
                 <h4 className="font-semibold mb-2 text-primary">Shifts Tab</h4>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Click <span className="font-semibold">Add Shift</span> to define a new work shift.</li>
                  <li>Set the shift's <span className="font-semibold">name</span>, <span className="font-semibold">start/end times</span>, and <span className="font-semibold">sequence</span> for rotation order.</li>
                  <li>Define <span className="font-semibold">min/max team members</span> required for the shift.</li>
                  <li>Mark a shift as <span className="font-semibold">"Extreme"</span> to prevent members being assigned to two extreme shifts back-to-back.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                    <CalendarOff className="h-5 w-5 text-primary shrink-0" />
                    Step 2: Schedule Team Leave
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed pl-8 pt-2">
                <p className="mb-4">Go to the <Link href="/leave" className="font-semibold text-primary hover:underline">Leave Matrix</Link> to log any upcoming holidays or other leave for your team members.</p>
                <ul className="list-disc space-y-2 pl-6 mb-6">
                  <li>In the <span className="font-semibold">Schedule Leave</span> section, select a team member from the dropdown.</li>
                  <li>Click the date input to open the calendar and select a start date, end date, or a range for the leave period.</li>
                  <li>Choose the <span className="font-semibold">Leave Type</span> (e.g., Holiday, Sick Leave).</li>
                  <li>Click <span className="font-semibold">Add Leave</span>.</li>
                  <li>Scheduled leave will be considered during rota generation. If a member's leave is shorter than the rota period, they will still be assigned a shift, but a comment will be added to their assignment.</li>
                </ul>
                <h4 className="font-semibold mb-2 text-primary">Managing Leave</h4>
                 <ul className="list-disc space-y-2 pl-6">
                  <li>The <span className="font-semibold">Scheduled Leave</span> table shows all entries.</li>
                  <li>Use the search bar to filter by a member's name.</li>
                  <li>You can <span className="font-semibold">Export</span> the full leave history as a CSV file.</li>
                  <li>Use the trash icon to delete a leave entry.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                    <ListChecks className="h-5 w-5 text-primary shrink-0" />
                    Step 3: Generate & Manage Your Rota
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed pl-8 pt-2">
                <p className="mb-4">Once your team is set up, head to the <Link href="/dashboard" className="font-semibold text-primary hover:underline">Dashboard</Link> to create and manage your schedules.</p>
                <h4 className="font-semibold mb-2 text-primary">Generating a Rota</h4>
                 <ol className="list-decimal space-y-2 pl-6 mb-6">
                  <li>Click the <span className="font-semibold">Generate Rota</span> button.</li>
                  <li>In the popup, select a <span className="font-semibold">Monday</span> as the start date.</li>
                  <li>Choose the <span className="font-semibold">Rota Period</span> (e.g., 2 Weeks).</li>
                  <li>Click <span className="font-semibold">Generate</span>. Your new rota and its associated weekend rota will appear on the dashboard.</li>
                </ol>
                <h4 className="font-semibold mb-2 text-primary">Managing the Active Rota</h4>
                 <ul className="list-disc space-y-2 pl-6">
                    <li><span className="font-semibold">Swap Shifts</span>: Select two team members to instantly swap their assigned shifts for the active period.</li>
                    <li><span className="font-semibold">Export</span>: Download the current rota as a CSV spreadsheet or a PNG image.</li>
                    <li><span className="font-semibold">Edit Assignments</span>: In the <span className="font-semibold">Generation History</span> list, click the edit icon to manually change assignments for any team member in that specific rota.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                    <LifeBuoy className="h-5 w-5 text-primary shrink-0" />
                    Step 4: Plan Ad-hoc & Weekend Rotas
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed pl-8 pt-2">
                <h4 className="font-semibold mb-2 text-primary">Ad-hoc Support Rota</h4>
                <p className="mb-4">Go to the <Link href="/support" className="font-semibold text-primary hover:underline">Support Rota</Link> page to assign team members to weekly ad-hoc duties.</p>
                <ul className="list-disc space-y-2 pl-6 mb-6">
                    <li>Select a rota period from the dropdown.</li>
                    <li>Use the checkboxes to mark which members are on ad-hoc duty for each week.</li>
                    <li>Log any notes or queries for each member in the text area.</li>
                    <li>Save your changes and export the ad-hoc rota as a CSV or PNG image.</li>
                </ul>

                <h4 className="font-semibold mb-2 text-primary">Weekend Rota</h4>
                <p className="mb-4">Navigate to the <Link href="/weekend" className="font-semibold text-primary hover:underline">Weekend Rota</Link> page to view the sequential weekend schedule for a given period.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li>The weekend rota is generated automatically with the main rota.</li>
                    <li>Use the <span className="font-semibold">Swap Weekend</span> button to exchange all weekend duties between two members for that period.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                    <ListTree className="h-5 w-5 text-primary shrink-0" />
                    Step 5: Analyze Rota History
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed pl-8 pt-2">
                <p className="mb-4">Use the <Link href="/matrix" className="font-semibold text-primary hover:underline">Rota Matrix</Link> page to see a long-term view of assignments and ensure fairness.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li>The matrix displays historical tables for the main shift rota, ad-hoc support rota, weekend rota, and leave data.</li>
                    <li>Quickly see who was assigned to which shift or duty and when. Use the pagination to navigate through history.</li>
                    <li>The <span className="font-semibold">Manual Swap History</span> table at the bottom logs all manual shift swaps. Use the <span className="font-semibold">Cancel Out</span> action to reverse a past swap in the current rota, helping maintain fairness over time.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>
    </motion.div>
  );
}
