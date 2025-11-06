# DeltaPro - Professional Rota Management

This is a DeltaPro application, a powerful, AI-driven tool for managing team schedules and rotas. It's built with Next.js, React, Tailwind CSS, ShadCN, and Firebase.

## Getting Started

To get started with the application:

1.  Run `npm install` to install the dependencies.
2.  Run `npm run dev` to start the development server.
3.  Open your browser to the provided URL for your project.

## Key Features

-   **Intelligent Rota Generation**: Automatically create fair and balanced shift schedules for configurable periods (1, 2, or 4 weeks).
-   **Team & Shift Management**: Easily manage team members, their fixed assignments, shift timings, staffing requirements, and rotation rules via a central Config Panel.
-   **Dynamic Dashboard**: View the currently active rota, swap shifts between members, and export the schedule as a CSV or PNG image.
-   **Ad-hoc Support Planning**: Assign team members to weekly ad-hoc support duties, log notes, and export the support rota.
-   **Automated Weekend Rota**: View and manage a separate, sequential rota for weekend duties, with its own swap functionality.
-   **Comprehensive Rota Matrix**: Analyze historical assignment data for all members across all rota periods for shifts, ad-hoc duties, and weekend assignments.
-   **Manual Swap History**: Keep track of all manual shift swaps, with a system to "cancel out" historical changes to maintain long-term fairness.
-   **Firebase Integration**: Uses Firebase for secure user authentication and real-time data storage.
